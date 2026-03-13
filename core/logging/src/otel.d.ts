import { NodeSDK } from "@opentelemetry/sdk-node";
export interface OtelConfig {
   serviceName: string;
   /** PostHog project token (phc_...) */
   posthogKey: string;
   /** PostHog host (e.g. https://us.i.posthog.com or your reverse proxy) */
   posthogHost: string;
}
export declare function initOtel(config: OtelConfig): NodeSDK;
export declare function shutdownOtel(): Promise<void>;
//# sourceMappingURL=otel.d.ts.map
