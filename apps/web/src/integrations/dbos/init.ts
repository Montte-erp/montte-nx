import { DBOS } from "@dbos-inc/dbos-sdk";
import { env } from "@core/environment/web";
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "dbos" });

export function launchDBOS() {
   DBOS.setConfig({
      name: "montte-web",
      systemDatabaseUrl: env.DATABASE_URL,
      logLevel: env.LOG_LEVEL ?? "info",
   });

   DBOS.launch()
      .then(() => {
         logger.info("DBOS runtime started");
      })
      .catch((err) => {
         logger.error({ err }, "DBOS launch failed");
      });

   process.on("SIGTERM", () => void DBOS.shutdown());
   process.on("SIGINT", () => void DBOS.shutdown());
}
