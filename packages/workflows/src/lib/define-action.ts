import type { ActionType } from "@packages/database/schema";
import {
	actionDefinitionSchema,
	type ActionDefinition,
} from "../schemas/action-definition.schema";

/**
 * Defines and validates an action configuration.
 * Uses Zod to validate at runtime and TypeScript for compile-time type safety.
 *
 * @param type - The action type (must be a valid ActionType from the database schema)
 * @param config - The action configuration without the type field
 * @returns A validated ActionDefinition
 *
 * @example
 * ```ts
 * const setCategoryAction = defineAction("set_category", {
 *   label: "Set Category",
 *   description: "Assign categories to a transaction",
 *   category: "categorization",
 *   appliesTo: ["transaction"],
 *   fields: [
 *     { key: "categoryIds", type: "category-split", label: "Categories" }
 *   ]
 * });
 * ```
 */
export function defineAction<T extends ActionType>(
	type: T,
	config: Omit<ActionDefinition, "type">,
): ActionDefinition {
	const definition = { type, ...config };
	return actionDefinitionSchema.parse(definition);
}

/**
 * Creates an action definition without runtime validation.
 * Use this for performance-critical paths where validation is done elsewhere.
 *
 * @param type - The action type
 * @param config - The action configuration
 * @returns An ActionDefinition (unvalidated)
 */
export function createAction<T extends ActionType>(
	type: T,
	config: Omit<ActionDefinition, "type">,
): ActionDefinition {
	return { type, ...config };
}

/**
 * Validates all actions in an actions config object.
 * Call this during build/tests to ensure all actions are valid.
 *
 * @param config - Record of action type to action definition
 * @throws ZodError if any action definition is invalid
 */
export function validateActionsConfig(
	config: Record<string, ActionDefinition>,
): void {
	for (const [type, definition] of Object.entries(config)) {
		if (definition.type !== type) {
			throw new Error(
				`Action type mismatch: key "${type}" has type "${definition.type}"`,
			);
		}
		actionDefinitionSchema.parse(definition);
	}
}
