import type { Logger, LogLevel } from "@core/logging/types";
export interface WorkerLoggerEnv {
   LOG_LEVEL?: LogLevel;
   POSTHOG_KEY?: string;
}
export declare function getWorkerLogger(env: WorkerLoggerEnv): Logger;
export declare function resetWorkerLogger(): void;
//# sourceMappingURL=worker.d.ts.map
