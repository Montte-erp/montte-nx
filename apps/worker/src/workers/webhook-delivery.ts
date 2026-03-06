import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { DatabaseInstance } from "@packages/database/client";
import { emitJobLog } from "@packages/logging/health";
import { getLogger } from "@packages/logging/root";

const logger = getLogger().child({ module: "worker:webhook" });
import {
	WEBHOOK_DELIVERY_QUEUE,
	type WebhookDeliveryJobData,
} from "@packages/queue/webhook-delivery";
import { deliverWebhook } from "../jobs/deliver-webhook";

const SERVICE_NAME = "montte-worker";

export function startWebhookDeliveryWorker(
	connection: ConnectionOptions,
	db: DatabaseInstance,
): Worker<WebhookDeliveryJobData> {
	const jobStartTimes = new Map<string, number>();

	const worker = new Worker<WebhookDeliveryJobData>(
		WEBHOOK_DELIVERY_QUEUE,
		async (job) => {
			jobStartTimes.set(job.id ?? "", Date.now());
			emitJobLog({ serviceName: SERVICE_NAME, jobName: WEBHOOK_DELIVERY_QUEUE, jobId: job.id, event: "started" });
			await deliverWebhook(db, job.data);
		},
		{
			connection,
			concurrency: 10,
		},
	);

	worker.on("completed", (job) => {
		const start = jobStartTimes.get(job.id ?? "");
		jobStartTimes.delete(job.id ?? "");
		emitJobLog({
			serviceName: SERVICE_NAME,
			jobName: WEBHOOK_DELIVERY_QUEUE,
			jobId: job.id,
			event: "completed",
			durationMs: start ? Date.now() - start : undefined,
		});
	});

	worker.on("failed", (job, err) => {
		const start = jobStartTimes.get(job?.id ?? "");
		jobStartTimes.delete(job?.id ?? "");
		emitJobLog({
			serviceName: SERVICE_NAME,
			jobName: WEBHOOK_DELIVERY_QUEUE,
			jobId: job?.id,
			event: "failed",
			durationMs: start ? Date.now() - start : undefined,
			error: err.message,
			attempt: job?.attemptsMade,
			maxAttempts: job?.opts.attempts,
		});
	});

	logger.info("Webhook delivery worker started");
	return worker;
}
