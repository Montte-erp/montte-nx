import { trace } from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";
import { PostHogSpanProcessor } from "@posthog/ai/otel";

export interface OtelConfig {
   serviceName: string;
   /** PostHog project token (phc_...) */
   posthogKey: string;
   /** PostHog host (e.g. https://us.i.posthog.com or your reverse proxy) */
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
