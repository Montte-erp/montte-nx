import type { ConditionGroup } from "@f-o-t/rules-engine";
import type {
	ActionType,
	automationRule,
	Consequence,
	TriggerConfig,
	TriggerType,
} from "@packages/database/schema";
import type { WorkflowEvent } from "./events";

export type AutomationRule = typeof automationRule.$inferSelect;
export type AutomationRuleInsert = typeof automationRule.$inferInsert;

export type WorkflowRule = {
	id: string;
	name: string;
	description?: string | null;
	organizationId: string;
	triggerType: TriggerType;
	triggerConfig: TriggerConfig;
	conditions: ConditionGroup;
	consequences: Consequence[];
	enabled: boolean;
	priority: number;
	stopOnMatch?: boolean | null;
	tags: string[];
	category?: string | null;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
	createdBy?: string | null;
};

export type WorkflowRuleInput = {
	name: string;
	description?: string | null;
	organizationId: string;
	triggerType: TriggerType;
	triggerConfig?: TriggerConfig;
	conditions: ConditionGroup;
	consequences: Consequence[];
	enabled?: boolean;
	priority?: number;
	stopOnMatch?: boolean;
	tags?: string[];
	category?: string;
	metadata?: Record<string, unknown>;
	createdBy?: string;
};

export type WorkflowRuleUpdate = Partial<
	Omit<WorkflowRuleInput, "organizationId">
>;

export type RuleExecutionContext = {
	event: WorkflowEvent;
	rule: WorkflowRule;
	organizationId: string;
	dryRun?: boolean;
	triggeredBy?: "event" | "manual";
};

export type ConsequenceExecutionStatus = "success" | "failed" | "skipped";

export type ExecutedConsequence = {
	consequenceIndex: number;
	type: ActionType;
	status: ConsequenceExecutionStatus;
	result?: unknown;
	error?: string;
	skippedReason?: string;
	durationMs?: number;
};

export type RuleExecutionResult = {
	ruleId: string;
	ruleName: string;
	matched: boolean;
	conditionsPassed: boolean;
	consequencesExecuted: ExecutedConsequence[];
	stopProcessing: boolean;
	durationMs: number;
	error?: string;
};

export type WorkflowExecutionResult = {
	eventId: string;
	eventType: string;
	organizationId: string;
	rulesEvaluated: number;
	rulesMatched: number;
	results: RuleExecutionResult[];
	totalDurationMs: number;
	stoppedEarly: boolean;
	stoppedByRuleId?: string;
};

export function toWorkflowRule(rule: AutomationRule): WorkflowRule {
	return {
		category: rule.category,
		conditions: rule.conditions,
		consequences: rule.consequences,
		createdAt: rule.createdAt,
		createdBy: rule.createdBy,
		description: rule.description,
		enabled: rule.enabled,
		id: rule.id,
		metadata: rule.metadata,
		name: rule.name,
		organizationId: rule.organizationId,
		priority: rule.priority,
		stopOnMatch: rule.stopOnMatch,
		tags: rule.tags,
		triggerConfig: rule.triggerConfig ?? {},
		triggerType: rule.triggerType,
		updatedAt: rule.updatedAt,
	};
}
