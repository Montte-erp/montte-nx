import { createHash } from "node:crypto";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { WorkflowError } from "@core/dbos/errors";
import {
   matchByKeywords,
   type KeywordMatchResult,
} from "@modules/classification/utils";
import type { ClassifyBatchResult } from "@modules/classification/ai/classify-batch";
import { CLASSIFICATION_QUEUES } from "@modules/classification/constants";
import { registerWorkflowOnce } from "@modules/classification/workflows/context";
import {
   emitClassificationEvents,
   loadClassificationInputs,
   resolveTagId,
   runAiClassificationChunk,
   writeClassifications,
   type ClassificationWrite,
   type LoadedTransaction,
} from "@modules/classification/services/classification";

const AI_CHUNK_SIZE = 20;

export type ClassifyTransactionsBatchInput = {
   teamId: string;
   transactionIds: string[];
};

function chunk<T>(items: T[], size: number): T[][] {
   const out: T[][] = [];
   for (let i = 0; i < items.length; i += size)
      out.push(items.slice(i, i + size));
   return out;
}

async function classifyTransactionsBatchWorkflowFn(
   input: ClassifyTransactionsBatchInput,
) {
   const ctx = `[classify-batch] team=${input.teamId} count=${input.transactionIds.length}`;
   DBOS.logger.info(`${ctx} started`);

   if (input.transactionIds.length === 0) {
      DBOS.logger.info(`${ctx} empty input — nothing to classify`);
      return;
   }

   const loadResult = await fromPromise(loadClassificationInputs(input), (e) =>
      WorkflowError.database("Falha ao carregar dados de classificação.", {
         cause: e,
      }),
   );
   if (loadResult.isErr()) throw loadResult.error;
   const loaded = loadResult.value;

   if (loaded.transactions.length === 0) {
      DBOS.logger.info(
         `${ctx} no pending transactions to classify — already classified or filtered out`,
      );
      return;
   }

   const categoryById = new Map(loaded.categories.map((c) => [c.id, c]));
   const namedTransactions = loaded.transactions.filter(
      (t): t is LoadedTransaction & { name: string } => t.name !== null,
   );

   const matchResults: KeywordMatchResult[] = matchByKeywords(
      namedTransactions.map((t) => ({
         id: t.id,
         name: t.name,
         contactName: t.contactName,
      })),
      loaded.categories,
   );

   const keywordMatched = matchResults.filter(
      (r): r is KeywordMatchResult & { matchedCategoryId: string } =>
         r.matchedCategoryId !== null,
   );
   const matchedIds = new Set(keywordMatched.map((r) => r.transactionId));
   const unmatched = namedTransactions.filter((t) => !matchedIds.has(t.id));

   const aiResults: ClassifyBatchResult[] = [];
   if (unmatched.length > 0 && loaded.categories.length > 0) {
      const chunks = chunk(unmatched, AI_CHUNK_SIZE);
      for (let i = 0; i < chunks.length; i += 1) {
         const chunkItems = chunks[i];
         if (!chunkItems) continue;
         const chunkResult = await fromPromise(
            runAiClassificationChunk(
               chunkItems,
               loaded.categories,
               input.teamId,
               i,
            ),
            (e) =>
               WorkflowError.internal(
                  "Falha ao classificar transações com IA.",
                  { cause: e },
               ),
         );
         if (chunkResult.isErr()) throw chunkResult.error;
         aiResults.push(...chunkResult.value);
      }
   }

   const writes: ClassificationWrite[] = [
      ...keywordMatched.map((r) => ({
         transactionId: r.transactionId,
         categoryId: r.matchedCategoryId,
         tagId: resolveTagId(
            r.matchedCategoryId,
            categoryById,
            loaded.tagByName,
         ),
      })),
      ...aiResults.map((r) => ({
         transactionId: r.transactionId,
         categoryId: r.categoryId,
         tagId: resolveTagId(r.categoryId, categoryById, loaded.tagByName),
      })),
   ];

   if (writes.length === 0) {
      DBOS.logger.info(`${ctx} no classifications produced — exiting`);
      return;
   }

   const writeResult = await fromPromise(
      writeClassifications(writes, input.teamId),
      (e) =>
         WorkflowError.database("Falha ao gravar classificações.", {
            cause: e,
         }),
   );
   if (writeResult.isErr()) throw writeResult.error;

   const emitResult = await fromPromise(
      emitClassificationEvents(writes, input.teamId),
      (e) =>
         WorkflowError.internal("Falha ao emitir eventos SSE.", { cause: e }),
   );
   if (emitResult.isErr()) throw emitResult.error;

   DBOS.logger.info(
      `${ctx} completed — keyword=${keywordMatched.length} ai=${aiResults.length} written=${writes.length}`,
   );
}

export const classifyTransactionsBatchWorkflow = registerWorkflowOnce(
   classifyTransactionsBatchWorkflowFn,
);

function buildWorkflowId(input: ClassifyTransactionsBatchInput): string {
   const sorted = [...input.transactionIds].sort();
   const hash = createHash("sha256")
      .update(sorted.join(","))
      .digest("hex")
      .slice(0, 12);
   return `classify-batch-${input.teamId}-${hash}`;
}

export async function enqueueClassifyTransactionsBatchWorkflow(
   client: DBOSClient,
   input: ClassifyTransactionsBatchInput,
) {
   const workflowID = buildWorkflowId(input);
   return client.enqueue(
      {
         workflowName: classifyTransactionsBatchWorkflowFn.name,
         queueName: `workflow:${CLASSIFICATION_QUEUES.classify}`,
         workflowID,
      },
      input,
   );
}
