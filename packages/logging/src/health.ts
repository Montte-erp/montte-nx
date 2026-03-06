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

/**
 * Starts periodic health heartbeat via OTel logs + PostHog events.
 * Emits uptime, memory usage, and service metadata every interval.
 */
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

		// OTel log
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

		// PostHog event
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

/**
 * Emits an OTel log for a job lifecycle event (start, complete, fail).
 */
export function emitJobLog(options: {
	serviceName: string;
	jobName: string;
	jobId?: string;
	event: "started" | "completed" | "failed";
	durationMs?: number;
	error?: string;
	attempt?: number;
	maxAttempts?: number;
}): void {
	const isError = options.event === "failed";
	logger.emit({
		severityText: isError ? "error" : "info",
		body: `job ${options.event}: ${options.jobName}${options.jobId ? ` (${options.jobId})` : ""}`,
		attributes: {
			"service.name": options.serviceName,
			"job.name": options.jobName,
			...(options.jobId ? { "job.id": options.jobId } : {}),
			"job.event": options.event,
			...(options.durationMs != null ? { "job.durationMs": options.durationMs } : {}),
			...(options.error ? { "job.error": options.error } : {}),
			...(options.attempt != null ? { "job.attempt": options.attempt } : {}),
			...(options.maxAttempts != null ? { "job.maxAttempts": options.maxAttempts } : {}),
		},
	});
}

/**
 * Emits an OTel log for a cron/scheduled task execution.
 */
export function emitCronLog(options: {
	serviceName: string;
	taskName: string;
	event: "started" | "completed" | "failed";
	durationMs?: number;
	error?: string;
}): void {
	const isError = options.event === "failed";
	logger.emit({
		severityText: isError ? "error" : "info",
		body: `cron ${options.event}: ${options.taskName}`,
		attributes: {
			"service.name": options.serviceName,
			"cron.task": options.taskName,
			"cron.event": options.event,
			...(options.durationMs != null ? { "cron.durationMs": options.durationMs } : {}),
			...(options.error ? { "cron.error": options.error } : {}),
		},
	});
}
