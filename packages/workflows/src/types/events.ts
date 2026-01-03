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

export type EventType = TransactionEventType | ScheduleEventType | BudgetEventType;

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

export type WorkflowEvent =
	| TransactionCreatedEvent
	| TransactionUpdatedEvent
	| ScheduleTriggeredEvent
	| BudgetEvent;

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
