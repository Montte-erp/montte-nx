import { fromPromise } from "neverthrow";
import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import {
   findCategoryByKeywords,
   listCategories,
} from "@core/database/repositories/categories-repository";
import { updateTransactionCategory } from "@core/database/repositories/transactions-repository";
import { inferCategoryWithAI } from "@core/agents/actions/categorize";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../context";

export type CategorizationInput = {
   transactionId: string;
   teamId: string;
   name: string;
   type: "income" | "expense";
   contactName?: string | null;
};

const MODEL = "google/gemini-3.1-flash-lite-preview";

export const CATEGORIZATION_QUEUE_NAME = "workflow:categorize" as const;

export const categorizationQueue = new WorkflowQueue(
   CATEGORIZATION_QUEUE_NAME,
   {
      workerConcurrency: 10,
   },
);

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
            timestamp: new Date().toISOString(),
            type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
            status: "failed",
            message: msg,
            teamId,
         } satisfies JobNotification),
      { name: stepName },
   );
}

async function categorizationWorkflowFn(input: CategorizationInput) {
   const { db, posthog } = getDeps();
   const publisher = getPublisher();
   const ctx = `[categorization] tx=${input.transactionId} team=${input.teamId}`;

   DBOS.logger.info(`${ctx} started name="${input.name}"`);

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
            status: "started",
            message: `Categorizando transação "${input.name}"...`,
            teamId: input.teamId,
         } satisfies JobNotification),
      { name: "publishStarted" },
   );

   const keywordMatchResult = await fromPromise(
      DBOS.runStep(
         async () =>
            (
               await findCategoryByKeywords(db, input.teamId, {
                  name: input.name,
                  type: input.type,
               })
            ).match(
               (v) => v,
               (e) => {
                  throw e;
               },
            ),
         { name: "matchKeywords" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (keywordMatchResult.isErr()) {
      DBOS.logger.error(
         `${ctx} keyword match failed: ${keywordMatchResult.error}`,
      );
      await publishFailed(
         publisher,
         input.teamId,
         keywordMatchResult.error,
         "publishFailed",
      );
      return;
   }

   const keywordMatch = keywordMatchResult.value;

   if (keywordMatch) {
      await DBOS.runStep(
         () =>
            updateTransactionCategory(db, input.transactionId, {
               categoryId: keywordMatch.id,
            }).match(
               (v) => v,
               (e) => {
                  throw e;
               },
            ),
         { name: "applyCategory" },
      );
      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: new Date().toISOString(),
               type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
               status: "completed",
               message: `Transação "${input.name}" categorizada.`,
               payload: { transactionId: input.transactionId },
               teamId: input.teamId,
            } satisfies JobNotification),
         { name: "publishCompleted" },
      );
      DBOS.logger.info(`${ctx} completed via keyword match`);
      return;
   }

   const aiResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const catsResult = await listCategories(db, input.teamId, {
               type: input.type,
               includeArchived: false,
            });
            return catsResult.match(
               (cats) =>
                  inferCategoryWithAI(cats, input, MODEL, {
                     posthog,
                     distinctId: input.teamId,
                  }).match(
                     (v) => v,
                     (e) => {
                        throw e;
                     },
                  ),
               (e) => {
                  throw e;
               },
            );
         },
         { name: "inferWithAI" },
      ),
      (e) => (e instanceof Error ? e.message : String(e)),
   );

   if (aiResult.isErr()) {
      DBOS.logger.error(`${ctx} AI inference failed: ${aiResult.error}`);
      await publishFailed(
         publisher,
         input.teamId,
         aiResult.error,
         "publishFailed",
      );
      return;
   }

   const { categoryId } = aiResult.value;

   await DBOS.runStep(
      () =>
         updateTransactionCategory(db, input.transactionId, {
            suggestedCategoryId: categoryId,
         }).match(
            (v) => v,
            (e) => {
               throw e;
            },
         ),
      { name: "applyCategory" },
   );

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
            status: "completed",
            message: `Transação "${input.name}" categorizada.`,
            payload: { transactionId: input.transactionId },
            teamId: input.teamId,
         } satisfies JobNotification),
      { name: "publishCompleted" },
   );

   DBOS.logger.info(`${ctx} completed via AI inference`);
}

export const categorizationWorkflow = DBOS.registerWorkflow(
   categorizationWorkflowFn,
);
