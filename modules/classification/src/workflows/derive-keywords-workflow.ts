import { eq } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { categories } from "@core/database/schemas/categories";
import { tags } from "@core/database/schemas/tags";
import { WorkflowError } from "@core/dbos/errors";
import { getLogger } from "@core/logging/root";
import {
   emitAiKeywordDerived,
   emitAiTagKeywordDerived,
} from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import { deriveKeywords } from "../ai/derive-keywords";
import { classificationSseEvents } from "../sse/events";
import { CLASSIFICATION_QUEUES } from "../constants";
import {
   classificationDataSource,
   createEnqueuer,
   getClassificationPosthog,
   getClassificationRedis,
   getClassificationStripe,
} from "./context";

const MODEL = "deepseek/deepseek-v4-pro";

type CommonInput = {
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
   stripeCustomerId?: string | null;
};

export type DeriveKeywordsWorkflowInput =
   | (CommonInput & { entity: "category"; categoryId: string })
   | (CommonInput & { entity: "tag"; tagId: string });

function entityIdOf(input: DeriveKeywordsWorkflowInput): string {
   return input.entity === "category" ? input.categoryId : input.tagId;
}

function eventNameFor(input: DeriveKeywordsWorkflowInput): string {
   return input.entity === "category"
      ? "ai.keyword_derived"
      : "ai.tag_keyword_derived";
}

async function deriveKeywordsWorkflowFn(input: DeriveKeywordsWorkflowInput) {
   const entityId = entityIdOf(input);
   const ctx = `[derive-keywords] entity=${input.entity} id=${entityId} team=${input.teamId}`;
   DBOS.logger.info(`${ctx} started name="${input.name}"`);

   const redis = getClassificationRedis();
   const posthog = getClassificationPosthog();
   const stripeClient = getClassificationStripe();

   const budgetResult = await fromPromise(
      enforceCreditBudget(
         input.organizationId,
         eventNameFor(input),
         redis,
         input.stripeCustomerId,
      ),
      (e) =>
         WorkflowError.validation("Limite de créditos de IA excedido.", {
            cause: e,
         }),
   );
   if (budgetResult.isErr()) throw budgetResult.error;

   const keywordsResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const result = await deriveKeywords(
               {
                  entity: input.entity,
                  name: input.name,
                  description: input.description ?? null,
               },
               { posthog, distinctId: input.teamId },
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
   const keywords = keywordsResult.value;

   const writeResult = await fromPromise(
      DBOS.runStep(
         () =>
            classificationDataSource.runTransaction(
               async () => {
                  const tx = classificationDataSource.client;
                  if (input.entity === "category") {
                     await tx
                        .update(categories)
                        .set({ keywords, keywordsUpdatedAt: new Date() })
                        .where(eq(categories.id, input.categoryId));
                     return;
                  }
                  await tx
                     .update(tags)
                     .set({ keywords })
                     .where(eq(tags.id, input.tagId));
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

   const emitResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const db = classificationDataSource.client;
            const emit = createEmitFn(
               db,
               posthog,
               stripeClient ?? undefined,
               input.stripeCustomerId ?? undefined,
               redis,
            );
            const billingCtx = {
               organizationId: input.organizationId,
               teamId: input.teamId,
               userId: input.userId,
            };
            if (input.entity === "category") {
               await emitAiKeywordDerived(emit, billingCtx, {
                  categoryId: input.categoryId,
                  keywordCount: keywords.length,
                  model: MODEL,
                  latencyMs: 0,
               });
               return;
            }
            await emitAiTagKeywordDerived(emit, billingCtx, {
               tagId: input.tagId,
               keywordCount: keywords.length,
               model: MODEL,
               latencyMs: 0,
            });
         },
         { name: "emitBillingEvent" },
      ),
      (e) =>
         WorkflowError.internal("Falha ao registrar evento de cobrança.", {
            cause: e,
         }),
   );
   if (emitResult.isErr()) throw emitResult.error;

   await DBOS.runStep(
      async () => {
         const logger = getLogger();
         const publish = await classificationSseEvents.publish(
            redis,
            { kind: "team", id: input.teamId },
            {
               type: "classification.keywords_derived",
               payload: {
                  entity: input.entity,
                  entityId,
                  entityName: input.name,
                  count: keywords.length,
               },
            },
         );
         if (publish.isErr()) {
            logger.warn(
               {
                  err: publish.error,
                  entity: input.entity,
                  entityId,
                  teamId: input.teamId,
               },
               "Failed to publish keywords_derived SSE event",
            );
         }
      },
      { name: "emitSse" },
   );

   DBOS.logger.info(`${ctx} completed — wrote ${keywords.length} keywords`);
}

export const deriveKeywordsWorkflow = DBOS.registerWorkflow(
   deriveKeywordsWorkflowFn,
);

function buildWorkflowId(input: DeriveKeywordsWorkflowInput): string {
   return `derive-${input.entity}-${entityIdOf(input)}`;
}

export const enqueueDeriveKeywordsWorkflow =
   createEnqueuer<DeriveKeywordsWorkflowInput>(
      deriveKeywordsWorkflowFn.name,
      CLASSIFICATION_QUEUES.deriveKeywords,
      buildWorkflowId,
   );
