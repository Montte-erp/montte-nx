import { createSafeLogger } from "./logger";
import type { Logger, LoggerConfig } from "./types";

let rootLogger: Logger | null = null;

/** Initialize the root logger. Call once at app startup. */
export function initLogger(config: LoggerConfig): Logger {
   rootLogger = createSafeLogger(config);
   return rootLogger;
}

/** Get the root logger. Falls back to a basic logger if not initialized. */
export function getLogger(): Logger {
   if (!rootLogger) {
      rootLogger = createSafeLogger({ name: "montte" });
   }
   return rootLogger;
}
