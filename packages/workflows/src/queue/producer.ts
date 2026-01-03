import type { ConnectionOptions } from "@packages/queue/bullmq";
import { v4 as uuid } from "uuid";
import type { BudgetEventData, WorkflowEvent } from "../types/events";
import {
	createWorkflowQueue,
	getWorkflowQueue,
	type EventJobData,
} from "./queues";

export type EnqueueOptions = {
	delay?: number;
	priority?: number;
	jobId?: string;
	triggeredBy?: "event" | "manual";
	correlationId?: string;
	dryRun?: boolean;
};

export async function enqueueWorkflowEvent(
	event: WorkflowEvent,
	options: EnqueueOptions = {},
): Promise<string> {
	const queue = getWorkflowQueue();
	if (!queue) {
		throw new Error(
			"Workflow queue not initialized. Call initializeWorkflowQueue first.",
		);
	}

	const jobData: EventJobData = {
		type: "event",
		event,
		metadata: {
			correlationId: options.correlationId,
			triggeredBy: options.triggeredBy ?? "event",
			dryRun: options.dryRun ?? false,
		},
	};

	const job = await queue.add(event.type, jobData, {
		delay: options.delay,
		jobId: options.jobId ?? `${event.type}-${event.id}`,
		priority: options.priority,
	});

	return job.id ?? event.id;
}

export function initializeWorkflowQueue(connection: ConnectionOptions): void {
   createWorkflowQueue(connection);
}

export async function enqueueTransactionCreatedEvent(
   event: WorkflowEvent,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

export async function enqueueManualWorkflowRun(
   event: WorkflowEvent,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "manual",
   });
}

// Budget Event Emitters

export type BudgetEventInput = {
   budgetId: string;
   organizationId: string;
   budgetName: string;
   threshold?: number;
   spent: number;
   limit: number;
   percentUsed: number;
   periodStart: string;
   periodEnd: string;
   periodId?: string;
};

function createBudgetEvent(
   type: "budget.threshold_reached" | "budget.period_end" | "budget.overspent",
   data: BudgetEventInput,
): WorkflowEvent {
   const eventData: BudgetEventData = {
      budgetId: data.budgetId,
      budgetName: data.budgetName,
      limit: data.limit,
      organizationId: data.organizationId,
      percentUsed: data.percentUsed,
      periodEnd: data.periodEnd,
      periodId: data.periodId,
      periodStart: data.periodStart,
      spent: data.spent,
      threshold: data.threshold,
   };

   return {
      data: eventData,
      id: uuid(),
      organizationId: data.organizationId,
      timestamp: new Date().toISOString(),
      type,
   } as WorkflowEvent;
}

/**
 * Emit when a budget reaches a threshold (50%, 80%, 100%)
 */
export async function emitBudgetThresholdEvent(
   data: BudgetEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createBudgetEvent("budget.threshold_reached", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

/**
 * Emit when a budget period ends (for scheduled rollovers)
 */
export async function emitBudgetPeriodEndEvent(
   data: BudgetEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createBudgetEvent("budget.period_end", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

/**
 * Emit when a budget is overspent (exceeds 100%)
 */
export async function emitBudgetOverspentEvent(
   data: BudgetEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createBudgetEvent("budget.overspent", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}
