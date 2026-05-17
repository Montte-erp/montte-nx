import { trace } from "@opentelemetry/api";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";
import { PostHogSpanProcessor } from "@posthog/ai/otel";
import { initLogger as initEvlogLogger, log } from "evlog";
import type { DrainContext, LogLevel, RequestLogger } from "evlog";
import { createPostHogDrain } from "evlog/posthog";
import { createDrainPipeline, type PipelineDrainFn } from "evlog/pipeline";

type LoggerConfig = {
   name: string;
   level?: LogLevel;
   posthogKey: string;
   posthogHost: string;
};

export type { RequestLogger };
export { log };

let loggerDrain: PipelineDrainFn<DrainContext>;

export function initLogger(config: LoggerConfig): void {
   loggerDrain = createDrainPipeline<DrainContext>({
      batch: { size: 50, intervalMs: 5000 },
      retry: { maxAttempts: 3, backoff: "exponential", initialDelayMs: 1000 },
   })(
      createPostHogDrain({
         apiKey: config.posthogKey,
         host: config.posthogHost,
         mode: "logs",
      }),
   );

   initEvlogLogger({
      env: {
         service: config.name,
         environment: process.env.NODE_ENV ?? "development",
      },
      minLevel: config.level,
      drain: loggerDrain,
      pretty: process.env.NODE_ENV !== "production",
      redact: {
         paths: [
            "headers.authorization",
            "headers.cookie",
            "headers.set-cookie",
            "orpc.input.password",
            "orpc.input.token",
            "orpc.input.secret",
            "orpc.input.apiKey",
         ],
      },
      silent: false,
   });
}

export function flushLogger(): Promise<void> {
   return loggerDrain.flush();
}

export function getPostHogOtlpLogsEndpoint(posthogHost: string): string {
   return new URL("/i/v1/logs", posthogHost).toString();
}

export function configurePostHogOtlpHeaders(posthogKey: string): void {
   const authorization = `Authorization=Bearer%20${posthogKey}`;

   process.env.OTEL_EXPORTER_OTLP_HEADERS = authorization;
   process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS = authorization;
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
