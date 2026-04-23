import { DBOS } from "@dbos-inc/dbos-sdk";
import dayjs from "dayjs";
import { createEnqueuer, QUEUES } from "@packages/workflows/workflow-factory";
import { upsertUsageEvent } from "@modules/billing/db/usage-events";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "@packages/workflows/context";

export type UsageIngestionInput = {
   teamId: string;
   meterId: string;
   quantity: string;
   idempotencyKey: string;
   contactId?: string;
   properties?: Record<string, unknown>;
};

async function usageIngestionWorkflowFn(input: UsageIngestionInput) {
   const { db } = getDeps();
   const publisher = getPublisher();
   const ctx = `[usage-ingestion] team=${input.teamId} idem=${input.idempotencyKey}`;
   DBOS.logger.info(`${ctx} started`);

   const result = await DBOS.runStep(
      () =>
         upsertUsageEvent(db, {
            teamId: input.teamId,
            meterId: input.meterId,
            quantity: input.quantity,
            idempotencyKey: input.idempotencyKey,
            contactId: input.contactId ?? null,
            properties: input.properties ?? {},
         }).match(
            (v) => v,
            (e) => {
               throw e;
            },
         ),
      { name: "upsertUsageEvent" },
   );

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: input.idempotencyKey,
            timestamp: dayjs().toISOString(),
            type: NOTIFICATION_TYPES.BILLING_USAGE_INGESTED,
            status: "completed",
            message: `Uso registrado para medidor ${input.meterId}.`,
            teamId: input.teamId,
            payload: {
               meterId: input.meterId,
               idempotencyKey: input.idempotencyKey,
            },
         } satisfies JobNotification),
      { name: "publishCompleted" },
   );

   DBOS.logger.info(`${ctx} completed — row=${result?.id ?? "duplicate"}`);
}

export const usageIngestionWorkflow = DBOS.registerWorkflow(
   usageIngestionWorkflowFn,
);

export const enqueueUsageIngestionWorkflow =
   createEnqueuer<UsageIngestionInput>(
      usageIngestionWorkflowFn.name,
      QUEUES.usageIngestion,
      (i) => `usage-ingest-${i.teamId}-${i.idempotencyKey}`,
   );
