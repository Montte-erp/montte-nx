import { z } from "zod";

// ============================================
// Event Type Schemas
// ============================================

export const transactionEventTypeSchema = z.enum([
	"transaction.created",
	"transaction.updated",
]);

export const scheduleEventTypeSchema = z.enum([
	"schedule.daily",
	"schedule.weekly",
	"schedule.biweekly",
	"schedule.custom",
]);

export const budgetEventTypeSchema = z.enum([
	"budget.threshold_reached",
	"budget.period_end",
	"budget.overspent",
]);

export const eventTypeSchema = z.union([
	transactionEventTypeSchema,
	scheduleEventTypeSchema,
	budgetEventTypeSchema,
]);

// ============================================
// Event Data Schemas
// ============================================

// Define a base schema without the recursive reference first
const transactionEventDataBaseSchema = z.object({
	id: z.string().uuid(),
	organizationId: z.string().uuid(),
	bankAccountId: z.string().uuid().nullish(),
	description: z.string(),
	amount: z.number(),
	type: z.enum(["income", "expense", "transfer"]),
	date: z.string(), // ISO date string
	categoryIds: z.array(z.string().uuid()).optional(),
	costCenterId: z.string().uuid().nullish(),
	counterpartyId: z.string().uuid().nullish(),
	tagIds: z.array(z.string().uuid()).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

// Full schema with optional previousData (partial of base)
export const transactionEventDataSchema = transactionEventDataBaseSchema.extend({
	previousData: transactionEventDataBaseSchema.partial().optional(),
});

export const scheduleEventDataSchema = z.object({
	triggerTime: z.string(), // ISO datetime string
	organizationId: z.string().uuid(),
	automationRuleId: z.string().uuid(),
});

export const budgetEventDataSchema = z.object({
	budgetId: z.string().uuid(),
	organizationId: z.string().uuid(),
	budgetName: z.string(),
	threshold: z.number().optional(), // 50, 80, 100 for threshold_reached
	spent: z.number(),
	limit: z.number(),
	percentUsed: z.number(),
	periodStart: z.string(), // ISO date string
	periodEnd: z.string(), // ISO date string
	periodId: z.string().uuid().optional(),
});

// ============================================
// Base Event Schema Factory
// ============================================

function createBaseEventSchema<
	T extends z.ZodType,
	D extends z.ZodType,
>(typeSchema: T, dataSchema: D) {
	return z.object({
		id: z.string().uuid(),
		type: typeSchema,
		timestamp: z.string(), // ISO datetime string
		organizationId: z.string().uuid(),
		data: dataSchema,
	});
}

// ============================================
// Specific Event Schemas
// ============================================

export const transactionCreatedEventSchema = createBaseEventSchema(
	z.literal("transaction.created"),
	transactionEventDataSchema,
);

export const transactionUpdatedEventSchema = createBaseEventSchema(
	z.literal("transaction.updated"),
	transactionEventDataSchema,
);

export const scheduleTriggeredEventSchema = createBaseEventSchema(
	scheduleEventTypeSchema,
	scheduleEventDataSchema,
);

export const budgetThresholdReachedEventSchema = createBaseEventSchema(
	z.literal("budget.threshold_reached"),
	budgetEventDataSchema,
);

export const budgetPeriodEndEventSchema = createBaseEventSchema(
	z.literal("budget.period_end"),
	budgetEventDataSchema,
);

export const budgetOverspentEventSchema = createBaseEventSchema(
	z.literal("budget.overspent"),
	budgetEventDataSchema,
);

// Using union instead of discriminatedUnion for Zod 4 compatibility
export const workflowEventSchema = z.union([
	transactionCreatedEventSchema,
	transactionUpdatedEventSchema,
	scheduleTriggeredEventSchema,
	budgetThresholdReachedEventSchema,
	budgetPeriodEndEventSchema,
	budgetOverspentEventSchema,
]);

// ============================================
// Inferred Types
// ============================================

export type TransactionEventType = z.infer<typeof transactionEventTypeSchema>;
export type ScheduleEventType = z.infer<typeof scheduleEventTypeSchema>;
export type BudgetEventType = z.infer<typeof budgetEventTypeSchema>;
export type EventType = z.infer<typeof eventTypeSchema>;

export type TransactionEventData = z.infer<typeof transactionEventDataSchema>;
export type ScheduleEventData = z.infer<typeof scheduleEventDataSchema>;
export type BudgetEventData = z.infer<typeof budgetEventDataSchema>;

export type TransactionCreatedEvent = z.infer<typeof transactionCreatedEventSchema>;
export type TransactionUpdatedEvent = z.infer<typeof transactionUpdatedEventSchema>;
export type ScheduleTriggeredEvent = z.infer<typeof scheduleTriggeredEventSchema>;
export type BudgetThresholdReachedEvent = z.infer<typeof budgetThresholdReachedEventSchema>;
export type BudgetPeriodEndEvent = z.infer<typeof budgetPeriodEndEventSchema>;
export type BudgetOverspentEvent = z.infer<typeof budgetOverspentEventSchema>;

export type BudgetEvent = BudgetThresholdReachedEvent | BudgetPeriodEndEvent | BudgetOverspentEvent;

export type WorkflowEvent = z.infer<typeof workflowEventSchema>;

// ============================================
// Validation Functions
// ============================================

export function validateWorkflowEvent(data: unknown): WorkflowEvent {
	return workflowEventSchema.parse(data);
}

export function safeValidateWorkflowEvent(data: unknown): {
	success: boolean;
	data?: WorkflowEvent;
	error?: z.ZodError;
} {
	const result = workflowEventSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}

// ============================================
// Type Guards
// ============================================

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
