import type { ConnectionOptions } from "@packages/queue/bullmq";
import { v4 as uuid } from "uuid";
import type { AnomalyEventData, AnomalyEventType, BudgetEventData, GoalEventData, GoalEventType, WorkflowEvent } from "../types/events";
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

// Anomaly Event Emitters

export type AnomalyEventInput = {
   id: string;
   organizationId: string;
   type: "spending_spike" | "unusual_category" | "large_transaction";
   severity: "low" | "medium" | "high";
   title: string;
   description?: string;
   amount?: number;
   transactionId?: string;
   metadata?: Record<string, unknown>;
};

function createAnomalyEvent(
   eventType: AnomalyEventType,
   data: AnomalyEventInput,
): WorkflowEvent {
   const eventData: AnomalyEventData = {
      id: data.id,
      organizationId: data.organizationId,
      type: data.type,
      severity: data.severity,
      title: data.title,
      description: data.description,
      amount: data.amount,
      transactionId: data.transactionId,
      metadata: data.metadata,
   };

   return {
      data: eventData,
      id: uuid(),
      organizationId: data.organizationId,
      timestamp: new Date().toISOString(),
      type: eventType,
   } as WorkflowEvent;
}

/**
 * Emit when a spending spike is detected
 */
export async function emitAnomalySpendingSpikeEvent(
   data: AnomalyEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createAnomalyEvent("anomaly.spending_spike", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

/**
 * Emit when unusual category spending is detected
 */
export async function emitAnomalyUnusualCategoryEvent(
   data: AnomalyEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createAnomalyEvent("anomaly.unusual_category", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

/**
 * Emit when a large transaction is detected
 */
export async function emitAnomalyLargeTransactionEvent(
   data: AnomalyEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createAnomalyEvent("anomaly.large_transaction", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

/**
 * Generic anomaly event emitter - determines the correct event type based on anomaly type
 */
export async function emitAnomalyEvent(
   data: AnomalyEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const eventTypeMap: Record<AnomalyEventInput["type"], AnomalyEventType> = {
      spending_spike: "anomaly.spending_spike",
      unusual_category: "anomaly.unusual_category",
      large_transaction: "anomaly.large_transaction",
   };
   const event = createAnomalyEvent(eventTypeMap[data.type], data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

// Goal Event Emitters

export type GoalEventInput = {
   goalId: string;
   organizationId: string;
   goalName: string;
   goalType: "savings" | "debt_payoff" | "spending_limit" | "income_target";
   targetAmount: number;
   currentAmount: number;
   progressPercentage: number;
   milestone?: number;
   daysRemaining?: number;
   isOnTrack?: boolean;
   projectedCompletionDate?: string;
};

function createGoalEvent(
   eventType: GoalEventType,
   data: GoalEventInput,
): WorkflowEvent {
   const eventData: GoalEventData = {
      goalId: data.goalId,
      organizationId: data.organizationId,
      goalName: data.goalName,
      goalType: data.goalType,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount,
      progressPercentage: data.progressPercentage,
      milestone: data.milestone,
      daysRemaining: data.daysRemaining,
      isOnTrack: data.isOnTrack,
      projectedCompletionDate: data.projectedCompletionDate,
   };

   return {
      data: eventData,
      id: uuid(),
      organizationId: data.organizationId,
      timestamp: new Date().toISOString(),
      type: eventType,
   } as WorkflowEvent;
}

/**
 * Emit when a goal reaches a milestone (25%, 50%, 75%, 100%)
 */
export async function emitGoalMilestoneEvent(
   data: GoalEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createGoalEvent("goal.milestone_reached", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

/**
 * Emit when a goal is at risk of not being completed on time
 */
export async function emitGoalAtRiskEvent(
   data: GoalEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createGoalEvent("goal.at_risk", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}

/**
 * Emit when a goal is completed
 */
export async function emitGoalCompletedEvent(
   data: GoalEventInput,
   options?: Omit<EnqueueOptions, "triggeredBy">,
): Promise<string> {
   const event = createGoalEvent("goal.completed", data);
   return enqueueWorkflowEvent(event, {
      ...options,
      triggeredBy: "event",
   });
}
