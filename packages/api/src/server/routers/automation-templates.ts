import { ConditionGroupSchema } from "@f-o-t/rules-engine";
import {
	createAutomationRule,
} from "@packages/database/repositories/automation-repository";
import {
	createAutomationTemplate,
	deleteAutomationTemplate,
	findAutomationTemplateById,
	findAvailableTemplates,
	findOrganizationTemplates,
	recordTemplateUsage,
	updateAutomationTemplate,
} from "@packages/database/repositories/automation-template-repository";
import type {
	Consequence,
	FlowData,
	TriggerConfig,
} from "@packages/database/schema";
import { APIError } from "@packages/utils/errors";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const templateCategorySchema = z.enum([
	"bill_management",
	"transaction_processing",
	"notifications",
	"reporting",
	"custom",
]);

const triggerTypeSchema = z.enum([
	"transaction.created",
	"transaction.updated",
	"schedule.daily",
	"schedule.weekly",
	"schedule.biweekly",
	"schedule.custom",
]);

const triggerConfigSchema = z.object({
	time: z.string().optional(),
	timezone: z.string().optional(),
	dayOfWeek: z.number().min(0).max(6).optional(),
	cronPattern: z.string().optional(),
}).optional().default({});

const actionConfigSchema = z.object({
	// All possible action config fields (same as automations router)
	amountField: z.string().optional(),
	amountFixed: z.number().optional(),
	bankAccountId: z.string().optional(),
	body: z.string().optional(),
	categoryId: z.string().optional(),
	categoryIds: z.array(z.string()).optional(),
	categorySplitMode: z.enum(["equal", "percentage", "fixed", "dynamic"]).optional(),
	categorySplits: z.array(z.object({ categoryId: z.string(), value: z.number() })).optional(),
	costCenterId: z.string().optional(),
	customEmail: z.string().optional(),
	dateField: z.string().optional(),
	description: z.string().optional(),
	dynamicSplitPattern: z.string().optional(),
	mode: z.enum(["replace", "append", "prepend"]).optional(),
	reason: z.string().optional(),
	subject: z.string().optional(),
	tagIds: z.array(z.string()).optional(),
	template: z.boolean().optional(),
	title: z.string().optional(),
	to: z.enum(["owner", "custom"]).optional(),
	toBankAccountId: z.string().optional(),
	type: z.enum(["income", "expense"]).optional(),
	url: z.string().optional(),
	value: z.string().optional(),
	recipients: z.enum(["owner", "all_members", "specific"]).optional(),
	memberIds: z.array(z.string()).optional(),
	detailLevel: z.enum(["summary", "detailed", "full"]).optional(),
	includePending: z.boolean().optional(),
	includeOverdue: z.boolean().optional(),
	daysAhead: z.number().min(1).max(90).optional(),
	billTypes: z.array(z.enum(["expense", "income"])).optional(),
	useTemplate: z.enum(["bills_digest", "custom", "visual"]).optional(),
	includeAttachment: z.boolean().optional(),
	outputFormat: z.enum(["csv", "pdf", "html_table", "json"]).optional(),
	fileName: z.string().optional(),
	csvIncludeHeaders: z.boolean().optional(),
	csvDelimiter: z.enum([",", ";", "\t"]).optional(),
	pdfTemplate: z.enum(["bills_report", "custom"]).optional(),
	pdfPageSize: z.enum(["A4", "Letter"]).optional(),
	htmlTableStyle: z.enum(["default", "striped", "bordered"]).optional(),
	emailTemplate: z.object({
		blocks: z.array(z.unknown()),
		styles: z.object({
			primaryColor: z.string().optional(),
			backgroundColor: z.string().optional(),
			textColor: z.string().optional(),
			fontFamily: z.enum(["sans-serif", "serif", "monospace"]).optional(),
		}).optional(),
	}).optional(),
});

const actionTypeSchema = z.enum([
	"set_category",
	"add_tag",
	"remove_tag",
	"set_cost_center",
	"update_description",
	"create_transaction",
	"mark_as_transfer",
	"send_push_notification",
	"send_email",
	"fetch_bills_report",
	"format_data",
	"stop_execution",
]);

const consequenceSchema = z.object({
	type: actionTypeSchema,
	payload: actionConfigSchema,
});

const flowDataSchema = z.object({
	nodes: z.array(z.unknown()),
	edges: z.array(z.unknown()),
	viewport: z.object({
		x: z.number(),
		y: z.number(),
		zoom: z.number(),
	}).optional(),
});

const createTemplateSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().min(1, "Description is required"),
	category: templateCategorySchema.default("custom"),
	flowData: flowDataSchema,
	triggerType: triggerTypeSchema,
	triggerConfig: triggerConfigSchema,
	conditions: ConditionGroupSchema.optional(),
	consequences: z.array(consequenceSchema),
	icon: z.string().optional(),
	tags: z.array(z.string()).optional(),
});

const updateTemplateSchema = z.object({
	name: z.string().min(1).optional(),
	description: z.string().min(1).optional(),
	category: templateCategorySchema.optional(),
	flowData: flowDataSchema.optional(),
	triggerType: triggerTypeSchema.optional(),
	triggerConfig: triggerConfigSchema.optional(),
	conditions: ConditionGroupSchema.optional(),
	consequences: z.array(consequenceSchema).optional(),
	icon: z.string().optional(),
	tags: z.array(z.string()).optional(),
});

export const automationTemplateRouter = router({
	/**
	 * List available templates (system + organization)
	 */
	list: protectedProcedure
		.input(
			z.object({
				category: templateCategorySchema.optional(),
				search: z.string().optional(),
			}).optional(),
		)
		.query(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;

			return findAvailableTemplates(resolvedCtx.db, organizationId, {
				category: input?.category,
				search: input?.search,
			});
		}),

	/**
	 * List only organization's own templates
	 */
	listOwn: protectedProcedure.query(async ({ ctx }) => {
		const resolvedCtx = await ctx;
		const organizationId = resolvedCtx.organizationId;

		return findOrganizationTemplates(resolvedCtx.db, organizationId);
	}),

	/**
	 * Get a single template by ID
	 */
	getById: protectedProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;

			const template = await findAutomationTemplateById(
				resolvedCtx.db,
				input.id,
			);

			if (!template) {
				throw APIError.notFound("Template not found");
			}

			// Allow access to system templates or own organization's templates
			if (
				!template.isSystemTemplate &&
				template.organizationId !== organizationId
			) {
				throw APIError.forbidden("Access denied to this template");
			}

			return template;
		}),

	/**
	 * Apply a template to create a new automation rule
	 */
	applyTemplate: protectedProcedure
		.input(
			z.object({
				templateId: z.string(),
				name: z.string().min(1, "Automation name is required"),
				enabled: z.boolean().default(false),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;
			const userId = resolvedCtx.session?.user?.id;

			const template = await findAutomationTemplateById(
				resolvedCtx.db,
				input.templateId,
			);

			if (!template) {
				throw APIError.notFound("Template not found");
			}

			// Allow access to system templates or own organization's templates
			if (
				!template.isSystemTemplate &&
				template.organizationId !== organizationId
			) {
				throw APIError.forbidden("Access denied to this template");
			}

			// Create the automation rule from the template
			const createdRule = await createAutomationRule(resolvedCtx.db, {
				name: input.name,
				description: template.description,
				triggerType: template.triggerType,
				triggerConfig: template.triggerConfig as TriggerConfig,
				conditions: template.conditions,
				consequences: template.consequences as Consequence[],
				flowData: template.flowData as FlowData,
				enabled: input.enabled,
				organizationId,
				createdBy: userId,
			});

			// Record the template usage
			if (createdRule) {
				await recordTemplateUsage(resolvedCtx.db, {
					templateId: template.id,
					automationRuleId: createdRule.id,
					organizationId,
					createdBy: userId,
				});
			}

			return createdRule;
		}),

	/**
	 * Create a new template from an existing automation or from scratch
	 */
	create: protectedProcedure
		.input(createTemplateSchema)
		.mutation(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;
			const userId = resolvedCtx.session?.user?.id;

			const conditions = input.conditions ?? {
				id: crypto.randomUUID(),
				operator: "AND" as const,
				conditions: [],
			};

			return createAutomationTemplate(resolvedCtx.db, {
				name: input.name,
				description: input.description,
				category: input.category,
				flowData: input.flowData as FlowData,
				triggerType: input.triggerType,
				triggerConfig: input.triggerConfig as TriggerConfig,
				conditions,
				consequences: input.consequences as Consequence[],
				icon: input.icon,
				tags: input.tags ?? [],
				organizationId,
				createdBy: userId,
				isSystemTemplate: false,
			});
		}),

	/**
	 * Save current automation as a template
	 */
	saveFromAutomation: protectedProcedure
		.input(
			z.object({
				automationId: z.string(),
				name: z.string().min(1, "Template name is required"),
				description: z.string().min(1, "Template description is required"),
				category: templateCategorySchema.default("custom"),
				icon: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;
			const userId = resolvedCtx.session?.user?.id;

			// Import dynamically to avoid circular dependency
			const { findAutomationRuleById } = await import(
				"@packages/database/repositories/automation-repository"
			);

			const automation = await findAutomationRuleById(
				resolvedCtx.db,
				input.automationId,
			);

			if (!automation || automation.organizationId !== organizationId) {
				throw APIError.notFound("Automation not found");
			}

			return createAutomationTemplate(resolvedCtx.db, {
				name: input.name,
				description: input.description,
				category: input.category,
				flowData: automation.flowData as FlowData,
				triggerType: automation.triggerType,
				triggerConfig: automation.triggerConfig as TriggerConfig,
				conditions: automation.conditions,
				consequences: automation.consequences as Consequence[],
				icon: input.icon,
				tags: automation.tags ?? [],
				organizationId,
				createdBy: userId,
				isSystemTemplate: false,
			});
		}),

	/**
	 * Update an organization template
	 */
	update: protectedProcedure
		.input(
			z.object({
				id: z.string(),
				data: updateTemplateSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;

			const existingTemplate = await findAutomationTemplateById(
				resolvedCtx.db,
				input.id,
			);

			if (!existingTemplate) {
				throw APIError.notFound("Template not found");
			}

			if (existingTemplate.isSystemTemplate) {
				throw APIError.forbidden("Cannot modify system templates");
			}

			if (existingTemplate.organizationId !== organizationId) {
				throw APIError.forbidden("Access denied to this template");
			}

			return updateAutomationTemplate(resolvedCtx.db, input.id, {
				...input.data,
				flowData: input.data.flowData as FlowData | undefined,
				triggerConfig: input.data.triggerConfig as TriggerConfig | undefined,
				consequences: input.data.consequences as Consequence[] | undefined,
			});
		}),

	/**
	 * Delete an organization template
	 */
	delete: protectedProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const resolvedCtx = await ctx;
			const organizationId = resolvedCtx.organizationId;

			return deleteAutomationTemplate(
				resolvedCtx.db,
				input.id,
				organizationId,
			);
		}),
});
