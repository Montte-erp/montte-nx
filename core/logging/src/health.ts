import { logs } from "@opentelemetry/api-logs";
import type { PostHog } from "posthog-node";

const logger = logs.getLogger("health");

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

      logger.emit({
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
