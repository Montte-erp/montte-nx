import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ORPCInstrumentation } from "@orpc/otel";

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

   sdk = new NodeSDK({
      resource: resourceFromAttributes({
         "service.name": config.serviceName,
      }),
      instrumentations: [new ORPCInstrumentation()],
      logRecordProcessors: [
         new BatchLogRecordProcessor(
            new OTLPLogExporter({
               url: `${config.posthogHost.replace(/\/$/, "")}/i/v1/logs`,
               headers: {
                  Authorization: `Bearer ${config.posthogKey}`,
               },
            }),
         ),
      ],
   });

   sdk.start();
   return sdk;
}

export async function shutdownOtel(): Promise<void> {
   if (sdk) {
      await sdk.shutdown();
      sdk = null;
   }
}
