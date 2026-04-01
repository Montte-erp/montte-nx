import * as cron from "node-cron";
import type { DatabaseInstance } from "@core/database/client";
import { emitCronLog } from "@core/logging/health";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "scheduler" });
import { generateBillOccurrences } from "./jobs/generate-bill-occurrences";
import { generateTransactionOccurrences } from "./jobs/generate-transaction-occurrences";
import { runRefreshInsights } from "./jobs/refresh-insights";

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

export function startScheduler(db: DatabaseInstance): cron.ScheduledTask[] {
   const tasks: cron.ScheduledTask[] = [];

   const insightsTask = cron.schedule("0 */3 * * *", async () => {
      await runWithTelemetry("insight-cache-refresh", async () => {
         await runRefreshInsights(db);
      });
   });

   const billRecurrenceTask = cron.schedule("0 6 * * *", async () => {
      await runWithTelemetry("bill-recurrence-generation", async () => {
         await generateBillOccurrences();
      });
   });

   const transactionRecurrenceTask = cron.schedule("30 6 * * *", async () => {
      await runWithTelemetry("transaction-recurrence-generation", async () => {
         await generateTransactionOccurrences();
      });
   });

   tasks.push(insightsTask, billRecurrenceTask, transactionRecurrenceTask);
   logger.info(
      "Cron jobs registered (3-hourly insight refresh, daily bill recurrence, daily transaction recurrence)",
   );

   return tasks;
}
