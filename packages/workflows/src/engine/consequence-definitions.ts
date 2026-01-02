import type { ConsequenceDefinitions } from "@f-o-t/rules-engine";
import { z } from "zod";

/**
 * Zod schema for action configuration payload.
 */
const ActionConfigSchema = z.any();

/**
 * Consequence definitions for the workflow engine.
 * Maps each action type to its payload schema.
 *
 * These are aligned with the ActionType enum from the database schema.
 * 
 * Note: Type assertion needed due to Zod version differences between packages.
 */
export const WorkflowConsequences = {
	add_tag: ActionConfigSchema,
	create_transaction: ActionConfigSchema,
	fetch_bills_report: ActionConfigSchema,
	format_data: ActionConfigSchema,
	mark_as_transfer: ActionConfigSchema,
	remove_tag: ActionConfigSchema,
	send_email: ActionConfigSchema,
	send_push_notification: ActionConfigSchema,
	set_category: ActionConfigSchema,
	set_cost_center: ActionConfigSchema,
	stop_execution: ActionConfigSchema,
	update_description: ActionConfigSchema,
} as unknown as ConsequenceDefinitions;

export type WorkflowConsequences = typeof WorkflowConsequences;
