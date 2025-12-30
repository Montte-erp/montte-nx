import type { DatabaseInstance } from "@packages/database/client";
import { findAutomationRuleById } from "@packages/database/repositories/automation-repository";
import type { ConnectionOptions, WorkerOptions } from "@packages/queue/bullmq";
import { type Job, Worker } from "@packages/queue/bullmq";
import type { Resend } from "resend";
import type { VapidConfig } from "../actions/types";
import { createWorkflowRunner } from "../engine/runner";
import { createScheduleTriggeredEvent } from "../types/events";
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

   const runner = createWorkflowRunner({ db, resendClient, vapidConfig });

   const workerOptions: WorkerOptions = {
      concurrency,
      connection,
   };

   const worker = new Worker<WorkflowJobData, WorkflowJobResult>(
      WORKFLOW_QUEUE_NAME,
      async (job: Job<WorkflowJobData, WorkflowJobResult>) => {
         const jobData = job.data;

         // Handle schedule-trigger jobs
         if (isScheduleTriggerJobData(jobData)) {
            const { ruleId, organizationId, triggerType } = jobData;

            try {
               // Find the automation rule
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

               // Create a synthetic schedule event
               const event = createScheduleTriggeredEvent(
                  organizationId,
                  ruleId,
                  triggerType,
               );

               // Process the event with only this specific rule
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

         // Handle event-based jobs (transaction.created, transaction.updated)
         if (isEventJobData(jobData)) {
            const { event } = jobData;

            try {
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

         // Unknown job type
         return {
            error: "Unknown job type",
            rulesEvaluated: 0,
            rulesMatched: 0,
            success: false,
         };
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

export async function processWorkflowJob(
	job: Job<WorkflowJobData, WorkflowJobResult>,
	db: DatabaseInstance,
	resendClient?: Resend,
	vapidConfig?: VapidConfig,
): Promise<WorkflowJobResult> {
	const runner = createWorkflowRunner({ db, resendClient, vapidConfig });
	const jobData = job.data;

	// Handle schedule-trigger jobs
	if (isScheduleTriggerJobData(jobData)) {
		const { ruleId, organizationId, triggerType } = jobData;

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
		const { event } = jobData;

		try {
			const result = await runner.processEvent(event);

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
