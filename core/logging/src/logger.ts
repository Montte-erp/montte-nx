import {
   createLogger as createEvlogLogger,
   initLogger as initEvlogLogger,
} from "evlog";
import type { DrainContext, LogLevel as EvlogLogLevel } from "evlog";
import { createPostHogDrain } from "evlog/posthog";
import { createDrainPipeline } from "evlog/pipeline";
import type { Logger, LoggerConfig } from "@core/logging/types";

function toEvlogLevel(level: LoggerConfig["level"]): EvlogLogLevel {
   if (level === "trace") return "debug";
   if (level === "fatal") return "error";
   return level ?? "info";
}

function createDrain(config: LoggerConfig) {
   const drains: Array<(ctx: DrainContext | DrainContext[]) => Promise<void>> =
      [];

   if (config.posthog) {
      drains.push(
         createPostHogDrain({
            apiKey: config.posthog.apiKey,
            host: config.posthog.host,
            mode: "logs",
         }),
      );
   }

   if (drains.length === 0) return undefined;

   const pipeline = createDrainPipeline<DrainContext>({
      batch: { size: 50, intervalMs: 5000 },
      retry: { maxAttempts: 3, backoff: "exponential", initialDelayMs: 1000 },
   });

   return pipeline(async (batch) => {
      await Promise.all(drains.map((drain) => drain(batch)));
   });
}

function toFields(input: unknown): Record<string, unknown> {
   if (!input || typeof input !== "object" || Array.isArray(input)) return {};
   return Object.fromEntries(Object.entries(input));
}

function write(
   bindings: Record<string, unknown>,
   level: EvlogLogLevel,
   first: string | Record<string, unknown>,
   message?: string,
) {
   const log = createEvlogLogger(bindings);
   if (typeof first === "string") {
      if (level === "error") log.error(first);
      else if (level === "warn") log.warn(first);
      else log.info(first);
      log.emit();
      return;
   }

   const fields = toFields(first);
   const text = message ?? "log event";
   const { err, ...rest } = fields;

   if (level === "error") {
      if (err instanceof Error) log.error(err, rest);
      else log.error(text, fields);
   } else if (level === "warn") {
      log.warn(text, fields);
   } else {
      log.info(text, fields);
   }

   log.emit();
}

function createCompatLogger(
   config: LoggerConfig,
   bindings: Record<string, unknown> = {},
): Logger {
   const loggerBindings = { service: config.name, ...bindings };

   return {
      child(childBindings) {
         return createCompatLogger(config, {
            ...loggerBindings,
            ...childBindings,
         });
      },
      trace(first, message) {
         write(loggerBindings, "debug", first, message);
      },
      debug(first, message) {
         write(loggerBindings, "debug", first, message);
      },
      info(first, message) {
         write(loggerBindings, "info", first, message);
      },
      warn(first, message) {
         write(loggerBindings, "warn", first, message);
      },
      error(first, message) {
         write(loggerBindings, "error", first, message);
      },
      fatal(first, message) {
         write(loggerBindings, "error", first, message);
      },
   };
}

export function configureEvlog(config: LoggerConfig): void {
   const drain = createDrain(config);

   initEvlogLogger({
      env: {
         service: config.name,
         environment: process.env.NODE_ENV ?? "development",
      },
      minLevel: toEvlogLevel(config.level),
      drain,
      pretty: process.env.NODE_ENV !== "production",
      redact: process.env.NODE_ENV === "production",
      silent: false,
      _suppressDrainWarning: !drain,
   });
}

export function createLogger(config: LoggerConfig): Logger {
   configureEvlog(config);
   return createCompatLogger(config);
}

export function createSafeLogger(config: LoggerConfig): Logger {
   try {
      return createLogger(config);
   } catch {
      configureEvlog({
         name: config.name,
         level: config.level,
         posthog: undefined,
      });
      return createCompatLogger({
         name: config.name,
         level: config.level,
      });
   }
}

export type { Logger, LoggerConfig, LogLevel } from "@core/logging/types";
