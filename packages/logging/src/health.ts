import { logs } from "@opentelemetry/api-logs";

const logger = logs.getLogger("health");

export interface HealthConfig {
	serviceName: string;
	intervalMs?: number;
}

let healthInterval: ReturnType<typeof setInterval> | null = null;
let startTime: number | null = null;

/**
 * Starts periodic health heartbeat OTel logs.
 * Emits uptime, memory usage, and service metadata every interval.
 */
export function startHealthHeartbeat(config: HealthConfig): void {
	if (healthInterval) return;

	const interval = config.intervalMs ?? 60_000; // Default: 1 minute
	startTime = Date.now();

	healthInterval = setInterval(() => {
		const mem = process.memoryUsage();
		const uptimeMs = Date.now() - (startTime ?? Date.now());

		logger.emit({
			severityText: "info",
			body: `health heartbeat: ${config.serviceName}`,
			attributes: {
				"service.name": config.serviceName,
				"health.uptimeMs": uptimeMs,
				"health.heapUsedMb": Math.round(mem.heapUsed / 1024 / 1024),
				"health.heapTotalMb": Math.round(mem.heapTotal / 1024 / 1024),
				"health.rssMb": Math.round(mem.rss / 1024 / 1024),
				"health.externalMb": Math.round(mem.external / 1024 / 1024),
			},
		});
	}, interval);
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
