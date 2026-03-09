import * as cron from "node-cron";
import type { DatabaseInstance } from "@core/database/client";
import type { Redis } from "ioredis";
import { emitCronLog } from "@core/logging/health";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "scheduler" });
import { generateBillOccurrences } from "./jobs/generate-bill-occurrences";
import { runReconcileCredits } from "./jobs/reconcile-credits";
import { runRefreshInsights } from "./jobs/refresh-insights";
import { runRefreshViews } from "./jobs/refresh-views";

const SERVICE_NAME = "montte-worker";

async function runWithTelemetry(
   taskName: string,
   fn: () => Promise<void>,
): Promise<void> {
   const start = Date.now();
   emitCronLog({ serviceName: SERVICE_NAME, taskName, event: "started" });
   try {
      await fn();
      emitCronLog({
         serviceName: SERVICE_NAME,
         taskName,
         event: "completed",
         durationMs: Date.now() - start,
      });
   } catch (error) {
      emitCronLog({
         serviceName: SERVICE_NAME,
         taskName,
         event: "failed",
         durationMs: Date.now() - start,
         error: error instanceof Error ? error.message : String(error),
      });
      logger.error({ err: error, taskName }, "Scheduled task failed");
   }
}

/**
 * Start all scheduled (cron) jobs.
 * Returns the cron tasks for graceful shutdown.
 */
export function startScheduler(
   db: DatabaseInstance,
   redis: Redis,
): cron.ScheduledTask[] {
   const tasks: cron.ScheduledTask[] = [];

   // Hourly: refresh materialized views, then reconcile credit counters
   const hourlyTask = cron.schedule("0 * * * *", async () => {
      await runWithTelemetry("hourly-billing-reconciliation", async () => {
         await runRefreshViews(db);
         await runReconcileCredits(db, redis);
      });
   });

   // Every 3 hours: refresh insight cached results
   const insightsTask = cron.schedule("0 */3 * * *", async () => {
      await runWithTelemetry("insight-cache-refresh", async () => {
         await runRefreshInsights(db);
      });
   });

   // Daily at 6am: generate upcoming bill occurrences for active recurrence groups
   const billRecurrenceTask = cron.schedule("0 6 * * *", async () => {
      await runWithTelemetry("bill-recurrence-generation", async () => {
         await generateBillOccurrences(db);
      });
   });

   tasks.push(hourlyTask, insightsTask, billRecurrenceTask);
   logger.info(
      "Cron jobs registered (hourly billing reconciliation, 3-hourly insight refresh, daily bill recurrence)",
   );

   return tasks;
}
