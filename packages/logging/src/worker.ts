import { createSafeLogger } from "./logger";
import type { Logger, LogLevel } from "./types";

let workerLogger: Logger | null = null;

export interface WorkerLoggerEnv {
   LOG_LEVEL?: LogLevel;
   POSTHOG_KEY?: string;
}

export function getWorkerLogger(env: WorkerLoggerEnv): Logger {
   if (!workerLogger) {
      workerLogger = createSafeLogger({
         name: "montte-worker",
         level: env.LOG_LEVEL || "info",
         enableOtel: !!env.POSTHOG_KEY,
      });
   }
   return workerLogger;
}

export function resetWorkerLogger(): void {
   workerLogger = null;
}
