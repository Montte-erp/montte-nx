import type { ScheduleTriggerType } from "@packages/database/schema";
import type { ConnectionOptions } from "@packages/queue/bullmq";
import { Queue } from "@packages/queue/bullmq";
import {
	BACKOFF_TYPE,
	DEFAULT_BACKOFF_DELAY_MS,
	DEFAULT_RETRY_ATTEMPTS,
	MAINTENANCE_BACKOFF_DELAY_MS,
	MAINTENANCE_COMPLETED_RETENTION_SECONDS,
	MAINTENANCE_FAILED_RETENTION_SECONDS,
	MAINTENANCE_MAX_COMPLETED_JOBS,
	WORKFLOW_COMPLETED_RETENTION_SECONDS,
	WORKFLOW_FAILED_RETENTION_SECONDS,
	WORKFLOW_MAX_COMPLETED_JOBS,
} from "../constants";
import type { WorkflowEvent } from "../types/events";

export const WORKFLOW_QUEUE_NAME = "workflow-events";

/**
 * Job data for event-triggered workflows (transaction.created, transaction.updated)
 */
export type EventJobData = {
	type: "event";
	event: WorkflowEvent;
	metadata?: {
		triggeredBy?: "event" | "manual";
		correlationId?: string;
		dryRun?: boolean;
	};
};

/**
 * Job data for schedule-triggered workflows (schedule.daily, schedule.weekly, etc.)
 */
export type ScheduleTriggerJobData = {
	type: "schedule-trigger";
	ruleId: string;
	organizationId: string;
	triggerType: ScheduleTriggerType;
};

/**
 * Union type for all workflow job data
 */
export type WorkflowJobData = EventJobData | ScheduleTriggerJobData;

/**
 * Helper to check if job data is an event job
 */
export function isEventJobData(data: WorkflowJobData): data is EventJobData {
	return data.type === "event";
}

/**
 * Helper to check if job data is a schedule trigger job
 */
export function isScheduleTriggerJobData(
	data: WorkflowJobData,
): data is ScheduleTriggerJobData {
	return data.type === "schedule-trigger";
}

export type WorkflowJobResult = {
	eventId?: string;
	ruleId?: string;
	rulesEvaluated: number;
	rulesMatched: number;
	success: boolean;
	skipped?: boolean;
	error?: string;
};

let workflowQueue: Queue<WorkflowJobData, WorkflowJobResult> | null = null;

export function createWorkflowQueue(
   connection: ConnectionOptions,
): Queue<WorkflowJobData, WorkflowJobResult> {
   if (workflowQueue) {
      return workflowQueue;
   }

   workflowQueue = new Queue<WorkflowJobData, WorkflowJobResult>(
      WORKFLOW_QUEUE_NAME,
      {
         connection,
         defaultJobOptions: {
            attempts: DEFAULT_RETRY_ATTEMPTS,
            backoff: {
               delay: DEFAULT_BACKOFF_DELAY_MS,
               type: BACKOFF_TYPE,
            },
            removeOnComplete: {
               age: WORKFLOW_COMPLETED_RETENTION_SECONDS,
               count: WORKFLOW_MAX_COMPLETED_JOBS,
            },
            removeOnFail: {
               age: WORKFLOW_FAILED_RETENTION_SECONDS,
            },
         },
      },
   );

   return workflowQueue;
}

export function getWorkflowQueue(): Queue<
   WorkflowJobData,
   WorkflowJobResult
> | null {
   return workflowQueue;
}

export async function closeWorkflowQueue(): Promise<void> {
   if (workflowQueue) {
      await workflowQueue.close();
      workflowQueue = null;
   }
}

export const MAINTENANCE_QUEUE_NAME = "maintenance";

export type MaintenanceJobType = "cleanup-automation-logs";

export type MaintenanceJobData = {
   type: MaintenanceJobType;
   retentionDays?: number;
};

export type MaintenanceJobResult = {
   deletedCount: number;
   success: boolean;
   error?: string;
};

let maintenanceQueue: Queue<MaintenanceJobData, MaintenanceJobResult> | null =
   null;

export function createMaintenanceQueue(
   connection: ConnectionOptions,
): Queue<MaintenanceJobData, MaintenanceJobResult> {
   if (maintenanceQueue) {
      return maintenanceQueue;
   }

   maintenanceQueue = new Queue<MaintenanceJobData, MaintenanceJobResult>(
      MAINTENANCE_QUEUE_NAME,
      {
         connection,
         defaultJobOptions: {
            attempts: DEFAULT_RETRY_ATTEMPTS,
            backoff: {
               delay: MAINTENANCE_BACKOFF_DELAY_MS,
               type: BACKOFF_TYPE,
            },
            removeOnComplete: {
               age: MAINTENANCE_COMPLETED_RETENTION_SECONDS,
               count: MAINTENANCE_MAX_COMPLETED_JOBS,
            },
            removeOnFail: {
               age: MAINTENANCE_FAILED_RETENTION_SECONDS,
            },
         },
      },
   );

   return maintenanceQueue;
}

export function getMaintenanceQueue(): Queue<
   MaintenanceJobData,
   MaintenanceJobResult
> | null {
   return maintenanceQueue;
}

export async function closeMaintenanceQueue(): Promise<void> {
   if (maintenanceQueue) {
      await maintenanceQueue.close();
      maintenanceQueue = null;
   }
}

// Account Deletion Queue

export const DELETION_QUEUE_NAME = "account-deletion";

export type DeletionJobType = "process-deletions" | "send-reminders";

export type DeletionJobData = {
   type: DeletionJobType;
};

export type DeletionJobResult = {
   processedCount: number;
   emailsSent: number;
   success: boolean;
   error?: string;
};

let deletionQueue: Queue<DeletionJobData, DeletionJobResult> | null = null;

export function createDeletionQueue(
   connection: ConnectionOptions,
): Queue<DeletionJobData, DeletionJobResult> {
   if (deletionQueue) {
      return deletionQueue;
   }

   deletionQueue = new Queue<DeletionJobData, DeletionJobResult>(
      DELETION_QUEUE_NAME,
      {
         connection,
         defaultJobOptions: {
            attempts: DEFAULT_RETRY_ATTEMPTS,
            backoff: {
               delay: MAINTENANCE_BACKOFF_DELAY_MS,
               type: BACKOFF_TYPE,
            },
            removeOnComplete: {
               age: MAINTENANCE_COMPLETED_RETENTION_SECONDS,
               count: MAINTENANCE_MAX_COMPLETED_JOBS,
            },
            removeOnFail: {
               age: MAINTENANCE_FAILED_RETENTION_SECONDS,
            },
         },
      },
   );

   return deletionQueue;
}

export function getDeletionQueue(): Queue<
   DeletionJobData,
   DeletionJobResult
> | null {
   return deletionQueue;
}

export async function closeDeletionQueue(): Promise<void> {
   if (deletionQueue) {
      await deletionQueue.close();
      deletionQueue = null;
   }
}
