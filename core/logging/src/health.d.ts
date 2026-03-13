import type { PostHog } from "posthog-node";
export interface HealthConfig {
   serviceName: string;
   posthog: PostHog;
   intervalMs?: number;
}
/**
 * Starts periodic health heartbeat via OTel logs + PostHog events.
 * Emits uptime, memory usage, and service metadata every interval.
 */
export declare function startHealthHeartbeat(config: HealthConfig): void;
export declare function stopHealthHeartbeat(): void;
/**
 * Emits an OTel log for a job lifecycle event (start, complete, fail).
 */
export declare function emitJobLog(options: {
   serviceName: string;
   jobName: string;
   jobId?: string;
   event: "started" | "completed" | "failed";
   durationMs?: number;
   error?: string;
   attempt?: number;
   maxAttempts?: number;
}): void;
/**
 * Emits an OTel log for a cron/scheduled task execution.
 */
export declare function emitCronLog(options: {
   serviceName: string;
   taskName: string;
   event: "started" | "completed" | "failed";
   durationMs?: number;
   error?: string;
}): void;
//# sourceMappingURL=health.d.ts.map
