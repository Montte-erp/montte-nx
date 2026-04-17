import { DBOS } from "@dbos-inc/dbos-sdk";
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

async function categorizationWorkflowFn(input: CategorizationInput) {
   const { db } = getDeps();
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

   let keywordMatch: { id: string } | null;
   try {
      keywordMatch = await DBOS.runStep(
         async () => {
            const result = await findCategoryByKeywords(db, input.teamId, {
               name: input.name,
               type: input.type,
            });
            if (result.isErr()) throw result.error;
            return result.value;
         },
         { name: "matchKeywords" },
      );
   } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      DBOS.logger.error(`${ctx} keyword match failed: ${msg}`);
      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: new Date().toISOString(),
               type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
               status: "failed",
               message: msg,
               teamId: input.teamId,
            } satisfies JobNotification),
         { name: "publishFailed" },
      );
      return;
   }

   if (keywordMatch) {
      await DBOS.runStep(
         () =>
            updateTransactionCategory(db, input.transactionId, {
               categoryId: keywordMatch.id,
            }),
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

   let aiResult: { categoryId: string; confidence: "high" | "low" } | null;
   try {
      aiResult = await DBOS.runStep(
         async () => {
            const catsResult = await listCategories(db, input.teamId, {
               type: input.type,
               includeArchived: false,
            });
            if (catsResult.isErr()) throw catsResult.error;
            return inferCategoryWithAI(catsResult.value, input, MODEL);
         },
         { name: "inferWithAI" },
      );
   } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      DBOS.logger.error(`${ctx} AI inference failed: ${msg}`);
      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: new Date().toISOString(),
               type: NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED,
               status: "failed",
               message: msg,
               teamId: input.teamId,
            } satisfies JobNotification),
         { name: "publishFailed" },
      );
      return;
   }

   if (!aiResult) {
      DBOS.logger.info(`${ctx} no category match found`);
      return;
   }

   await DBOS.runStep(
      () =>
         updateTransactionCategory(
            db,
            input.transactionId,
            aiResult.confidence === "high"
               ? { categoryId: aiResult.categoryId }
               : { suggestedCategoryId: aiResult.categoryId },
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
