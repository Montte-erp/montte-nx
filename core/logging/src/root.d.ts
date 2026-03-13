import type { Logger, LoggerConfig } from "@core/logging/types";
/** Initialize the root logger. Call once at app startup. */
export declare function initLogger(config: LoggerConfig): Logger;
/** Get the root logger. Falls back to a basic logger if not initialized. */
export declare function getLogger(): Logger;
//# sourceMappingURL=root.d.ts.map
