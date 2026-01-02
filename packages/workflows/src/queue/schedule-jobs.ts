import type {
	ScheduleTriggerConfig,
	ScheduleTriggerType,
} from "@packages/database/schema";
import { DEFAULT_TIMEZONE } from "../constants";
import { getWorkflowQueue, type ScheduleTriggerJobData } from "./queues";

/**
 * Generates a cron pattern from the schedule trigger configuration
 */
export function generateCronPattern(
	triggerType: ScheduleTriggerType,
	config: ScheduleTriggerConfig,
): string {
	const [hour, minute] = config.time.split(":").map(Number);

	switch (triggerType) {
		case "schedule.daily":
			// Every day at the specified time
			return `${minute} ${hour} * * *`;

		case "schedule.weekly":
			// Every week on the specified day at the specified time
			// Default to Monday (1) if not specified
			return `${minute} ${hour} * * ${config.dayOfWeek ?? 1}`;

		case "schedule.biweekly":
			// Twice a month: 1st and 15th at the specified time
			return `${minute} ${hour} 1,15 * *`;

		case "schedule.custom":
			// Use the custom cron pattern
			if (!config.cronPattern) {
				throw new Error(
					"Custom schedule trigger requires a cronPattern in config",
				);
			}
			return config.cronPattern;

		default:
			throw new Error(`Unknown schedule trigger type: ${triggerType}`);
	}
}

/**
 * Creates or updates a repeatable job for a schedule automation rule
 */
export async function upsertScheduleJob(
	ruleId: string,
	organizationId: string,
	triggerType: ScheduleTriggerType,
	config: ScheduleTriggerConfig,
): Promise<void> {
	const queue = getWorkflowQueue();
	if (!queue) {
		throw new Error(
			"Workflow queue not initialized. Call initializeWorkflowQueue first.",
		);
	}

	const cronPattern = generateCronPattern(triggerType, config);
	const jobId = `schedule-${ruleId}`;

	// Remove existing job if any (to handle updates)
	await removeScheduleJob(ruleId);

	const jobData: ScheduleTriggerJobData = {
		type: "schedule-trigger",
		ruleId,
		organizationId,
		triggerType,
	};

	// Create new repeatable job
	await queue.add(jobId, jobData, {
		jobId,
		repeat: {
			pattern: cronPattern,
			tz: config.timezone ?? DEFAULT_TIMEZONE,
		},
	});
}

/**
 * Removes the repeatable job for a schedule automation rule
 */
export async function removeScheduleJob(ruleId: string): Promise<boolean> {
	const queue = getWorkflowQueue();
	if (!queue) {
		return false;
	}

	const jobId = `schedule-${ruleId}`;

	// Get all repeatable jobs and find ours
	const repeatableJobs = await queue.getRepeatableJobs();
	const job = repeatableJobs.find((j) => j.id === jobId);

	if (job) {
		await queue.removeRepeatableByKey(job.key);
		return true;
	}

	return false;
}
