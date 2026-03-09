import type { Logger } from "pino";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export interface LoggerConfig {
   name: string;
   level?: LogLevel;
   /** When true, adds pino-opentelemetry-transport to send logs via OTel pipeline */
   enableOtel?: boolean;
}

export type { Logger };
