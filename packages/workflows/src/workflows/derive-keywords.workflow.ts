import dayjs from "dayjs";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { updateCategory } from "@core/database/repositories/categories-repository";
import { emitAiKeywordDerived } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import { deriveKeywordsWithAI } from "@core/agents/actions/keywords";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../context";

const MODEL = "google/gemini-3.1-flash-lite-preview";

export type DeriveKeywordsInput = {
   categoryId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
   stripeCustomerId?: string | null;
};

async function deriveKeywordsWorkflowFn(input: DeriveKeywordsInput) {
   const { db, redis, posthog, stripeClient } = getDeps();
   const publisher = getPublisher();
   const ctx = `[derive-keywords] category=${input.categoryId} team=${input.teamId}`;

   DBOS.logger.info(`${ctx} started name="${input.name}"`);

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            status: "started",
            message: `Gerando palavras-chave para ${input.name}...`,
            teamId: input.teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: "publishStarted" },
   );

   try {
      await DBOS.runStep(
         () =>
            enforceCreditBudget(
               input.organizationId,
               "ai.keyword_derived",
               redis,
               input.stripeCustomerId,
            ),
         { name: "enforceBudget" },
      );
   } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      DBOS.logger.warn(`${ctx} budget exceeded: ${msg}`);
      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
               status: "failed",
               message: msg,
               teamId: input.teamId,
               timestamp: dayjs().toISOString(),
            } satisfies JobNotification),
         { name: "publishFailed" },
      );
      return;
   }

   let keywords: string[];
   try {
      keywords = await DBOS.runStep(
         () =>
            deriveKeywordsWithAI({
               name: input.name,
               description: input.description,
               model: MODEL,
            }),
         { name: "deriveKeywords" },
      );
      DBOS.logger.info(
         `${ctx} derived ${keywords.length} keywords: [${keywords.join(", ")}]`,
      );
   } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      DBOS.logger.error(`${ctx} derive failed: ${msg}`);
      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
               status: "failed",
               message: msg,
               teamId: input.teamId,
               timestamp: dayjs().toISOString(),
            } satisfies JobNotification),
         { name: "publishFailed" },
      );
      return;
   }

   try {
      await DBOS.runStep(
         async () => {
            (await updateCategory(db, input.categoryId, { keywords })).match(
               () => null,
               (e) => {
                  throw e;
               },
            );
         },
         { name: "saveKeywords" },
      );
      DBOS.logger.info(`${ctx} saved`);
   } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      DBOS.logger.error(`${ctx} save failed: ${msg}`);
      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
               status: "failed",
               message: msg,
               teamId: input.teamId,
               timestamp: dayjs().toISOString(),
            } satisfies JobNotification),
         { name: "publishFailed" },
      );
      return;
   }

   await DBOS.runStep(
      async () => {
         const emit = createEmitFn(
            db,
            posthog,
            stripeClient,
            input.stripeCustomerId ?? undefined,
            redis,
         );
         await emitAiKeywordDerived(
            emit,
            {
               organizationId: input.organizationId,
               teamId: input.teamId,
               userId: input.userId,
            },
            {
               categoryId: input.categoryId,
               keywordCount: keywords.length,
               model: MODEL,
               latencyMs: 0,
            },
         );
      },
      { name: "emitBilling" },
   );

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            status: "completed",
            message: `Palavras-chave geradas para ${input.name}.`,
            payload: {
               categoryId: input.categoryId,
               categoryName: input.name,
               count: keywords.length,
            },
            teamId: input.teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: "publishCompleted" },
   );

   DBOS.logger.info(`${ctx} completed`);
}

export const deriveKeywordsWorkflow = DBOS.registerWorkflow(
   deriveKeywordsWorkflowFn,
);
