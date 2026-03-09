import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { DatabaseInstance } from "@core/database/client";
import { emitJobLog } from "@core/logging/health";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "worker:budget-alerts" });
import {
   BUDGET_ALERTS_QUEUE,
   type BudgetAlertJobData,
} from "@packages/queue/budget-alerts";
import { checkBudgetAlerts } from "../jobs/check-budget-alerts";

const SERVICE_NAME = "montte-worker";

export function startBudgetAlertsWorker(
   connection: ConnectionOptions,
   db: DatabaseInstance,
): Worker<BudgetAlertJobData> {
   const jobStartTimes = new Map<string, number>();

   const worker = new Worker<BudgetAlertJobData>(
      BUDGET_ALERTS_QUEUE,
      async (job) => {
         jobStartTimes.set(job.id ?? "", Date.now());
         emitJobLog({
            serviceName: SERVICE_NAME,
            jobName: BUDGET_ALERTS_QUEUE,
            jobId: job.id,
            event: "started",
         });
         await checkBudgetAlerts(db, job.data);
      },
      {
         connection,
         concurrency: 5,
      },
   );

   worker.on("completed", (job) => {
      const start = jobStartTimes.get(job.id ?? "");
      jobStartTimes.delete(job.id ?? "");
      emitJobLog({
         serviceName: SERVICE_NAME,
         jobName: BUDGET_ALERTS_QUEUE,
         jobId: job.id,
         event: "completed",
         durationMs: start ? Date.now() - start : undefined,
      });
   });

   worker.on("failed", (job, err) => {
      const start = jobStartTimes.get(job?.id ?? "");
      jobStartTimes.delete(job?.id ?? "");
      emitJobLog({
         serviceName: SERVICE_NAME,
         jobName: BUDGET_ALERTS_QUEUE,
         jobId: job?.id,
         event: "failed",
         durationMs: start ? Date.now() - start : undefined,
         error: err.message,
      });
   });

   logger.info("Budget alerts worker started");
   return worker;
}
