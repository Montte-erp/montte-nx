import { DBOS } from "@dbos-inc/dbos-sdk";
import { and, eq, isNull } from "drizzle-orm";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { transactions } from "@core/database/schemas/transactions";
import {
   classifyTransactionsBatch,
   type ClassifyBatchInput,
   type ClassifyBatchResult,
} from "@modules/classification/ai/classify-batch";
import { classificationSseEvents } from "@modules/classification/sse";
import {
   classificationDataSource,
   getClassificationPosthog,
   getClassificationPrompts,
   getClassificationRedis,
} from "@modules/classification/workflows/context";

export type CategoryRow = {
   id: string;
   name: string;
   keywords: string[] | null;
   dreGroupId: string | null;
};

export type LoadedTransaction = {
   id: string;
   teamId: string;
   name: string | null;
   type: "income" | "expense" | "transfer";
   contactName: string | null;
};

export type LoadedInputs = {
   transactions: LoadedTransaction[];
   categories: CategoryRow[];
   tagByName: Map<string, string>;
};

export type ClassificationWrite = {
   transactionId: string;
   categoryId: string;
   tagId: string | null;
};

export async function loadClassificationInputs(input: {
   teamId: string;
   transactionIds: string[];
}) {
   return DBOS.runStep(
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
}

export async function runAiClassificationChunk(
   chunkItems: (LoadedTransaction & { name: string })[],
   options: CategoryRow[],
   teamId: string,
   index: number,
): Promise<ClassifyBatchResult[]> {
   return DBOS.runStep(
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
}

export async function writeClassifications(
   writes: ClassificationWrite[],
   teamId: string,
) {
   return DBOS.runStep(
      () =>
         classificationDataSource.runTransaction(
            async () => {
               const tx = classificationDataSource.client;
               for (const write of writes) {
                  await tx
                     .update(transactions)
                     .set({
                        suggestedCategoryId: write.categoryId,
                        ...(write.tagId ? { suggestedTagId: write.tagId } : {}),
                     })
                     .where(
                        and(
                           eq(transactions.id, write.transactionId),
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
}

export async function emitClassificationEvents(
   writes: ClassificationWrite[],
   teamId: string,
) {
   return DBOS.runStep(
      async () => {
         const redis = getClassificationRedis();
         const scope = { kind: "team" as const, id: teamId };
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
                  DBOS.logger.warn(
                     `Failed to publish classification SSE event — tx=${write.transactionId} team=${teamId} err=${publish.error.message}`,
                  );
               }
            }),
         );
      },
      { name: "emit-sse-events" },
   );
}

export function resolveTagId(
   categoryId: string,
   categoryById: Map<string, CategoryRow>,
   tagByName: Map<string, string>,
): string | null {
   const category = categoryById.get(categoryId);
   if (!category?.dreGroupId) return null;
   return tagByName.get(category.dreGroupId) ?? null;
}
