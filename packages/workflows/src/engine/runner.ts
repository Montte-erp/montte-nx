import type {
	AggregatedConsequence,
	RuleInput,
} from "@f-o-t/rules-engine";
import type { DatabaseInstance } from "@packages/database/client";
import { createAutomationLog } from "@packages/database/repositories/automation-log-repository";
import { findActiveAutomationRulesByTrigger } from "@packages/database/repositories/automation-repository";
import type {
	ActionType,
	AutomationLogStatus,
	ConditionEvaluationLogResult,
	ConsequenceExecutionLogResult,
	TriggerType,
} from "@packages/database/schema";
import type { Resend } from "resend";
import { executeConsequences } from "../actions/executor";
import type { VapidConfig } from "../actions/types";
import type {
	ScheduleEventData,
	ScheduleTriggeredEvent,
	TransactionEventData,
	WorkflowEvent,
} from "../types/events";
import type {
	ExecutedConsequence,
	RuleExecutionResult,
	WorkflowExecutionResult,
	WorkflowRule,
} from "../types/rules";
import { toWorkflowRule } from "../types/rules";
import { adaptEventDataToContext } from "./adapter";
import type { WorkflowConsequences } from "./consequence-definitions";
import {
	createWorkflowEngine,
	type TransactionContext,
	type WorkflowEngine,
} from "./factory";

export type WorkflowRunnerConfig = {
	db: DatabaseInstance;
	dryRun?: boolean;
	resendClient?: Resend;
	vapidConfig?: VapidConfig;
	cacheEnabled?: boolean;
};

export type WorkflowRunner = {
	processEvent: (event: WorkflowEvent) => Promise<WorkflowExecutionResult>;
	processEventForRule: (
		event: WorkflowEvent,
		rule: WorkflowRule,
	) => Promise<RuleExecutionResult>;
	processScheduleEvent: (
		event: ScheduleTriggeredEvent,
		rule: WorkflowRule,
	) => Promise<WorkflowExecutionResult>;
	getEngine: () => WorkflowEngine;
};

/**
 * Converts a WorkflowRule to the rules-engine RuleInput format.
 */
function toEngineRule(
	rule: WorkflowRule,
): RuleInput<TransactionContext, WorkflowConsequences> {
	return {
		category: rule.category ?? undefined,
		conditions: rule.conditions,
		consequences: rule.consequences.map((c) => ({
			payload: c.payload,
			type: c.type as keyof WorkflowConsequences,
		})),
		description: rule.description ?? undefined,
		enabled: rule.enabled,
		id: rule.id,
		metadata: {
			...rule.metadata,
			organizationId: rule.organizationId,
			triggerConfig: rule.triggerConfig,
			triggerType: rule.triggerType,
		},
		name: rule.name,
		priority: rule.priority,
		stopOnMatch: rule.stopOnMatch ?? false,
		tags: rule.tags,
	};
}

export function createWorkflowRunner(
	config: WorkflowRunnerConfig,
): WorkflowRunner {
	const { db, dryRun = false, resendClient, vapidConfig, cacheEnabled } = config;

	// Create the rules engine instance
	const engine = createWorkflowEngine({
		cacheEnabled: cacheEnabled ?? !dryRun, // Disable cache in dry-run mode
		db,
	});

	async function processEvent(
		event: WorkflowEvent,
	): Promise<WorkflowExecutionResult> {
		const startTime = performance.now();
		const results: RuleExecutionResult[] = [];
		let stoppedEarly = false;
		let stoppedByRuleId: string | undefined;

		// Load rules from database
		const dbRules = await findActiveAutomationRulesByTrigger(
			db,
			event.organizationId,
			event.type,
		);

		// Convert to workflow rules
		const workflowRules = dbRules.map(toWorkflowRule);

		// Clear and populate engine with rules
		engine.clearRules();
		for (const rule of workflowRules) {
			engine.addRule(toEngineRule(rule));
		}

		// Adapt event data to evaluation context
		const context = adaptEventDataToContext(
			event.data as TransactionEventData,
		);

		// Evaluate all rules using the rules-engine
		const engineResult = await engine.evaluate(context);

		// Process consequences for matched rules
		for (const matchedRule of engineResult.matchedRules) {
			const workflowRule = workflowRules.find((r) => r.id === matchedRule.id);
			if (!workflowRule) continue;

			const ruleResult = engineResult.results.find(
				(r) => r.ruleId === matchedRule.id,
			);

			const ruleConsequences = engineResult.consequences.filter(
				(c) => c.ruleId === matchedRule.id,
			);

			const result = await processRuleConsequences(
				event,
				workflowRule,
				ruleConsequences,
				ruleResult?.conditionResult,
				context,
			);

			results.push(result);

			if (result.stopProcessing) {
				stoppedEarly = true;
				stoppedByRuleId = matchedRule.id;
				break;
			}
		}

		// Add non-matched rules to results (for logging purposes)
		for (const ruleResult of engineResult.results) {
			if (!ruleResult.matched) {
				const workflowRule = workflowRules.find(
					(r) => r.id === ruleResult.ruleId,
				);
				if (workflowRule) {
					await logRuleExecution(event, workflowRule, {
						conditionsPassed: false,
						consequencesExecuted: [],
						durationMs: ruleResult.evaluationTimeMs,
						error: ruleResult.error?.message,
						matched: false,
						ruleId: ruleResult.ruleId,
						ruleName: ruleResult.ruleName,
						stopProcessing: false,
					});

					results.push({
						conditionsPassed: false,
						consequencesExecuted: [],
						durationMs: ruleResult.evaluationTimeMs,
						error: ruleResult.error?.message,
						matched: false,
						ruleId: ruleResult.ruleId,
						ruleName: ruleResult.ruleName,
						stopProcessing: false,
					});
				}
			}
		}

		const totalDurationMs = performance.now() - startTime;

		return {
			eventId: event.id,
			eventType: event.type,
			organizationId: event.organizationId,
			results,
			rulesEvaluated: engineResult.totalRulesEvaluated,
			rulesMatched: engineResult.totalRulesMatched,
			stoppedByRuleId,
			stoppedEarly,
			totalDurationMs,
		};
	}

	async function processRuleConsequences(
		event: WorkflowEvent,
		rule: WorkflowRule,
		consequences: AggregatedConsequence<WorkflowConsequences>[],
		conditionResult: unknown,
		context: TransactionContext,
	): Promise<RuleExecutionResult> {
		const startedAt = new Date();
		const startTime = performance.now();
		const consequencesExecuted: ExecutedConsequence[] = [];
		let error: string | undefined;
		let stopProcessing = false;

		try {
			// Execute consequences using the action handlers
			const executionResult = await executeConsequences(consequences, {
				db,
				dryRun,
				eventData: context,
				organizationId: event.organizationId,
				resendClient,
				ruleId: rule.id,
				vapidConfig,
			});

			for (let i = 0; i < executionResult.results.length; i++) {
				const consequenceResult = executionResult.results[i];
				if (!consequenceResult) continue;
				const executed: ExecutedConsequence = {
					consequenceIndex: i,
					error: consequenceResult.error,
					result: consequenceResult.result,
					skippedReason: consequenceResult.skipReason,
					status: consequenceResult.skipped
						? "skipped"
						: consequenceResult.success
							? "success"
							: "failed",
					type: consequenceResult.type as ActionType,
				};
				consequencesExecuted.push(executed);
			}

			stopProcessing =
				executionResult.stoppedEarly || (rule.stopOnMatch ?? false);
		} catch (e) {
			error = e instanceof Error ? e.message : "Unknown error";
		}

		const durationMs = Math.round(performance.now() - startTime);
		const completedAt = new Date();

		// Extract condition evaluation results for logging
		const conditionsEvaluated = flattenConditionResults(conditionResult);

		const result: RuleExecutionResult = {
			conditionsPassed: true,
			consequencesExecuted,
			durationMs,
			error,
			matched: true,
			ruleId: rule.id,
			ruleName: rule.name,
			stopProcessing,
		};

		// Log the execution
		await logRuleExecution(event, rule, result, {
			completedAt,
			conditionsEvaluated,
			startedAt,
		});

		return result;
	}

	async function processEventForRule(
		event: WorkflowEvent,
		rule: WorkflowRule,
	): Promise<RuleExecutionResult> {
		// Clear and add only this rule to the engine
		engine.clearRules();
		engine.addRule(toEngineRule(rule));

		const context = adaptEventDataToContext(
			event.data as TransactionEventData,
		);

		const engineResult = await engine.evaluate(context);

		if (engineResult.matchedRules.length === 0) {
			const ruleResult = engineResult.results[0];
			return {
				conditionsPassed: false,
				consequencesExecuted: [],
				durationMs: ruleResult?.evaluationTimeMs ?? 0,
				error: ruleResult?.error?.message,
				matched: false,
				ruleId: rule.id,
				ruleName: rule.name,
				stopProcessing: false,
			};
		}

		const ruleConsequences = engineResult.consequences.filter(
			(c) => c.ruleId === rule.id,
		);

		return processRuleConsequences(
			event,
			rule,
			ruleConsequences,
			engineResult.results[0]?.conditionResult,
			context,
		);
	}

	async function logRuleExecution(
		event: WorkflowEvent,
		rule: WorkflowRule,
		result: RuleExecutionResult,
		options?: {
			startedAt?: Date;
			completedAt?: Date;
			conditionsEvaluated?: ConditionEvaluationLogResult[];
		},
	) {
		if (dryRun) return;

		const startedAt = options?.startedAt ?? new Date();
		const completedAt = options?.completedAt ?? new Date();

		const consequencesLogResults: ConsequenceExecutionLogResult[] =
			result.consequencesExecuted.map((c) => ({
				consequenceIndex: c.consequenceIndex,
				error: c.error,
				result: c.result,
				success: c.status === "success",
				type: c.type,
			}));

		let status: AutomationLogStatus;
		if (result.error) {
			status = "failed";
		} else if (!result.conditionsPassed) {
			status = "skipped";
		} else {
			const allSuccess = result.consequencesExecuted.every(
				(c) => c.status === "success" || c.status === "skipped",
			);
			const anySuccess = result.consequencesExecuted.some(
				(c) => c.status === "success",
			);
			if (allSuccess) {
				status = "success";
			} else if (anySuccess) {
				status = "partial";
			} else {
				status = "failed";
			}
		}

		const eventData = event.data as TransactionEventData;

		try {
			await createAutomationLog(db, {
				completedAt,
				conditionsEvaluated: options?.conditionsEvaluated ?? [],
				consequencesExecuted: consequencesLogResults,
				durationMs: result.durationMs,
				errorMessage: result.error ?? null,
				organizationId: event.organizationId,
				relatedEntityId: eventData.id ?? null,
				relatedEntityType: eventData.id ? "transaction" : null,
				ruleId: rule.id,
				ruleName: rule.name,
				startedAt,
				status,
				triggeredBy: "event",
				triggerEvent: event.data,
				triggerType: rule.triggerType as TriggerType,
			});
		} catch (logError) {
			console.error("Failed to create automation log:", logError);
		}
	}

	function flattenConditionResults(
		conditionResult: unknown,
	): ConditionEvaluationLogResult[] {
		if (!conditionResult || typeof conditionResult !== "object") {
			return [];
		}

		const flattened: ConditionEvaluationLogResult[] = [];

		const processResult = (result: unknown) => {
			if (
				result &&
				typeof result === "object" &&
				"conditionId" in result &&
				"passed" in result
			) {
				const evalResult = result as {
					conditionId: string;
					passed: boolean;
					actualValue?: unknown;
					expectedValue?: unknown;
				};
				flattened.push({
					actualValue: evalResult.actualValue,
					conditionId: evalResult.conditionId,
					expectedValue: evalResult.expectedValue,
					passed: evalResult.passed,
				});
			} else if (result && typeof result === "object" && "results" in result) {
				const groupResult = result as { results: unknown[] };
				for (const r of groupResult.results) {
					processResult(r);
				}
			}
		};

		if ("results" in conditionResult) {
			const grouped = conditionResult as { results: unknown[] };
			for (const r of grouped.results) {
				processResult(r);
			}
		}

		return flattened;
	}

	/**
	 * Process a schedule-triggered event for a specific rule.
	 * Unlike regular events, schedule events skip condition evaluation
	 * and directly execute the rule's consequences.
	 */
	async function processScheduleEvent(
		event: ScheduleTriggeredEvent,
		rule: WorkflowRule,
	): Promise<WorkflowExecutionResult> {
		const startTime = performance.now();
		const startedAt = new Date();
		const consequencesExecuted: ExecutedConsequence[] = [];
		let error: string | undefined;
		let stopProcessing = false;

		try {
			// For schedule events, we create a minimal context with schedule data
			const scheduleContext = {
				triggerTime: event.data.triggerTime,
				organizationId: event.data.organizationId,
				automationRuleId: event.data.automationRuleId,
			};

			// Execute consequences directly (no condition evaluation for schedules)
			const executionResult = await executeConsequences(
				rule.consequences.map((c) => ({
					payload: c.payload,
					priority: rule.priority,
					ruleId: rule.id,
					type: c.type as keyof WorkflowConsequences,
				})),
				{
					db,
					dryRun,
					eventData: scheduleContext as unknown as TransactionContext,
					organizationId: event.organizationId,
					resendClient,
					ruleId: rule.id,
					vapidConfig,
				},
			);

			for (let i = 0; i < executionResult.results.length; i++) {
				const consequenceResult = executionResult.results[i];
				if (!consequenceResult) continue;
				consequencesExecuted.push({
					consequenceIndex: i,
					error: consequenceResult.error,
					result: consequenceResult.result,
					skippedReason: consequenceResult.skipReason,
					status: consequenceResult.skipped
						? "skipped"
						: consequenceResult.success
							? "success"
							: "failed",
					type: consequenceResult.type as ActionType,
				});
			}

			stopProcessing =
				executionResult.stoppedEarly || (rule.stopOnMatch ?? false);
		} catch (e) {
			error = e instanceof Error ? e.message : "Unknown error";
		}

		const durationMs = Math.round(performance.now() - startTime);
		const completedAt = new Date();

		const result: RuleExecutionResult = {
			conditionsPassed: true, // Always true for schedules (no conditions)
			consequencesExecuted,
			durationMs,
			error,
			matched: true,
			ruleId: rule.id,
			ruleName: rule.name,
			stopProcessing,
		};

		// Log the execution
		await logScheduleRuleExecution(event, rule, result, {
			completedAt,
			startedAt,
		});

		const totalDurationMs = performance.now() - startTime;

		return {
			eventId: event.id,
			eventType: event.type,
			organizationId: event.organizationId,
			results: [result],
			rulesEvaluated: 1,
			rulesMatched: 1,
			stoppedByRuleId: undefined,
			stoppedEarly: stopProcessing,
			totalDurationMs,
		};
	}

	async function logScheduleRuleExecution(
		event: ScheduleTriggeredEvent,
		rule: WorkflowRule,
		result: RuleExecutionResult,
		options: {
			startedAt: Date;
			completedAt: Date;
		},
	) {
		if (dryRun) return;

		const consequencesLogResults: ConsequenceExecutionLogResult[] =
			result.consequencesExecuted.map((c) => ({
				consequenceIndex: c.consequenceIndex,
				error: c.error,
				result: c.result,
				success: c.status === "success",
				type: c.type,
			}));

		let status: AutomationLogStatus;
		if (result.error) {
			status = "failed";
		} else {
			const allSuccess = result.consequencesExecuted.every(
				(c) => c.status === "success" || c.status === "skipped",
			);
			const anySuccess = result.consequencesExecuted.some(
				(c) => c.status === "success",
			);
			if (allSuccess) {
				status = "success";
			} else if (anySuccess) {
				status = "partial";
			} else {
				status = "failed";
			}
		}

		try {
			await createAutomationLog(db, {
				completedAt: options.completedAt,
				conditionsEvaluated: [],
				consequencesExecuted: consequencesLogResults,
				durationMs: result.durationMs,
				errorMessage: result.error ?? null,
				organizationId: event.organizationId,
				relatedEntityId: null,
				relatedEntityType: null,
				ruleId: rule.id,
				ruleName: rule.name,
				startedAt: options.startedAt,
				status,
				triggeredBy: "event",
				triggerEvent: event.data,
				triggerType: rule.triggerType as TriggerType,
			});
		} catch (logError) {
			console.error("Failed to create automation log:", logError);
		}
	}

	return {
		getEngine: () => engine,
		processEvent,
		processEventForRule,
		processScheduleEvent,
	};
}

export async function runWorkflowForEvent(
	db: DatabaseInstance,
	event: WorkflowEvent,
	options?: {
		dryRun?: boolean;
		resendClient?: Resend;
		vapidConfig?: VapidConfig;
	},
): Promise<WorkflowExecutionResult> {
	const runner = createWorkflowRunner({
		db,
		dryRun: options?.dryRun,
		resendClient: options?.resendClient,
		vapidConfig: options?.vapidConfig,
	});

	return runner.processEvent(event);
}
