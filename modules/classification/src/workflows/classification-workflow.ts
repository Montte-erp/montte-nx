import { createHash } from "node:crypto";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { and, eq, isNull } from "drizzle-orm";
import { WorkflowError } from "@core/dbos/errors";
import { getLogger } from "@core/logging/root";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import { matchByKeywords, type KeywordMatchResult } from "../utils";
import {
   classifyTransactionsBatch,
   type ClassifyBatchInput,
   type ClassifyBatchResult,
} from "../ai/classify-batch";
import { classificationSseEvents } from "../sse/events";
import { CLASSIFICATION_QUEUES } from "../constants";
import {
   classificationDataSource,
   getClassificationPosthog,
   getClassificationRedis,
} from "./context";

const AI_CHUNK_SIZE = 20;

export type ClassifyTransactionsBatchInput = {
   teamId: string;
   transactionIds: string[];
};

type LoadedInputs = {
   transactions: {
      id: string;
      teamId: string;
      name: string | null;
      type: "income" | "expense" | "transfer";
      contactName: string | null;
   }[];
   categories: { id: string; name: string; keywords: string[] | null }[];
   tags: { id: string; name: string; keywords: string[] | null }[];
};

type ClassificationWrite = {
   transactionId: string;
   categoryId: string;
   tagId: string | null;
};

function chunk<T>(items: T[], size: number): T[][] {
   const chunks: T[][] = [];
   for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
   }
   return chunks;
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

   const loadResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async (): Promise<LoadedInputs> => {
                  const tx = classificationDataSource.client;

                  const txRows = await tx.query.transactions.findMany({
                     where: (
                        f,
                        {
                           and: andFn,
                           eq: eqFn,
                           inArray: inArrayFn,
                           isNull: isNullFn,
                        },
                     ) =>
                        andFn(
                           eqFn(f.teamId, input.teamId),
                           inArrayFn(f.id, input.transactionIds),
                           isNullFn(f.categoryId),
                           isNullFn(f.suggestedCategoryId),
                        ),
                     with: { contact: true },
                  });

                  const catRows = await tx
                     .select({
                        id: categories.id,
                        name: categories.name,
                        keywords: categories.keywords,
                     })
                     .from(categories)
                     .where(
                        and(
                           eq(categories.teamId, input.teamId),
                           eq(categories.isArchived, false),
                        ),
                     );

                  const tagRows = await tx
                     .select({
                        id: tags.id,
                        name: tags.name,
                        keywords: tags.keywords,
                     })
                     .from(tags)
                     .where(
                        and(
                           eq(tags.teamId, input.teamId),
                           eq(tags.isArchived, false),
                        ),
                     );

                  return {
                     transactions: txRows.map((row) => ({
                        id: row.id,
                        teamId: row.teamId,
                        name: row.name,
                        type: row.type,
                        contactName: row.contact?.name ?? null,
                     })),
                     categories: catRows,
                     tags: tagRows,
                  };
               },
               { name: "load-classification-inputs" },
            ),
         { name: "load-classification-inputs" },
      ),
      (e) =>
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

   const namedTransactions = loaded.transactions.filter(
      (t): t is typeof t & { name: string } => t.name !== null,
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
      const observability = {
         posthog: getClassificationPosthog(),
         distinctId: input.teamId,
      };

      const chunks = chunk(unmatched, AI_CHUNK_SIZE);
      for (let i = 0; i < chunks.length; i += 1) {
         const chunkItems = chunks[i];
         if (!chunkItems) continue;
         const stepIndex = i + 1;
         const chunkResult = await fromPromise(
            DBOS.runStep(
               async () => {
                  const aiInput: ClassifyBatchInput[] = chunkItems
                     .filter((t) => t.type !== "transfer")
                     .map((t) => ({
                        id: t.id,
                        name: t.name,
                        type: t.type === "income" ? "income" : "expense",
                        contactName: t.contactName,
                     }));
                  if (aiInput.length === 0) return [];
                  const ai = await classifyTransactionsBatch(
                     aiInput,
                     loaded.categories,
                     loaded.tags,
                     observability,
                  );
                  if (ai.isErr()) throw ai.error;
                  return ai.value;
               },
               { name: `ai-classify-chunk-${stepIndex}` },
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
         tagId: null,
      })),
      ...aiResults.map((r) => ({
         transactionId: r.transactionId,
         categoryId: r.categoryId,
         tagId: r.tagId,
      })),
   ];

   if (writes.length === 0) {
      DBOS.logger.info(`${ctx} no classifications produced — exiting`);
      return;
   }

   const writeResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async () => {
                  const tx = classificationDataSource.client;
                  for (const write of writes) {
                     await tx
                        .update(transactions)
                        .set({
                           suggestedCategoryId: write.categoryId,
                           ...(write.tagId
                              ? { suggestedTagId: write.tagId }
                              : {}),
                        })
                        .where(
                           and(
                              eq(transactions.id, write.transactionId),
                              eq(transactions.teamId, input.teamId),
                              isNull(transactions.categoryId),
                              isNull(transactions.suggestedCategoryId),
                           ),
                        );
                  }
               },
               { name: "write-classifications" },
            ),
         { name: "write-classifications" },
      ),
      (e) =>
         WorkflowError.database("Falha ao gravar classificações.", {
            cause: e,
         }),
   );
   if (writeResult.isErr()) throw writeResult.error;

   const emitResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const redis = getClassificationRedis();
            const logger = getLogger();
            const scope: { kind: "team"; id: string } = {
               kind: "team",
               id: input.teamId,
            };
            await Promise.all(
               writes.map(async (write) => {
                  const publish = await classificationSseEvents.publish(
                     redis,
                     scope,
                     {
                        type: "classification.transaction_classified",
                        payload: {
                           transactionId: write.transactionId,
                           categoryId: write.categoryId,
                           tagId: write.tagId,
                        },
                     },
                  );
                  if (publish.isErr()) {
                     logger.warn(
                        {
                           err: publish.error,
                           transactionId: write.transactionId,
                           teamId: input.teamId,
                        },
                        "Failed to publish classification SSE event",
                     );
                  }
               }),
            );
         },
         { name: "emit-sse-events" },
      ),
      (e) =>
         WorkflowError.internal("Falha ao emitir eventos SSE.", { cause: e }),
   );
   if (emitResult.isErr()) throw emitResult.error;

   DBOS.logger.info(
      `${ctx} completed — keyword=${keywordMatched.length} ai=${aiResults.length} written=${writes.length}`,
   );
}

export const classifyTransactionsBatchWorkflow = DBOS.registerWorkflow(
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
