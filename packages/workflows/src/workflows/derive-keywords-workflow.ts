import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import dayjs from "dayjs";
import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { updateCategory } from "@core/database/repositories/categories-repository";
import { emitAiKeywordDerived } from "@packages/events/ai";
import { createEmitFn } from "@packages/events/emit";
import { enforceCreditBudget } from "@packages/events/credits";
import { deriveKeywordsWithAI } from "@core/agents/actions/keywords";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../context";

const MODEL = "google/gemini-3.1-flash-lite-preview";

export const deriveKeywordsQueue = new WorkflowQueue(
   "workflow:derive-keywords",
   {
      workerConcurrency: 5,
   },
);

export type DeriveKeywordsInput = {
   categoryId: string;
   teamId: string;
   organizationId: string;
   name: string;
   description?: string | null;
   userId?: string;
   stripeCustomerId?: string | null;
};

async function publishFailed(
   publisher: ReturnType<typeof getPublisher>,
   teamId: string,
   msg: string,
   stepName: string,
) {
   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            type: NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            status: "failed",
            message: msg,
            teamId,
            timestamp: dayjs().toISOString(),
         } satisfies JobNotification),
      { name: stepName },
   );
}

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

   const budgetResult = await fromPromise(
      DBOS.runStep(
         () =>
            enforceCreditBudget(
               input.organizationId,
               "ai.keyword_derived",
               redis,
               input.stripeCustomerId,
            ),
         { name: "enforceBudget" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (budgetResult.isErr()) {
      DBOS.logger.warn(`${ctx} budget exceeded: ${budgetResult.error}`);
      await publishFailed(
         publisher,
         input.teamId,
         budgetResult.error,
         "publishFailed",
      );
      return;
   }

   const keywordsResult = await fromPromise(
      DBOS.runStep(
         () =>
            deriveKeywordsWithAI({
               name: input.name,
               description: input.description,
               model: MODEL,
            }).match(
               (v) => v,
               (e) => {
                  throw e;
               },
            ),
         { name: "deriveKeywords" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (keywordsResult.isErr()) {
      DBOS.logger.error(`${ctx} derive failed: ${keywordsResult.error}`);
      await publishFailed(
         publisher,
         input.teamId,
         keywordsResult.error,
         "publishFailed",
      );
      return;
   }

   const keywords = keywordsResult.value;
   DBOS.logger.info(
      `${ctx} derived ${keywords.length} keywords: [${keywords.join(", ")}]`,
   );

   const saveResult = await fromPromise(
      DBOS.runStep(
         async () =>
            (await updateCategory(db, input.categoryId, { keywords })).match(
               () => null,
               (e) => {
                  throw e;
               },
            ),
         { name: "saveKeywords" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (saveResult.isErr()) {
      DBOS.logger.error(`${ctx} save failed: ${saveResult.error}`);
      await publishFailed(
         publisher,
         input.teamId,
         saveResult.error,
         "publishFailed",
      );
      return;
   }

   DBOS.logger.info(`${ctx} saved`);

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

export async function enqueueDeriveKeywordsWorkflow(
   client: DBOSClient,
   input: DeriveKeywordsInput,
): Promise<void> {
   await client.enqueue(
      {
         workflowName: deriveKeywordsWorkflowFn.name,
         queueName: deriveKeywordsQueue.name,
      },
      input,
   );
}
