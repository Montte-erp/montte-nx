import { DBOS } from "@dbos-inc/dbos-sdk";
import { getLogger } from "@core/logging/root";
import type { WorkflowDeps } from "./context";

type LaunchConfig = WorkflowDeps & {
   systemDatabaseUrl: string;
   logLevel?: string;
   onLaunch?: () => Promise<void>;
   onShutdown?: () => Promise<void>;
};

export function launchDBOS({
   systemDatabaseUrl,
   logLevel,
   onLaunch,
   onShutdown,
}: LaunchConfig) {
   const logger = getLogger();

   DBOS.setConfig({
      name: "montte-web",
      systemDatabaseUrl,
      logLevel: logLevel ?? "info",
      runAdminServer: false,
   });

   DBOS.launch()
      .then(async () => {
         logger.info("DBOS runtime started");
         await onLaunch?.();
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
