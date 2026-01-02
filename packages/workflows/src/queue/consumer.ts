import type { DatabaseInstance } from "@packages/database/client";
import { findAutomationRuleById } from "@packages/database/repositories/automation-repository";
import type { ConnectionOptions, WorkerOptions } from "@packages/queue/bullmq";
import { type Job, Worker } from "@packages/queue/bullmq";
import type { Resend } from "resend";
import type { VapidConfig } from "../actions/types";
import { createWorkflowRunner } from "../engine/runner";
import { createScheduleTriggeredEvent, type ScheduleTriggeredEvent } from "../types/events";
import { toWorkflowRule, type WorkflowExecutionResult } from "../types/rules";
import {
	isEventJobData,
	isScheduleTriggerJobData,
	WORKFLOW_QUEUE_NAME,
	type WorkflowJobData,
	type WorkflowJobResult,
} from "./queues";

export type WorkflowWorkerConfig = {
   connection: ConnectionOptions;
   db: DatabaseInstance;
   concurrency?: number;
   resendClient?: Resend;
   vapidConfig?: VapidConfig;
   onCompleted?: (
      job: Job<WorkflowJobData, WorkflowJobResult>,
      result: WorkflowJobResult,
   ) => void | Promise<void>;
   onFailed?: (
      job: Job<WorkflowJobData, WorkflowJobResult> | undefined,
      error: Error,
   ) => void | Promise<void>;
   onProgress?: (
      job: Job<WorkflowJobData, WorkflowJobResult>,
      progress: string | boolean | number | object,
   ) => void | Promise<void>;
};

export type WorkflowWorker = {
   worker: Worker<WorkflowJobData, WorkflowJobResult>;
   close: () => Promise<void>;
};

/**
 * Process a workflow job - handles both schedule-trigger and event-based jobs
 */
export async function processWorkflowJob(
	job: Job<WorkflowJobData, WorkflowJobResult>,
	db: DatabaseInstance,
	resendClient?: Resend,
	vapidConfig?: VapidConfig,
): Promise<WorkflowJobResult> {
	const jobData = job.data;

	// Handle schedule-trigger jobs
	if (isScheduleTriggerJobData(jobData)) {
		const { ruleId, organizationId, triggerType } = jobData;
		const runner = createWorkflowRunner({ db, resendClient, vapidConfig });

		try {
			const rule = await findAutomationRuleById(db, ruleId);
			if (!rule || !rule.enabled) {
				return {
					ruleId,
					rulesEvaluated: 0,
					rulesMatched: 0,
					skipped: true,
					success: true,
				};
			}

			const event = createScheduleTriggeredEvent(
				organizationId,
				ruleId,
				triggerType,
			);

			const result = await runner.processScheduleEvent(
				event,
				toWorkflowRule(rule),
			);

			return {
				eventId: event.id,
				ruleId,
				rulesEvaluated: result.rulesEvaluated,
				rulesMatched: result.rulesMatched,
				success: true,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error";
			return {
				error: message,
				ruleId,
				rulesEvaluated: 0,
				rulesMatched: 0,
				success: false,
			};
		}
	}

	// Handle event-based jobs
	if (isEventJobData(jobData)) {
		const { event, metadata } = jobData;
		const dryRun = metadata?.dryRun ?? false;
		const runner = createWorkflowRunner({ db, dryRun, resendClient, vapidConfig });

		try {
			// Check if this is a schedule event (wrapped in EventJobData for manual triggers)
			if (event.type.startsWith("schedule.")) {
				// For schedule events, we need to process the specific rule directly
				const scheduleData = event.data as { automationRuleId?: string };
				console.log(`[Consumer] Processing schedule event: ruleId=${scheduleData.automationRuleId}, dryRun=${dryRun}`);
				
				if (scheduleData.automationRuleId) {
					const rule = await findAutomationRuleById(db, scheduleData.automationRuleId);
					if (!rule || !rule.enabled) {
						console.log(`[Consumer] Rule not found or disabled: ruleId=${scheduleData.automationRuleId}`);
						return {
							eventId: event.id,
							rulesEvaluated: 0,
							rulesMatched: 0,
							skipped: true,
							success: true,
						};
					}
					
					console.log(`[Consumer] Executing schedule rule: ${rule.name}, consequences=${rule.consequences?.length || 0}`);
					const result = await runner.processScheduleEvent(
						event as ScheduleTriggeredEvent,
						toWorkflowRule(rule),
					);
					console.log(`[Consumer] Schedule rule completed: rulesMatched=${result.rulesMatched}`);
					
					return {
						eventId: event.id,
						rulesEvaluated: result.rulesEvaluated,
						rulesMatched: result.rulesMatched,
						success: true,
					};
				}
			}

			// Regular event processing for transaction events
			const result: WorkflowExecutionResult =
				await runner.processEvent(event);

			return {
				eventId: event.id,
				rulesEvaluated: result.rulesEvaluated,
				rulesMatched: result.rulesMatched,
				success: true,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error";
			return {
				error: message,
				eventId: event.id,
				rulesEvaluated: 0,
				rulesMatched: 0,
				success: false,
			};
		}
	}

	return {
		error: "Unknown job type",
		rulesEvaluated: 0,
		rulesMatched: 0,
		success: false,
	};
}

/**
 * Creates a workflow worker that processes workflow jobs from the queue
 */
export function createWorkflowWorker(
   config: WorkflowWorkerConfig,
): WorkflowWorker {
   const {
      connection,
      db,
      concurrency = 5,
      resendClient,
      vapidConfig,
      onCompleted,
      onFailed,
      onProgress,
   } = config;

   const workerOptions: WorkerOptions = {
      concurrency,
      connection,
   };

   const worker = new Worker<WorkflowJobData, WorkflowJobResult>(
      WORKFLOW_QUEUE_NAME,
      async (job: Job<WorkflowJobData, WorkflowJobResult>) => {
         return processWorkflowJob(job, db, resendClient, vapidConfig);
      },
      workerOptions,
   );

   if (onCompleted) {
      worker.on("completed", onCompleted);
   }

   if (onFailed) {
      worker.on("failed", onFailed);
   }

   if (onProgress) {
      worker.on("progress", onProgress);
   }

   return {
      close: async () => {
         await worker.close();
      },
      worker,
   };
}
