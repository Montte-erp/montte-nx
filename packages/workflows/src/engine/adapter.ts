import type { TransactionEventData } from "../types/events";
import type { TransactionContext } from "./factory";

/**
 * Adapts transaction event data to the evaluation context format
 * expected by the rules engine.
 */
export function adaptEventDataToContext(
	eventData: TransactionEventData,
): TransactionContext {
	return {
		amount: eventData.amount,
		bankAccountId: eventData.bankAccountId,
		categoryIds: eventData.categoryIds ?? [],
		costCenterId: eventData.costCenterId,
		counterpartyId: eventData.counterpartyId,
		date: eventData.date,
		description: eventData.description,
		id: eventData.id,
		metadata: eventData.metadata ?? {},
		organizationId: eventData.organizationId,
		tagIds: eventData.tagIds ?? [],
		type: eventData.type,
	};
}

/**
 * @internal Test-only function - not part of public API
 * Gets a value from a context object by dot-notation path.
 * Useful for accessing nested properties in condition evaluation.
 */
export function getContextValue(
	context: Record<string, unknown>,
	path: string,
): unknown {
	const parts = path.split(".");
	let current: unknown = context;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}
