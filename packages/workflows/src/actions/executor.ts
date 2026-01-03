import type { AggregatedConsequence } from "@f-o-t/rules-engine";
import type { DatabaseInstance } from "@packages/database/client";
import type { ActionConfig, Consequence } from "@packages/database/schema";
import type { Resend } from "resend";
import type { WorkflowConsequences } from "../engine/consequence-definitions";
import type { ConsequenceExecutionResult } from "../types/actions";
import { isStopExecutionResult } from "./handlers/stop-execution";
import { getActionHandler } from "./registry";
import type { ActionHandlerContext, VapidConfig } from "./types";

export type ConsequencesExecutionContext = {
	db: DatabaseInstance;
	organizationId: string;
	eventData: Record<string, unknown>;
	ruleId: string;
	dryRun?: boolean;
	resendClient?: Resend;
	vapidConfig?: VapidConfig;
	createdBy?: string | null;
};

export type ConsequencesExecutionResult = {
	results: ConsequenceExecutionResult[];
	success: boolean;
	stoppedEarly: boolean;
	totalConsequences: number;
	executedConsequences: number;
	failedConsequences: number;
	skippedConsequences: number;
};

/**
 * Executes consequences from the rules-engine evaluation result.
 * Consequences are the aggregated results that contain action type and payload.
 */
export async function executeConsequences(
	consequences: AggregatedConsequence<WorkflowConsequences>[],
	context: ConsequencesExecutionContext,
): Promise<ConsequencesExecutionResult> {
	const results: ConsequenceExecutionResult[] = [];
	let stoppedEarly = false;
	let failedConsequences = 0;
	let skippedConsequences = 0;

	for (let i = 0; i < consequences.length; i++) {
		const consequence = consequences[i];
		if (!consequence) continue;
		const actionType = consequence.type as Consequence["type"];
		const payload = consequence.payload as ActionConfig;

		const handler = getActionHandler(actionType);

		if (!handler) {
			const result: ConsequenceExecutionResult = {
				consequenceIndex: i,
				error: `No handler registered for action type: ${actionType}`,
				success: false,
				type: actionType,
			};
			results.push(result);
			failedConsequences++;
			continue;
		}

		// Create context with previous results for this action
		const handlerContext: ActionHandlerContext = {
			db: context.db,
			dryRun: context.dryRun,
			eventData: context.eventData,
			organizationId: context.organizationId,
			resendClient: context.resendClient,
			ruleId: context.ruleId,
			vapidConfig: context.vapidConfig,
			previousResults: results,
			createdBy: context.createdBy,
		};

		try {
			// Create a compatible action-like structure for the handler
			const actionLike: Consequence = {
				payload,
				type: actionType as Consequence["type"],
			};

			const result = await handler.execute(actionLike, handlerContext);

			const consequenceResult: ConsequenceExecutionResult = {
				consequenceIndex: i,
				error: result.error,
				result: result.result,
				skipReason: result.skipReason,
				skipped: result.skipped,
				success: result.success,
				type: actionType,
				outputData: result.outputData,
			};

			results.push(consequenceResult);

			if (result.skipped) {
				skippedConsequences++;
				continue;
			}

			if (!result.success) {
				failedConsequences++;
				continue;
			}

			if (isStopExecutionResult(result)) {
				stoppedEarly = true;
				break;
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			const result: ConsequenceExecutionResult = {
				consequenceIndex: i,
				error: errorMessage,
				success: false,
				type: actionType,
			};
			results.push(result);
			failedConsequences++;
		}
	}

	const executedConsequences = results.filter((r) => !r.skipped).length;

	return {
		executedConsequences,
		failedConsequences,
		results,
		skippedConsequences,
		stoppedEarly,
		success: failedConsequences === 0,
		totalConsequences: consequences.length,
	};
}

/**
 * Validates consequences before execution.
 */
export async function validateConsequences(
	consequences: Consequence[],
): Promise<{ valid: boolean; errors: Map<number, string[]> }> {
	const errors = new Map<number, string[]>();

	for (let i = 0; i < consequences.length; i++) {
		const consequence = consequences[i];
		if (!consequence) continue;
		const handler = getActionHandler(consequence.type);

		if (!handler) {
			errors.set(i, [
				`No handler registered for action type: ${consequence.type}`,
			]);
			continue;
		}

		if (handler.validate) {
			const validationResult = handler.validate(consequence.payload);
			if (!validationResult.valid) {
				errors.set(i, validationResult.errors);
			}
		}
	}

	return {
		errors,
		valid: errors.size === 0,
	};
}
