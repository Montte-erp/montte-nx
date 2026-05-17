import {
   createLogger as createEvlogLogger,
   initLogger as initEvlogLogger,
} from "evlog";
import { trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";
import { PostHogSpanProcessor } from "@posthog/ai/otel";
import type {
   DrainContext,
   LogLevel as EvlogLogLevel,
   RequestLogger,
} from "evlog";
import { createPostHogDrain } from "evlog/posthog";
import { createDrainPipeline } from "evlog/pipeline";
import type { PostHog } from "posthog-node";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";
type LogFields = Record<string, unknown>;

export interface Logger {
   child(bindings: LogFields): Logger;
   trace(message: string): void;
   trace(fields: LogFields, message?: string): void;
   debug(message: string): void;
   debug(fields: LogFields, message?: string): void;
   info(message: string): void;
   info(fields: LogFields, message?: string): void;
   warn(message: string): void;
   warn(fields: LogFields, message?: string): void;
   error(message: string): void;
   error(fields: LogFields, message?: string): void;
   fatal(message: string): void;
   fatal(fields: LogFields, message?: string): void;
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

type LogInput = string | Record<string, unknown>;

function write(
   bindings: Record<string, unknown>,
   level: EvlogLogLevel,
   first: LogInput,
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
      trace(first: LogInput, message?: string) {
         write(loggerBindings, "debug", first, message);
      },
      debug(first: LogInput, message?: string) {
         write(loggerBindings, "debug", first, message);
      },
      info(first: LogInput, message?: string) {
         write(loggerBindings, "info", first, message);
      },
      warn(first: LogInput, message?: string) {
         write(loggerBindings, "warn", first, message);
      },
      error(first: LogInput, message?: string) {
         write(loggerBindings, "error", first, message);
      },
      fatal(first: LogInput, message?: string) {
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

let rootLogger: Logger | null = null;

export function initLogger(config: LoggerConfig): Logger {
   rootLogger = createSafeLogger(config);
   return rootLogger;
}

export function getLogger(): Logger {
   if (!rootLogger) {
      rootLogger = createSafeLogger({ name: "montte" });
   }
   return rootLogger;
}

export interface OtelConfig {
   serviceName: string;
   posthogKey: string;
   posthogHost: string;
}

let sdk: NodeSDK | null = null;

export function initOtel(config: OtelConfig): NodeSDK {
   if (sdk) return sdk;

   const host = config.posthogHost.replace(/\/$/, "");
   const headers = { Authorization: `Bearer ${config.posthogKey}` };

   sdk = new NodeSDK({
      resource: resourceFromAttributes({
         "service.name": config.serviceName,
      }),
      instrumentations: [new ORPCInstrumentation()],
      spanProcessors: [
         new PostHogSpanProcessor({
            apiKey: config.posthogKey,
            host,
         }),
      ],
      logRecordProcessors: [
         new BatchLogRecordProcessor(
            new OTLPLogExporter({
               url: `${host}/i/v1/logs`,
               headers,
            }),
         ),
      ],
   });

   sdk.start();
   return sdk;
}

export function getAiTracer() {
   return trace.getTracer("montte-ai");
}

export async function shutdownOtel(): Promise<void> {
   if (sdk) {
      await sdk.shutdown();
      sdk = null;
   }
}

const healthLogger = logs.getLogger("health");

export interface HealthConfig {
   serviceName: string;
   posthog: PostHog;
   intervalMs?: number;
}

let healthInterval: ReturnType<typeof setInterval> | null = null;
let startTime: number | null = null;

export function startHealthHeartbeat(config: HealthConfig): void {
   if (healthInterval) return;

   const interval = config.intervalMs ?? 60_000;
   startTime = Date.now();

   const emit = () => {
      const mem = process.memoryUsage();
      const uptimeMs = Date.now() - (startTime ?? Date.now());

      const properties = {
         serviceName: config.serviceName,
         uptimeMs,
         heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
         heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
         rssMb: Math.round(mem.rss / 1024 / 1024),
         externalMb: Math.round(mem.external / 1024 / 1024),
      };

      healthLogger.emit({
         severityText: "info",
         body: `health heartbeat: ${config.serviceName}`,
         attributes: {
            "service.name": config.serviceName,
            "health.uptimeMs": uptimeMs,
            "health.heapUsedMb": properties.heapUsedMb,
            "health.heapTotalMb": properties.heapTotalMb,
            "health.rssMb": properties.rssMb,
            "health.externalMb": properties.externalMb,
         },
      });

      config.posthog.capture({
         distinctId: `service:${config.serviceName}`,
         event: "health_heartbeat",
         properties,
      });
   };

   emit();
   healthInterval = setInterval(emit, interval);
}

export function stopHealthHeartbeat(): void {
   if (healthInterval) {
      clearInterval(healthInterval);
      healthInterval = null;
   }
}
