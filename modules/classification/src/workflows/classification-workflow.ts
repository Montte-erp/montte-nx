import { createHash } from "node:crypto";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { and, eq, isNull } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { WorkflowError } from "@core/dbos/errors";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import {
   classifyTransactionsBatch,
   type ClassifyBatchInput,
   type ClassifyBatchResult,
} from "@modules/classification/ai/classify-batch";
import { CLASSIFICATION_QUEUES } from "@modules/classification/constants";
import { classificationSseEvents } from "@modules/classification/sse";
import {
   matchByKeywords,
   type KeywordMatchResult,
} from "@modules/classification/utils";
import {
   classificationDataSource,
   getClassificationPosthog,
   getClassificationPrompts,
   getClassificationRedis,
   registerWorkflowOnce,
} from "@modules/classification/workflows/context";

const AI_CHUNK_SIZE = 20;

export type ClassifyTransactionsBatchInput = {
   teamId: string;
   transactionIds: string[];
};

type CategoryRow = {
   id: string;
   name: string;
   keywords: string[] | null;
   dreGroupId: string | null;
};

type LoadedTransaction = {
   id: string;
   teamId: string;
   name: string | null;
   type: "income" | "expense" | "transfer";
   contactName: string | null;
};

type LoadedInputs = {
   transactions: LoadedTransaction[];
   categories: CategoryRow[];
   tagByName: Map<string, string>;
};

type ClassificationWrite = {
   transactionId: string;
   categoryId: string;
   tagId: string | null;
};

function chunk<T>(items: T[], size: number): T[][] {
   const out: T[][] = [];
   for (let i = 0; i < items.length; i += size)
      out.push(items.slice(i, i + size));
   return out;
}

function resolveTagId(
   categoryId: string,
   categoryById: Map<string, CategoryRow>,
   tagByName: Map<string, string>,
): string | null {
   const dreGroupId = categoryById.get(categoryId)?.dreGroupId;
   if (!dreGroupId) return null;
   return tagByName.get(dreGroupId) ?? null;
}

const stepLoadInputs = (input: ClassifyTransactionsBatchInput) =>
   DBOS.runStep(
      () =>
         classificationDataSource.runTransaction(
            async (): Promise<LoadedInputs> => {
               const tx = classificationDataSource.client;
               const txRows = await tx.query.transactions.findMany({
                  where: (f, { and, eq, inArray, isNull }) =>
                     and(
                        eq(f.teamId, input.teamId),
                        inArray(f.id, input.transactionIds),
                        isNull(f.categoryId),
                        isNull(f.suggestedCategoryId),
                     ),
                  with: { contact: true },
               });
               const catRows = await tx
                  .select({
                     id: categories.id,
                     name: categories.name,
                     keywords: categories.keywords,
                     dreGroupId: categories.dreGroupId,
                  })
                  .from(categories)
                  .where(
                     and(
                        eq(categories.teamId, input.teamId),
                        eq(categories.isArchived, false),
                     ),
                  );
               const tagRows = await tx
                  .select({ id: tags.id, name: tags.name })
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
                  tagByName: new Map(tagRows.map((t) => [t.name, t.id])),
               };
            },
            { name: "load-classification-inputs" },
         ),
      { name: "load-classification-inputs" },
   );

const stepAiChunk = (
   chunkItems: (LoadedTransaction & { name: string })[],
   options: CategoryRow[],
   teamId: string,
   index: number,
) =>
   DBOS.runStep(
      async (): Promise<ClassifyBatchResult[]> => {
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
            getClassificationPrompts(),
            aiInput,
            options,
            { posthog: getClassificationPosthog(), distinctId: teamId },
         );
         if (ai.isErr()) throw ai.error;
         return ai.value;
      },
      { name: `ai-classify-chunk-${index + 1}` },
   );

const stepWrite = (writes: ClassificationWrite[], teamId: string) =>
   DBOS.runStep(
      () =>
         classificationDataSource.runTransaction(
            async () => {
               const tx = classificationDataSource.client;
               for (const w of writes) {
                  await tx
                     .update(transactions)
                     .set({
                        suggestedCategoryId: w.categoryId,
                        ...(w.tagId ? { suggestedTagId: w.tagId } : {}),
                     })
                     .where(
                        and(
                           eq(transactions.id, w.transactionId),
                           eq(transactions.teamId, teamId),
                           isNull(transactions.categoryId),
                           isNull(transactions.suggestedCategoryId),
                        ),
                     );
               }
            },
            { name: "write-classifications" },
         ),
      { name: "write-classifications" },
   );

const stepEmitSse = (writes: ClassificationWrite[], teamId: string) =>
   DBOS.runStep(
      async () => {
         const redis = getClassificationRedis();
         const scope = { kind: "team" as const, id: teamId };
         await Promise.all(
            writes.map(async (w) => {
               const publish = await classificationSseEvents.publish(
                  redis,
                  scope,
                  {
                     type: "classification.transaction_classified",
                     payload: {
                        transactionId: w.transactionId,
                        categoryId: w.categoryId,
                        tagId: w.tagId,
                     },
                  },
               );
               if (publish.isErr()) {
                  DBOS.logger.warn(
                     `Failed to publish classification SSE event — tx=${w.transactionId} team=${teamId} err=${publish.error.message}`,
                  );
               }
            }),
         );
      },
      { name: "emit-sse-events" },
   );

async function classifyTransactionsBatchWorkflowFn(
   input: ClassifyTransactionsBatchInput,
) {
   const log = `[classify-batch] team=${input.teamId} count=${input.transactionIds.length}`;
   DBOS.logger.info(`${log} started`);

   if (input.transactionIds.length === 0) {
      DBOS.logger.info(`${log} empty input — nothing to classify`);
      return;
   }

   const loadResult = await fromPromise(stepLoadInputs(input), (e) =>
      WorkflowError.database("Falha ao carregar dados de classificação.", {
         cause: e,
      }),
   );
   if (loadResult.isErr()) throw loadResult.error;
   const loaded = loadResult.value;

   if (loaded.transactions.length === 0) {
      DBOS.logger.info(
         `${log} no pending transactions to classify — already classified or filtered out`,
      );
      return;
   }

   const categoryById = new Map(loaded.categories.map((c) => [c.id, c]));
   const named = loaded.transactions.filter(
      (t): t is LoadedTransaction & { name: string } => t.name !== null,
   );

   const matched: KeywordMatchResult[] = matchByKeywords(
      named.map((t) => ({
         id: t.id,
         name: t.name,
         contactName: t.contactName,
      })),
      loaded.categories,
   );

   const keywordHits = matched.filter(
      (r): r is KeywordMatchResult & { matchedCategoryId: string } =>
         r.matchedCategoryId !== null,
   );
   const matchedIds = new Set(keywordHits.map((r) => r.transactionId));
   const unmatched = named.filter((t) => !matchedIds.has(t.id));

   const aiResults: ClassifyBatchResult[] = [];
   if (unmatched.length > 0 && loaded.categories.length > 0) {
      const chunks = chunk(unmatched, AI_CHUNK_SIZE);
      for (let i = 0; i < chunks.length; i += 1) {
         const chunkItems = chunks[i];
         if (!chunkItems) continue;
         const ai = await fromPromise(
            stepAiChunk(chunkItems, loaded.categories, input.teamId, i),
            (e) =>
               WorkflowError.internal(
                  "Falha ao classificar transações com IA.",
                  {
                     cause: e,
                  },
               ),
         );
         if (ai.isErr()) throw ai.error;
         aiResults.push(...ai.value);
      }
   }

   const writes: ClassificationWrite[] = [
      ...keywordHits.map((r) => ({
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
      DBOS.logger.info(`${log} no classifications produced — exiting`);
      return;
   }

   const writeResult = await fromPromise(stepWrite(writes, input.teamId), (e) =>
      WorkflowError.database("Falha ao gravar classificações.", { cause: e }),
   );
   if (writeResult.isErr()) throw writeResult.error;

   const emitResult = await fromPromise(
      stepEmitSse(writes, input.teamId),
      (e) =>
         WorkflowError.internal("Falha ao emitir eventos SSE.", { cause: e }),
   );
   if (emitResult.isErr()) throw emitResult.error;

   DBOS.logger.info(
      `${log} completed — keyword=${keywordHits.length} ai=${aiResults.length} written=${writes.length}`,
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
   return client.enqueue(
      {
         workflowName: classifyTransactionsBatchWorkflowFn.name,
         queueName: `workflow:${CLASSIFICATION_QUEUES.classify}`,
         workflowID: buildWorkflowId(input),
      },
      input,
   );
}
