import { z } from "zod";
import { actionFieldSchema } from "./action-field.schema";

// ============================================
// Action Tab Schema
// ============================================

export const actionTabSchema = z.object({
	id: z.string(),
	label: z.string(),
	icon: z.string().optional(),
	order: z.number(),
	description: z.string().optional(),
});

// ============================================
// Action Category Schema
// ============================================

export const actionCategorySchema = z.enum([
	"categorization",
	"tagging",
	"modification",
	"creation",
	"notification",
	"control",
	"transformation",
	"data",
]);

// ============================================
// Action Applies To Schema
// ============================================

export const actionAppliesToSchema = z.enum(["transaction", "schedule", "budget"]);

// ============================================
// Action Documentation Schema
// ============================================

export const actionDocumentationSchema = z
	.object({
		howTo: z.array(z.string()).optional(),
		templates: z.record(z.string(), z.array(z.string())).optional(),
	})
	.optional();

// ============================================
// Data Flow Schema
// ============================================

export const dataFlowSchema = z.object({
	/** Data type this action produces (e.g., "bills_data", "formatted_file") */
	produces: z.string().optional(),
	/** Display label for produced data */
	producesLabel: z.string().optional(),
	/** Data type this action requires from an upstream action */
	requires: z.string().optional(),
	/** Display label for required data */
	requiresLabel: z.string().optional(),
	/** Optional data types this action can use */
	optionalInputs: z.array(z.string()).optional(),
	/** Display label for optional inputs */
	optionalInputsLabel: z.string().optional(),
});

// ============================================
// Action Definition Schema
// ============================================

export const actionDefinitionSchema = z.object({
	type: z.string(),
	label: z.string(),
	description: z.string(),
	category: actionCategorySchema,
	appliesTo: z.array(actionAppliesToSchema),
	tabs: z.array(actionTabSchema).optional(),
	defaultTab: z.string().optional(),
	fields: z.array(actionFieldSchema),
	documentation: actionDocumentationSchema,
	dataFlow: dataFlowSchema.optional(),
});

// ============================================
// Inferred Types
// ============================================

export type ActionTab = z.infer<typeof actionTabSchema>;
export type ActionCategory = z.infer<typeof actionCategorySchema>;
export type ActionAppliesTo = z.infer<typeof actionAppliesToSchema>;
export type ActionDocumentation = z.infer<typeof actionDocumentationSchema>;
export type DataFlow = z.infer<typeof dataFlowSchema>;
export type ActionDefinition = z.infer<typeof actionDefinitionSchema>;

// ============================================
// Validation Functions
// ============================================

export function validateActionDefinition(data: unknown): ActionDefinition {
	return actionDefinitionSchema.parse(data);
}
