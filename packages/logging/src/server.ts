import { createSafeLogger } from "./logger";
import type { Logger, LogLevel } from "./types";

let serverLogger: Logger | null = null;

export interface ServerLoggerEnv {
   LOGTAIL_ENDPOINT?: string;
   LOGTAIL_SOURCE_TOKEN?: string;
   LOG_LEVEL?: LogLevel;
   POSTHOG_KEY?: string;
}

export function getServerLogger(env: ServerLoggerEnv): Logger {
   if (!serverLogger) {
      serverLogger = createSafeLogger({
         name: "montte-server",
         logtailToken: env.LOGTAIL_SOURCE_TOKEN,
         logtailEndpoint: env.LOGTAIL_ENDPOINT,
         level: env.LOG_LEVEL || "info",
         enableOtel: !!env.POSTHOG_KEY,
      });
   }
   return serverLogger;
}

export function resetServerLogger(): void {
   serverLogger = null;
}
