import type { Logger, LogLevel } from "@core/logging/types";
export interface ServerLoggerEnv {
   LOG_LEVEL?: LogLevel;
   POSTHOG_KEY?: string;
}
export declare function getServerLogger(env: ServerLoggerEnv): Logger;
export declare function resetServerLogger(): void;
//# sourceMappingURL=server.d.ts.map
