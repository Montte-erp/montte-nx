import {
	createEngine,
	type Engine,
	type EngineConfig,
} from "@f-o-t/rules-engine";
import type { DatabaseInstance } from "@packages/database/client";
import { DEFAULT_CACHE_MAX_SIZE, DEFAULT_CACHE_TTL_MS } from "../constants";
import {
	WorkflowConsequences,
	type WorkflowConsequences as WorkflowConsequencesType,
} from "./consequence-definitions";

/**
 * Context data for transaction-based rule evaluation.
 * Represents the transaction data that rules are evaluated against.
 */
export type TransactionContext = {
	id: string;
	organizationId: string;
	bankAccountId?: string | null;
	description: string;
	amount: number;
	type: "income" | "expense" | "transfer";
	date: string;
	categoryIds: string[];
	costCenterId?: string | null;
	counterpartyId?: string | null;
	tagIds: string[];
	metadata: Record<string, unknown>;
};

export type WorkflowEngineConfig = {
	db: DatabaseInstance;
	cacheEnabled?: boolean;
	cacheTtl?: number;
	cacheMaxSize?: number;
	continueOnError?: boolean;
};

export type WorkflowEngine = Engine<TransactionContext, WorkflowConsequencesType>;

/**
 * Creates a workflow engine instance powered by the rules-engine.
 *
 * The engine provides:
 * - Rule evaluation with caching
 * - Priority-based conflict resolution
 * - Lifecycle hooks for logging/telemetry
 */
export function createWorkflowEngine(
	config: WorkflowEngineConfig,
): WorkflowEngine {
	const engineConfig: EngineConfig<
		TransactionContext,
		WorkflowConsequencesType
	> = {
		cache: {
			enabled: config.cacheEnabled ?? true,
			maxSize: config.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE,
			ttl: config.cacheTtl ?? DEFAULT_CACHE_TTL_MS,
		},
		conflictResolution: "priority",
		consequences: WorkflowConsequences,
		continueOnError: config.continueOnError ?? true,
		hooks: {
			onRuleError: (rule, error) => {
				console.error(`[Workflow] Rule "${rule.name}" (${rule.id}) error:`, error);
			},
		},
	};

	return createEngine<TransactionContext, WorkflowConsequencesType>(engineConfig);
}
