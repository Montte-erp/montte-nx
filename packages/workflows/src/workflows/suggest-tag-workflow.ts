import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { DBOS, WorkflowQueue } from "@dbos-inc/dbos-sdk";
import dayjs from "dayjs";
import {
   findTagByKeywords,
   listTags,
} from "@core/database/repositories/tags-repository";
import { updateTransactionTag } from "@core/database/repositories/transactions-repository";
import { inferTagWithAI } from "@core/agents/actions/suggest-tag";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../context";

export type SuggestTagInput = {
   transactionId: string;
   teamId: string;
   name: string;
};

const MODEL = "google/gemini-3.1-flash-lite-preview";

export const suggestTagQueue = new WorkflowQueue("workflow:suggest-tag", {
   workerConcurrency: 10,
});

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
            timestamp: dayjs().toISOString(),
            type: NOTIFICATION_TYPES.AI_TAG_SUGGESTED,
            status: "failed",
            message: msg,
            teamId,
         } satisfies JobNotification),
      { name: stepName },
   );
}

async function suggestTagWorkflowFn(input: SuggestTagInput) {
   const { db, posthog } = getDeps();
   const publisher = getPublisher();
   const ctx = `[suggest-tag] tx=${input.transactionId} team=${input.teamId}`;

   DBOS.logger.info(`${ctx} started name="${input.name}"`);

   const keywordMatchResult = await fromPromise(
      DBOS.runStep(
         async () =>
            (await findTagByKeywords(db, input.teamId, input.name)).match(
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
            updateTransactionTag(db, input.transactionId, {
               suggestedTagId: keywordMatch.id,
            }),
         { name: "applyTag" },
      );
      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: dayjs().toISOString(),
               type: NOTIFICATION_TYPES.AI_TAG_SUGGESTED,
               status: "completed",
               message: `Centro de custo sugerido para "${input.name}".`,
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
            const tagsResult = await listTags(db, input.teamId, {
               includeArchived: false,
            });
            if (tagsResult.isErr()) throw tagsResult.error;
            const inferResult = await inferTagWithAI(
               tagsResult.value,
               input.name,
               MODEL,
               { posthog, distinctId: input.teamId },
            );
            if (inferResult.isErr()) throw inferResult.error;
            return inferResult.value;
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

   const tagId = aiResult.value;

   if (!tagId) {
      DBOS.logger.info(`${ctx} AI returned no suggestion, skipping`);
      return;
   }

   await DBOS.runStep(
      () =>
         updateTransactionTag(db, input.transactionId, {
            suggestedTagId: tagId,
         }),
      { name: "applyTag" },
   );

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            timestamp: dayjs().toISOString(),
            type: NOTIFICATION_TYPES.AI_TAG_SUGGESTED,
            status: "completed",
            message: `Centro de custo sugerido para "${input.name}".`,
            payload: { transactionId: input.transactionId },
            teamId: input.teamId,
         } satisfies JobNotification),
      { name: "publishCompleted" },
   );

   DBOS.logger.info(`${ctx} completed via AI inference`);
}

export const suggestTagWorkflow = DBOS.registerWorkflow(suggestTagWorkflowFn);

export async function enqueueSuggestTagWorkflow(
   client: DBOSClient,
   input: SuggestTagInput,
): Promise<void> {
   await client.enqueue(
      {
         workflowName: suggestTagWorkflowFn.name,
         queueName: suggestTagQueue.name,
         workflowID: `suggest-tag-${input.transactionId}`,
      },
      input,
   );
}
