import { createSafeLogger } from "./logger";
import type { Logger, LogLevel } from "./types";

let serverLogger: Logger | null = null;

export interface ServerLoggerEnv {
   LOG_LEVEL?: LogLevel;
   POSTHOG_KEY?: string;
}

export function getServerLogger(env: ServerLoggerEnv): Logger {
   if (!serverLogger) {
      serverLogger = createSafeLogger({
         name: "montte-server",
         level: env.LOG_LEVEL || "info",
         enableOtel: !!env.POSTHOG_KEY,
      });
   }
   return serverLogger;
}

export function resetServerLogger(): void {
   serverLogger = null;
}
