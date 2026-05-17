import type { RequestLogger } from "evlog";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

type LogFields = Record<string, unknown>;

export interface Logger {
   child(bindings: LogFields): Logger;
   trace(messageOrFields: string | LogFields, message?: string): void;
   debug(messageOrFields: string | LogFields, message?: string): void;
   info(messageOrFields: string | LogFields, message?: string): void;
   warn(messageOrFields: string | LogFields, message?: string): void;
   error(messageOrFields: string | LogFields, message?: string): void;
   fatal(messageOrFields: string | LogFields, message?: string): void;
}

export interface LoggerConfig {
   name: string;
   level?: LogLevel;
   posthog?: {
      apiKey: string;
      host: string;
   };
}

export type { RequestLogger };
