import { DBOS } from "@dbos-inc/dbos-sdk";
import { getLogger } from "@core/logging/root";
import { initContext } from "./context";
import type { WorkflowDeps } from "./context";
import { backfillKeywordsWorkflow } from "./workflows/backfill-keywords-workflow";
import "./workflows/categorization-workflow";
import "./workflows/derive-keywords-workflow";
import "./workflows/derive-tag-keywords-workflow";
import "./workflows/suggest-tag-workflow";
import "./workflows/billing/usage-ingestion-workflow";
import "./workflows/billing/benefit-lifecycle-workflow";
import "./workflows/billing/period-end-invoice-workflow";
import { createAllQueues } from "./workflow-factory";

createAllQueues({ workerConcurrency: 10 });

type LaunchConfig = WorkflowDeps & {
   systemDatabaseUrl: string;
   logLevel?: string;
   onShutdown?: () => Promise<void>;
};

export function launchDBOS({
   systemDatabaseUrl,
   logLevel,
   onShutdown,
   ...deps
}: LaunchConfig) {
   const logger = getLogger();

   initContext(deps);

   DBOS.setConfig({
      name: "montte-web",
      systemDatabaseUrl,
      logLevel: logLevel ?? "info",
      runAdminServer: false,
   });

   DBOS.launch()
      .then(async () => {
         logger.info("DBOS runtime started");
         await DBOS.applySchedules([
            {
               scheduleName: "backfill-keywords-daily",
               workflowFn: backfillKeywordsWorkflow,
               schedule: "0 3 * * *",
            },
         ]);
      })
      .catch((err: unknown) => {
         logger.error({ err }, "DBOS launch failed");
      });

   async function gracefulShutdown(signal: string) {
      logger.info(`${signal} received — shutting down`);
      await DBOS.shutdown();
      await onShutdown?.();
      logger.info("Shutdown complete");
      process.exit(0);
   }

   process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
   process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
}
