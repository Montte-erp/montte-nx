import { DBOS } from "@dbos-inc/dbos-sdk";
import { getWorkerLogger } from "@core/logging/worker";
import { initContext } from "./context";
import type { WorkflowDeps } from "./context";
import { categorizationWorkflow } from "./workflows/categorization.workflow";
import { deriveKeywordsWorkflow } from "./workflows/derive-keywords.workflow";
import { backfillKeywordsWorkflow } from "./workflows/backfill-keywords.workflow";
import { WORKFLOW_QUEUE_KEYS } from "./queue";
import type { CategorizationInput } from "./workflows/categorization.workflow";
import type { DeriveKeywordsInput } from "./workflows/derive-keywords.workflow";

type LaunchConfig = WorkflowDeps & {
   systemDatabaseUrl: string;
   logLevel?: string;
   onShutdown?: () => Promise<void>;
};

let running = false;
const consumerConns: WorkflowDeps["redis"][] = [];

export function launchDBOS({
   systemDatabaseUrl,
   logLevel,
   onShutdown,
   ...deps
}: LaunchConfig) {
   const logger = getWorkerLogger({
      LOG_LEVEL: (logLevel as "info") ?? "info",
   });

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
         running = true;
         await DBOS.applySchedules([
            {
               scheduleName: "backfill-keywords-daily",
               workflowFn: backfillKeywordsWorkflow,
               schedule: "0 3 * * *",
            },
         ]);
         startConsumerLoops(deps.redis, logger);
      })
      .catch((err: unknown) => {
         logger.error({ err }, "DBOS launch failed");
      });

   async function gracefulShutdown(signal: string) {
      logger.info(`${signal} received — shutting down`);
      running = false;

      for (const conn of consumerConns) {
         conn.disconnect();
      }

      await DBOS.shutdown();
      await onShutdown?.();
      logger.info("Shutdown complete");
      process.exit(0);
   }

   process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
   process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
}

function startConsumerLoops(
   redis: WorkflowDeps["redis"],
   logger: ReturnType<typeof getWorkerLogger>,
) {
   const categorizeConn = redis.duplicate();
   const deriveConn = redis.duplicate();

   consumerConns.push(categorizeConn, deriveConn);

   void runConsumerLoop<CategorizationInput>(
      categorizeConn,
      WORKFLOW_QUEUE_KEYS.categorize,
      async (input) => {
         await DBOS.startWorkflow(categorizationWorkflow, {
            workflowID: `categorize-${input.transactionId}`,
         })(input);
      },
      logger,
   );

   void runConsumerLoop<DeriveKeywordsInput>(
      deriveConn,
      WORKFLOW_QUEUE_KEYS.deriveKeywords,
      async (input) => {
         await DBOS.startWorkflow(deriveKeywordsWorkflow)(input);
      },
      logger,
   );
}

async function runConsumerLoop<T>(
   conn: WorkflowDeps["redis"],
   key: string,
   handler: (input: T) => Promise<void>,
   logger: ReturnType<typeof getWorkerLogger>,
) {
   while (running) {
      const result = await conn.blpop(key, 1).catch(() => null);
      if (!result) continue;
      const [, raw] = result;
      try {
         const input = JSON.parse(raw) as T;
         await handler(input);
      } catch (err) {
         logger.error({ err }, `Failed to process job from ${key}`);
      }
   }
}
