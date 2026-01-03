import type { DatabaseInstance } from "@packages/database/client";
import type { ActionConfig, Consequence } from "@packages/database/schema";
import type { Resend } from "resend";
import type { ActionExecutionResult, ConsequenceExecutionResult } from "../types/actions";

export type VapidConfig = {
	publicKey: string;
	privateKey: string;
	subject: string;
};

export type ActionHandlerContext = {
	db: DatabaseInstance;
	organizationId: string;
	eventData: Record<string, unknown>;
	ruleId: string;
	dryRun?: boolean;
	resendClient?: Resend;
	vapidConfig?: VapidConfig;
	previousResults?: ConsequenceExecutionResult[];
	createdBy?: string | null;
};

export type ActionHandler = {
	type: Consequence["type"];
	execute: (
		consequence: Consequence,
		context: ActionHandlerContext,
	) => Promise<ActionExecutionResult>;
	validate?: (payload: ActionConfig) => {
		valid: boolean;
		errors: string[];
	};
};

export function createActionResult(
	consequence: Consequence,
	success: boolean,
	result?: unknown,
	error?: string,
): ActionExecutionResult {
	return {
		error,
		result,
		success,
		type: consequence.type,
	};
}

export function createSkippedResult(
	consequence: Consequence,
	reason: string,
): ActionExecutionResult {
	return {
		skipReason: reason,
		skipped: true,
		success: true,
		type: consequence.type,
	};
}

/**
 * Extracts and merges all outputData from previous action results.
 * Later results override earlier ones if keys conflict.
 */
export function getPreviousOutputData(
	previousResults?: ConsequenceExecutionResult[],
): Record<string, unknown> {
	if (!previousResults || previousResults.length === 0) {
		return {};
	}

	return previousResults.reduce((acc, result) => {
		if (result.outputData) {
			return { ...acc, ...result.outputData };
		}
		return acc;
	}, {} as Record<string, unknown>);
}

/**
 * Helper to create an action result with output data for subsequent actions.
 */
export function createActionResultWithOutput(
	consequence: Consequence,
	success: boolean,
	outputData: Record<string, unknown>,
	result?: unknown,
	error?: string,
): ActionExecutionResult {
	return {
		error,
		outputData,
		result,
		success,
		type: consequence.type,
	};
}
