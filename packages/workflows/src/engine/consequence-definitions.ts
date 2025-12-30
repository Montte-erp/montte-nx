import type { ConsequenceDefinitions } from "@f-o-t/rules-engine";
import type { ActionConfig } from "@packages/database/schema";
import { z } from "zod";

/**
 * Zod schema for action configuration payload.
 * Used as the payload type for all consequence types.
 */
const ActionConfigSchema = z.custom<ActionConfig>();

/**
 * Consequence definitions for the workflow engine.
 * Maps each action type to its payload schema.
 *
 * These are aligned with the ActionType enum from the database schema.
 */
export const WorkflowConsequences = {
	add_tag: ActionConfigSchema,
	create_transaction: ActionConfigSchema,
	mark_as_transfer: ActionConfigSchema,
	remove_tag: ActionConfigSchema,
	send_bills_digest: ActionConfigSchema,
	send_email: ActionConfigSchema,
	send_push_notification: ActionConfigSchema,
	set_category: ActionConfigSchema,
	set_cost_center: ActionConfigSchema,
	stop_execution: ActionConfigSchema,
	update_description: ActionConfigSchema,
} satisfies ConsequenceDefinitions;

export type WorkflowConsequences = typeof WorkflowConsequences;
