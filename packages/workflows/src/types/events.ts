import type {
	ScheduleTriggerType,
	TriggerType,
} from "@packages/database/schema";

export type TransactionEventType =
	| "transaction.created"
	| "transaction.updated";

export type ScheduleEventType = ScheduleTriggerType;

export type BudgetEventType =
	| "budget.threshold_reached"
	| "budget.period_end"
	| "budget.overspent";

export type AnomalyEventType =
	| "anomaly.spending_spike"
	| "anomaly.unusual_category"
	| "anomaly.large_transaction";

export type GoalEventType =
	| "goal.milestone_reached"
	| "goal.at_risk"
	| "goal.completed";

export type EventType = TransactionEventType | ScheduleEventType | BudgetEventType | AnomalyEventType | GoalEventType;

export type TransactionEventData = {
	id: string;
	organizationId: string;
	bankAccountId?: string | null;
	description: string;
	amount: number;
	type: "income" | "expense" | "transfer";
	date: string;
	categoryIds?: string[];
	costCenterId?: string | null;
	counterpartyId?: string | null;
	tagIds?: string[];
	metadata?: Record<string, unknown>;
	previousData?: Partial<TransactionEventData>;
};

export type ScheduleEventData = {
	triggerTime: string;
	organizationId: string;
	automationRuleId: string;
};

export type BudgetEventData = {
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

export type AnomalyEventData = {
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

export type GoalEventData = {
	goalId: string;
	organizationId: string;
	goalName: string;
	goalType: "savings" | "debt_payoff" | "spending_limit" | "income_target";
	targetAmount: number;
	currentAmount: number;
	progressPercentage: number;
	milestone?: number; // 25, 50, 75, 100
	daysRemaining?: number;
	isOnTrack?: boolean;
	projectedCompletionDate?: string;
};

export type BaseEvent<T extends EventType, D> = {
   id: string;
   type: T;
   timestamp: string;
   organizationId: string;
   data: D;
};

export type TransactionCreatedEvent = BaseEvent<
   "transaction.created",
   TransactionEventData
>;

export type TransactionUpdatedEvent = BaseEvent<
	"transaction.updated",
	TransactionEventData
>;

export type ScheduleTriggeredEvent = BaseEvent<ScheduleEventType, ScheduleEventData>;

export type BudgetThresholdReachedEvent = BaseEvent<"budget.threshold_reached", BudgetEventData>;
export type BudgetPeriodEndEvent = BaseEvent<"budget.period_end", BudgetEventData>;
export type BudgetOverspentEvent = BaseEvent<"budget.overspent", BudgetEventData>;
export type BudgetEvent = BudgetThresholdReachedEvent | BudgetPeriodEndEvent | BudgetOverspentEvent;

export type AnomalySpendingSpikeEvent = BaseEvent<"anomaly.spending_spike", AnomalyEventData>;
export type AnomalyUnusualCategoryEvent = BaseEvent<"anomaly.unusual_category", AnomalyEventData>;
export type AnomalyLargeTransactionEvent = BaseEvent<"anomaly.large_transaction", AnomalyEventData>;
export type AnomalyEvent = AnomalySpendingSpikeEvent | AnomalyUnusualCategoryEvent | AnomalyLargeTransactionEvent;

export type GoalMilestoneReachedEvent = BaseEvent<"goal.milestone_reached", GoalEventData>;
export type GoalAtRiskEvent = BaseEvent<"goal.at_risk", GoalEventData>;
export type GoalCompletedEvent = BaseEvent<"goal.completed", GoalEventData>;
export type GoalEvent = GoalMilestoneReachedEvent | GoalAtRiskEvent | GoalCompletedEvent;

export type WorkflowEvent =
	| TransactionCreatedEvent
	| TransactionUpdatedEvent
	| ScheduleTriggeredEvent
	| BudgetEvent
	| AnomalyEvent
	| GoalEvent;

export function createTransactionCreatedEvent(
   organizationId: string,
   data: TransactionEventData,
): TransactionCreatedEvent {
   return {
      data,
      id: crypto.randomUUID(),
      organizationId,
      timestamp: new Date().toISOString(),
      type: "transaction.created",
   };
}

export function createTransactionUpdatedEvent(
   organizationId: string,
   data: TransactionEventData,
): TransactionUpdatedEvent {
   return {
      data,
      id: crypto.randomUUID(),
      organizationId,
      timestamp: new Date().toISOString(),
      type: "transaction.updated",
   };
}

export function isTransactionEvent(
   event: WorkflowEvent,
): event is TransactionCreatedEvent | TransactionUpdatedEvent {
   return (
      event.type === "transaction.created" ||
      event.type === "transaction.updated"
   );
}

export function isScheduleEvent(
	event: WorkflowEvent,
): event is ScheduleTriggeredEvent {
	return event.type.startsWith("schedule.");
}

export function isBudgetEvent(
	event: WorkflowEvent,
): event is BudgetEvent {
	return event.type.startsWith("budget.");
}

export function isAnomalyEvent(
	event: WorkflowEvent,
): event is AnomalyEvent {
	return event.type.startsWith("anomaly.");
}

export function isGoalEvent(
	event: WorkflowEvent,
): event is GoalEvent {
	return event.type.startsWith("goal.");
}

export function createScheduleTriggeredEvent(
	organizationId: string,
	automationRuleId: string,
	triggerType: ScheduleEventType,
): ScheduleTriggeredEvent {
	return {
		data: {
			automationRuleId,
			organizationId,
			triggerTime: new Date().toISOString(),
		},
		id: crypto.randomUUID(),
		organizationId,
		timestamp: new Date().toISOString(),
		type: triggerType,
	};
}

export function eventTypeToTriggerType(eventType: EventType): TriggerType {
	return eventType as TriggerType;
}
