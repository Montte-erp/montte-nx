import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { categories } from "@core/database/schemas/categories";
import { WorkflowError } from "@core/dbos/errors";
import { getLogger } from "@core/logging/root";
import { ingestUsageEvent } from "@core/hyprpay/usage";
import { deriveKeywords } from "../ai/derive-keywords";
import { classificationSseEvents } from "../sse/events";
import { CLASSIFICATION_QUEUES } from "../constants";
import { CLASSIFICATION_USAGE_EVENTS } from "../usage-events";
import {
   classificationDataSource,
   createEnqueuer,
   getClassificationHyprpay,
   getClassificationPosthog,
   getClassificationRedis,
} from "./context";

export type DeriveKeywordsWorkflowInput = {
   categoryId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
};

async function deriveKeywordsWorkflowFn(input: DeriveKeywordsWorkflowInput) {
   const ctx = `[derive-keywords] category=${input.categoryId} team=${input.teamId}`;
   DBOS.logger.info(`${ctx} started name="${input.name}"`);

   const siblingsResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async () => {
                  const tx = classificationDataSource.client;
                  const rows = await tx.query.categories.findMany({
                     where: (f, { and, eq, ne, isNotNull }) =>
                        and(
                           eq(f.teamId, input.teamId),
                           ne(f.id, input.categoryId),
                           isNotNull(f.keywords),
                        ),
                     columns: { keywords: true },
                  });
                  return [
                     ...new Set(rows.flatMap((r) => r.keywords ?? [])),
                  ].sort();
               },
               { name: "loadSiblingKeywords" },
            ),
         { name: "loadSiblingKeywords" },
      ),
      (e) =>
         WorkflowError.database(
            "Falha ao carregar palavras-chave já usadas pelas categorias do time.",
            { cause: e },
         ),
   );
   if (siblingsResult.isErr()) throw siblingsResult.error;
   const siblingKeywords = siblingsResult.value;

   const keywordsResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const result = await deriveKeywords(
               {
                  name: input.name,
                  description: input.description ?? null,
                  siblingKeywords,
               },
               {
                  posthog: getClassificationPosthog(),
                  distinctId: input.teamId,
               },
            );
            if (result.isErr()) throw result.error;
            return result.value;
         },
         { name: "deriveKeywords" },
      ),
      (e) =>
         WorkflowError.internal("Falha ao derivar palavras-chave por IA.", {
            cause: e,
         }),
   );
   if (keywordsResult.isErr()) throw keywordsResult.error;

   const used = new Set(siblingKeywords.map((k) => k.toLowerCase()));
   const keywords = keywordsResult.value.filter(
      (k) => !used.has(k.toLowerCase()),
   );

   if (keywords.length === 0) {
      DBOS.logger.warn(
         `${ctx} all derived keywords collide with siblings — skipping write`,
      );
      return;
   }

   const writeResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async () => {
                  const tx = classificationDataSource.client;
                  await tx
                     .update(categories)
                     .set({ keywords, keywordsUpdatedAt: new Date() })
                     .where(eq(categories.id, input.categoryId));
               },
               { name: "writeKeywords" },
            ),
         { name: "writeKeywords" },
      ),
      (e) =>
         WorkflowError.database("Falha ao gravar palavras-chave.", {
            cause: e,
         }),
   );
   if (writeResult.isErr()) throw writeResult.error;

   await DBOS.runStep(
      async () => {
         const logger = getLogger();
         const publish = await classificationSseEvents.publish(
            getClassificationRedis(),
            { kind: "team", id: input.teamId },
            {
               type: "classification.keywords_derived",
               payload: {
                  categoryId: input.categoryId,
                  categoryName: input.name,
                  count: keywords.length,
               },
            },
         );
         if (publish.isErr()) {
            logger.warn(
               {
                  err: publish.error,
                  categoryId: input.categoryId,
                  teamId: input.teamId,
               },
               "Failed to publish keywords_derived SSE event",
            );
         }
      },
      { name: "emitSse" },
   );

   await DBOS.runStep(
      async () => {
         const logger = getLogger();
         const result = await ingestUsageEvent({
            hyprpayClient: getClassificationHyprpay(),
            db: classificationDataSource.client,
            teamId: input.teamId,
            organizationId: input.organizationId,
            eventName: CLASSIFICATION_USAGE_EVENTS.aiKeywordDerived.eventName,
            quantity:
               CLASSIFICATION_USAGE_EVENTS.aiKeywordDerived.defaultQuantity,
            idempotencyKey: `derive-${input.categoryId}-${DBOS.workflowID ?? "no-wf"}`,
            properties: {
               categoryId: input.categoryId,
               keywordCount: keywords.length,
            },
         });
         if (result.isErr()) {
            logger.warn(
               { err: result.error, teamId: input.teamId },
               "usage ingestion failed for ai.keyword_derived",
            );
         }
      },
      { name: "ingestUsage" },
   );

   DBOS.logger.info(`${ctx} completed — wrote ${keywords.length} keywords`);
}

export const deriveKeywordsWorkflow = DBOS.registerWorkflow(
   deriveKeywordsWorkflowFn,
);

export const enqueueDeriveKeywordsWorkflow =
   createEnqueuer<DeriveKeywordsWorkflowInput>(
      deriveKeywordsWorkflowFn.name,
      CLASSIFICATION_QUEUES.deriveKeywords,
      (i) => `derive-category-${i.categoryId}`,
   );
