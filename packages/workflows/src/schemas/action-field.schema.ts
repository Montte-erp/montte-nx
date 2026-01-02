import { z } from "zod";
import { emailTemplateSchema } from "@packages/transactional/schemas/email-builder.schema";

// ============================================
// Data Source Schema (for dynamic options)
// ============================================

export const dataSourceSchema = z.enum([
	"categories",
	"tags",
	"bankAccounts",
	"costCenters",
	"members",
]);

export type DataSource = z.infer<typeof dataSourceSchema>;

// ============================================
// Base Field Schema
// ============================================

const baseFieldSchema = z.object({
	key: z.string(),
	label: z.string(),
	helpText: z.string().optional(),
	placeholder: z.string().optional(),
	required: z.boolean().optional(),
	tab: z.string().optional(),
	order: z.number().optional(),
	fullWidth: z.boolean().optional(),
	dependsOn: z
		.object({
			field: z.string(),
			value: z.unknown(),
		})
		.optional(),
});

// ============================================
// Field Type Schemas
// ============================================

export const stringFieldSchema = baseFieldSchema.extend({
	type: z.literal("string"),
	defaultValue: z.string().optional(),
});

export const numberFieldSchema = baseFieldSchema.extend({
	type: z.literal("number"),
	defaultValue: z.number().optional(),
	min: z.number().optional(),
	max: z.number().optional(),
});

export const booleanFieldSchema = baseFieldSchema.extend({
	type: z.literal("boolean"),
	defaultValue: z.boolean().optional(),
});

export const selectFieldSchema = baseFieldSchema.extend({
	type: z.literal("select"),
	options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
	defaultValue: z.string().optional(),
	dataSource: dataSourceSchema.optional(),
});

export const multiselectFieldSchema = baseFieldSchema.extend({
	type: z.literal("multiselect"),
	options: z
		.array(z.object({ value: z.string(), label: z.string() }))
		.optional(),
	defaultValue: z.array(z.string()).optional(),
	dataSource: dataSourceSchema.optional(),
});

export const templateFieldSchema = baseFieldSchema.extend({
	type: z.literal("template"),
	defaultValue: z.string().optional(),
	rows: z.number().optional(),
});

export const categorySplitFieldSchema = baseFieldSchema.extend({
	type: z.literal("category-split"),
});

export const emailBuilderFieldSchema = baseFieldSchema.extend({
	type: z.literal("email-builder"),
	defaultValue: emailTemplateSchema.optional(),
});

// ============================================
// Union of All Field Types
// ============================================

export const actionFieldSchema = z.discriminatedUnion("type", [
	stringFieldSchema,
	numberFieldSchema,
	booleanFieldSchema,
	selectFieldSchema,
	multiselectFieldSchema,
	templateFieldSchema,
	categorySplitFieldSchema,
	emailBuilderFieldSchema,
]);

// ============================================
// Inferred Types
// ============================================

export type StringField = z.infer<typeof stringFieldSchema>;
export type NumberField = z.infer<typeof numberFieldSchema>;
export type BooleanField = z.infer<typeof booleanFieldSchema>;
export type SelectField = z.infer<typeof selectFieldSchema>;
export type MultiselectField = z.infer<typeof multiselectFieldSchema>;
export type TemplateField = z.infer<typeof templateFieldSchema>;
export type CategorySplitField = z.infer<typeof categorySplitFieldSchema>;
export type EmailBuilderField = z.infer<typeof emailBuilderFieldSchema>;

export type ActionField = z.infer<typeof actionFieldSchema>;
export type ActionFieldType = ActionField["type"];
