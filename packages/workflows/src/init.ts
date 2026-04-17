import { DBOS } from "@dbos-inc/dbos-sdk";
import { env } from "@core/environment/web";
import { getLogger } from "@core/logging/root";
import { backfillKeywordsWorkflow } from "./workflows/backfill-keywords.workflow";

const logger = getLogger().child({ module: "dbos" });

export function launchDBOS() {
   DBOS.setConfig({
      name: "montte-web",
      systemDatabaseUrl: env.DATABASE_URL,
      logLevel: env.LOG_LEVEL ?? "info",
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
      .catch((err) => {
         logger.error({ err }, "DBOS launch failed");
      });

   process.on("SIGTERM", () => void DBOS.shutdown());
   process.on("SIGINT", () => void DBOS.shutdown());
}
