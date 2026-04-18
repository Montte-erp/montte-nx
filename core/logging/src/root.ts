import { createSafeLogger } from "./logger";
import type { Logger, LoggerConfig } from "@core/logging/types";

let rootLogger: Logger | null = null;

export function initLogger(config: LoggerConfig): Logger {
   rootLogger = createSafeLogger(config);
   return rootLogger;
}

export function getLogger(): Logger {
   if (!rootLogger) {
      rootLogger = createSafeLogger({ name: "montte" });
   }
   return rootLogger;
}
