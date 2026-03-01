import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { DatabaseInstance } from "@packages/database/client";
import {
	BUDGET_ALERTS_QUEUE,
	type BudgetAlertJobData,
} from "@packages/queue/budget-alerts";
import { checkBudgetAlerts } from "../jobs/check-budget-alerts";

export function startBudgetAlertsWorker(
	connection: ConnectionOptions,
	db: DatabaseInstance,
): Worker<BudgetAlertJobData> {
	const worker = new Worker<BudgetAlertJobData>(
		BUDGET_ALERTS_QUEUE,
		async (job) => {
			await checkBudgetAlerts(db, job.data);
		},
		{
			connection,
			concurrency: 5,
		},
	);

	worker.on("completed", (job) => {
		console.log(`[Worker] Budget alert job ${job.id} completed`);
	});

	worker.on("failed", (job, err) => {
		console.error(
			`[Worker] Budget alert job ${job?.id} failed:`,
			err.message,
		);
	});

	console.log("[Worker] Budget alerts worker started");
	return worker;
}
