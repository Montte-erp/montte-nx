import { type ConditionGroup, ConditionGroupSchema } from "@f-o-t/rules-engine";
import {
	findAutomationLogsByOrganizationIdPaginated,
	findAutomationLogsByRuleId,
	findRecentAutomationLogs,
	getAutomationLogStats,
	getAverageExecutionTime,
} from "@packages/database/repositories/automation-log-repository";
import {
	createAutomationRule,
	deleteAutomationRule,
	deleteManyAutomationRules,
	duplicateAutomationRule,
	findAutomationRuleById,
	findAutomationRulesByOrganizationId,
	findAutomationRulesByOrganizationIdPaginated,
	getActiveAutomationRulesCount,
	getTotalAutomationRulesByOrganizationId,
	toggleAutomationRule,
	updateAutomationRule,
} from "@packages/database/repositories/automation-repository";
import {
	computeDiff,
	createSnapshotFromRule,
	createVersion,
	getVersionHistory,
} from "@packages/database/repositories/automation-version-repository";
import type {
	AutomationRuleVersionSnapshot,
	Consequence,
	FlowData,
	ScheduleTriggerConfig,
	ScheduleTriggerType,
	TriggerConfig,
	TriggerType,
} from "@packages/database/schema";
import { APIError } from "@packages/utils/errors";
import { enqueueManualWorkflowRun } from "@packages/workflows/queue/producer";
import {
	removeScheduleJob,
	upsertScheduleJob,
} from "@packages/workflows/queue/schedule-jobs";
import {
	createScheduleTriggeredEvent,
	createTransactionCreatedEvent,
	createTransactionUpdatedEvent,
	type WorkflowEvent,
} from "@packages/workflows/types/events";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

const triggerTypeSchema = z.enum([
	"transaction.created",
	"transaction.updated",
	"schedule.daily",
	"schedule.weekly",
	"schedule.biweekly",
	"schedule.custom",
]);

const scheduleTriggerConfigSchema = z.object({
	time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
	timezone: z.string().default("America/Sao_Paulo"),
	dayOfWeek: z.number().min(0).max(6).optional(),
	cronPattern: z.string().optional(),
});

const triggerConfigSchema = z.union([
	scheduleTriggerConfigSchema,
	z.object({}).default({}),
]).optional().default({});

/**
 * Helper to check if a trigger type is a schedule trigger
 */
function isScheduleTrigger(triggerType: string): triggerType is ScheduleTriggerType {
	return triggerType.startsWith("schedule.");
}

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
   "send_bills_digest",
   "fetch_bills_report",
   "format_data",
   "stop_execution",
]);

const categorySplitConfigSchema = z.object({
   categoryId: z.string(),
   value: z.number().min(0),
});

const actionConfigSchema = z.object({
   amountField: z.string().optional(),
   amountFixed: z.number().optional(),
   bankAccountId: z.string().optional(),
   body: z.string().optional(),
   categoryId: z.string().optional(),
   categoryIds: z.array(z.string()).optional(),
   categorySplitMode: z
      .enum(["equal", "percentage", "fixed", "dynamic"])
      .optional(),
   categorySplits: z.array(categorySplitConfigSchema).optional(),
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
   // send_bills_digest and fetch_bills_report fields
   recipients: z.enum(["owner", "all_members", "specific"]).optional(),
   memberIds: z.array(z.string()).optional(),
   detailLevel: z.enum(["summary", "detailed", "full"]).optional(),
   includePending: z.boolean().optional(),
   includeOverdue: z.boolean().optional(),
   daysAhead: z.number().min(1).max(90).optional(),
   billTypes: z.array(z.enum(["expense", "income"])).optional(),
   // send_email template mode
   useTemplate: z.enum(["bills_digest", "custom"]).optional(),
   // send_email attachment support
   includeAttachment: z.boolean().optional(),
   // format_data config
   outputFormat: z.enum(["csv", "pdf", "html_table", "json"]).optional(),
   fileName: z.string().optional(),
   csvIncludeHeaders: z.boolean().optional(),
   csvDelimiter: z.enum([",", ";", "\t"]).optional(),
   pdfTemplate: z.enum(["bills_report", "custom"]).optional(),
   pdfPageSize: z.enum(["A4", "Letter"]).optional(),
   htmlTableStyle: z.enum(["default", "striped", "bordered"]).optional(),
});

const consequenceSchema = z.object({
   payload: actionConfigSchema,
   type: actionTypeSchema,
});

const flowDataSchema = z
   .object({
      edges: z.array(z.unknown()),
      nodes: z.array(z.unknown()),
      viewport: z
         .object({
            x: z.number(),
            y: z.number(),
            zoom: z.number(),
         })
         .optional(),
   })
   .optional()
   .nullable();

const createAutomationRuleSchema = z.object({
   consequences: z
      .array(consequenceSchema)
      .min(1, "At least one consequence is required"),
   conditions: ConditionGroupSchema.optional(),
   description: z.string().optional(),
   flowData: flowDataSchema,
   enabled: z.boolean().default(false),
   name: z.string().min(1, "Name is required"),
   priority: z.number().int().default(0),
   stopOnMatch: z.boolean().default(false),
   triggerConfig: triggerConfigSchema,
   triggerType: triggerTypeSchema,
});

const updateAutomationRuleSchema = z.object({
   consequences: z.array(consequenceSchema).optional(),
   conditions: ConditionGroupSchema.optional(),
   description: z.string().optional().nullable(),
   flowData: flowDataSchema,
   enabled: z.boolean().optional(),
   name: z.string().min(1).optional(),
   priority: z.number().int().optional(),
   stopOnMatch: z.boolean().optional(),
   triggerConfig: triggerConfigSchema.optional(),
   triggerType: triggerTypeSchema.optional(),
});

const paginationSchema = z.object({
   enabled: z.boolean().optional(),
   limit: z.coerce.number().min(1).max(100).default(10),
   orderBy: z
      .enum(["name", "createdAt", "updatedAt", "priority"])
      .default("priority"),
   orderDirection: z.enum(["asc", "desc"]).default("desc"),
   page: z.coerce.number().min(1).default(1),
   search: z.string().optional(),
   triggerType: triggerTypeSchema.optional(),
});

const logPaginationSchema = z.object({
   endDate: z.coerce.date().optional(),
   limit: z.coerce.number().min(1).max(100).default(20),
   page: z.coerce.number().min(1).default(1),
   startDate: z.coerce.date().optional(),
   status: z.enum(["success", "partial", "failed", "skipped"]).optional(),
   triggerType: triggerTypeSchema.optional(),
});

export const automationRouter = router({
   create: protectedProcedure
      .input(createAutomationRuleSchema)
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.session?.user?.id;

         // Default empty condition group if none provided
         const conditions: ConditionGroup = input.conditions
            ? (input.conditions as ConditionGroup)
            : { id: crypto.randomUUID(), operator: "AND", conditions: [] };

         const createdRule = await createAutomationRule(resolvedCtx.db, {
            ...input,
            consequences: input.consequences as Consequence[],
            conditions,
            createdBy: userId,
            flowData: input.flowData as FlowData | undefined,
            organizationId,
            triggerConfig: input.triggerConfig as TriggerConfig,
         });

         if (createdRule) {
            const snapshot = createSnapshotFromRule(createdRule);
            await createVersion(resolvedCtx.db, {
               changeType: "created",
               changedBy: userId,
               ruleId: createdRule.id,
               snapshot: snapshot as AutomationRuleVersionSnapshot,
            });

            // Create schedule job if this is a schedule trigger and enabled
            if (isScheduleTrigger(input.triggerType) && input.enabled) {
               try {
                  await upsertScheduleJob(
                     createdRule.id,
                     organizationId,
                     input.triggerType as ScheduleTriggerType,
                     input.triggerConfig as ScheduleTriggerConfig,
                  );
               } catch (error) {
                  console.error("Failed to create schedule job:", error);
               }
            }
         }

         return createdRule;
      }),

   delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingRule = await findAutomationRuleById(
            resolvedCtx.db,
            input.id,
         );

         if (!existingRule || existingRule.organizationId !== organizationId) {
            throw APIError.notFound("Automation rule not found");
         }

         // Remove schedule job if this is a schedule trigger
         if (isScheduleTrigger(existingRule.triggerType)) {
            try {
               await removeScheduleJob(input.id);
            } catch (error) {
               console.error("Failed to remove schedule job:", error);
            }
         }

         return deleteAutomationRule(resolvedCtx.db, input.id);
      }),

   deleteMany: protectedProcedure
      .input(z.object({ ids: z.array(z.string()) }))
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         // Remove schedule jobs for all rules being deleted
         for (const id of input.ids) {
            try {
               await removeScheduleJob(id);
            } catch (error) {
               console.error(`Failed to remove schedule job for rule ${id}:`, error);
            }
         }

         return deleteManyAutomationRules(
            resolvedCtx.db,
            input.ids,
            organizationId,
         );
      }),

   duplicate: protectedProcedure
      .input(
         z.object({
            id: z.string(),
            newName: z.string().min(1),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingRule = await findAutomationRuleById(
            resolvedCtx.db,
            input.id,
         );

         if (!existingRule || existingRule.organizationId !== organizationId) {
            throw APIError.notFound("Automation rule not found");
         }

         return duplicateAutomationRule(
            resolvedCtx.db,
            input.id,
            input.newName,
         );
      }),

   getAll: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      return findAutomationRulesByOrganizationId(
         resolvedCtx.db,
         organizationId,
      );
   }),

   getAllPaginated: protectedProcedure
      .input(paginationSchema)
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         return findAutomationRulesByOrganizationIdPaginated(
            resolvedCtx.db,
            organizationId,
            {
               enabled: input.enabled,
               limit: input.limit,
               orderBy: input.orderBy,
               orderDirection: input.orderDirection,
               page: input.page,
               search: input.search,
               triggerType: input.triggerType as TriggerType | undefined,
            },
         );
      }),

   getById: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const rule = await findAutomationRuleById(resolvedCtx.db, input.id);

         if (!rule || rule.organizationId !== organizationId) {
            throw APIError.notFound("Automation rule not found");
         }

         return rule;
      }),

   getStats: protectedProcedure.query(async ({ ctx }) => {
      const resolvedCtx = await ctx;
      const organizationId = resolvedCtx.organizationId;

      const [totalRules, activeRules, logStats, avgExecutionTime] =
         await Promise.all([
            getTotalAutomationRulesByOrganizationId(
               resolvedCtx.db,
               organizationId,
            ),
            getActiveAutomationRulesCount(resolvedCtx.db, organizationId),
            getAutomationLogStats(resolvedCtx.db, organizationId),
            getAverageExecutionTime(resolvedCtx.db, organizationId),
         ]);

      return {
         activeRules,
         avgExecutionTimeMs: avgExecutionTime,
         executionStats: logStats,
         inactiveRules: totalRules - activeRules,
         totalRules,
      };
   }),

   logs: router({
      getAllPaginated: protectedProcedure
         .input(logPaginationSchema)
         .query(async ({ ctx, input }) => {
            const resolvedCtx = await ctx;
            const organizationId = resolvedCtx.organizationId;

            return findAutomationLogsByOrganizationIdPaginated(
               resolvedCtx.db,
               organizationId,
               {
                  endDate: input.endDate,
                  limit: input.limit,
                  page: input.page,
                  startDate: input.startDate,
                  status: input.status,
                  triggerType: input.triggerType as TriggerType | undefined,
               },
            );
         }),
      getByRuleId: protectedProcedure
         .input(
            z.object({
               limit: z.coerce.number().min(1).max(100).default(20),
               page: z.coerce.number().min(1).default(1),
               ruleId: z.string(),
               status: z
                  .enum(["success", "partial", "failed", "skipped"])
                  .optional(),
            }),
         )
         .query(async ({ ctx, input }) => {
            const resolvedCtx = await ctx;
            const organizationId = resolvedCtx.organizationId;

            const rule = await findAutomationRuleById(
               resolvedCtx.db,
               input.ruleId,
            );

            if (!rule || rule.organizationId !== organizationId) {
               throw APIError.notFound("Automation rule not found");
            }

            return findAutomationLogsByRuleId(resolvedCtx.db, input.ruleId, {
               limit: input.limit,
               page: input.page,
               status: input.status,
            });
         }),

      getRecent: protectedProcedure
         .input(
            z.object({ limit: z.coerce.number().min(1).max(50).default(10) }),
         )
         .query(async ({ ctx, input }) => {
            const resolvedCtx = await ctx;
            const organizationId = resolvedCtx.organizationId;

            return findRecentAutomationLogs(
               resolvedCtx.db,
               organizationId,
               input.limit,
            );
         }),

      getStats: protectedProcedure
         .input(
            z.object({
               endDate: z.coerce.date().optional(),
               startDate: z.coerce.date().optional(),
            }),
         )
         .query(async ({ ctx, input }) => {
            const resolvedCtx = await ctx;
            const organizationId = resolvedCtx.organizationId;

            return getAutomationLogStats(resolvedCtx.db, organizationId, {
               endDate: input.endDate,
               startDate: input.startDate,
            });
         }),
   }),

   versions: router({
      getHistory: protectedProcedure
         .input(
            z.object({
               limit: z.coerce.number().min(1).max(100).default(20),
               page: z.coerce.number().min(1).default(1),
               ruleId: z.string(),
            }),
         )
         .query(async ({ ctx, input }) => {
            const resolvedCtx = await ctx;
            const organizationId = resolvedCtx.organizationId;

            const rule = await findAutomationRuleById(
               resolvedCtx.db,
               input.ruleId,
            );

            if (!rule || rule.organizationId !== organizationId) {
               throw APIError.notFound("Automation rule not found");
            }

            const offset = (input.page - 1) * input.limit;

            return getVersionHistory(resolvedCtx.db, input.ruleId, {
               limit: input.limit,
               offset,
            });
         }),
   }),

   toggle: protectedProcedure
      .input(
         z.object({
            id: z.string(),
            enabled: z.boolean(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const existingRule = await findAutomationRuleById(
            resolvedCtx.db,
            input.id,
         );

         if (!existingRule || existingRule.organizationId !== organizationId) {
            throw APIError.notFound("Automation rule not found");
         }

         // Manage schedule job based on enabled state
         if (isScheduleTrigger(existingRule.triggerType)) {
            try {
               if (input.enabled) {
                  await upsertScheduleJob(
                     input.id,
                     organizationId,
                     existingRule.triggerType as ScheduleTriggerType,
                     existingRule.triggerConfig as ScheduleTriggerConfig,
                  );
               } else {
                  await removeScheduleJob(input.id);
               }
            } catch (error) {
               console.error("Failed to manage schedule job:", error);
            }
         }

         return toggleAutomationRule(resolvedCtx.db, input.id, input.enabled);
      }),

   triggerManually: protectedProcedure
      .input(
         z.object({
            ruleId: z.string(),
            testData: z
               .object({
                  transaction: z
                     .object({
                        amount: z.number(),
                        bankAccountId: z.string().optional(),
                        categoryIds: z.array(z.string()).optional(),
                        costCenterId: z.string().optional(),
                        counterpartyId: z.string().optional(),
                        date: z.string().optional(),
                        description: z.string(),
                        id: z.string().optional(),
                        metadata: z.record(z.string(), z.unknown()).optional(),
                        tagIds: z.array(z.string()).optional(),
                        type: z.enum(["income", "expense", "transfer"]),
                     })
                     .optional(),
               })
               .optional(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;

         const rule = await findAutomationRuleById(
            resolvedCtx.db,
            input.ruleId,
         );

         if (!rule || rule.organizationId !== organizationId) {
            throw APIError.notFound("Automation rule not found");
         }

         if (!rule.enabled) {
            throw APIError.validation(
               "Cannot trigger inactive automation rule",
            );
         }

         if (
            rule.triggerType !== "transaction.created" &&
            rule.triggerType !== "transaction.updated"
         ) {
            throw APIError.validation(
               "Manual trigger is only supported for transaction-based automations",
            );
         }

         const txData = input.testData?.transaction ?? {
            amount: 100,
            description: "Test Transaction",
            type: "expense" as const,
         };

         const eventData = {
            amount: txData.amount,
            bankAccountId: txData.bankAccountId ?? null,
            categoryIds: txData.categoryIds ?? [],
            costCenterId: txData.costCenterId ?? null,
            counterpartyId: txData.counterpartyId ?? null,
            date: txData.date ?? new Date().toISOString(),
            description: txData.description,
            id: txData.id ?? crypto.randomUUID(),
            metadata: txData.metadata ?? {},
            organizationId,
            tagIds: txData.tagIds ?? [],
            type: txData.type,
         };

         const event: WorkflowEvent =
            rule.triggerType === "transaction.created"
               ? createTransactionCreatedEvent(organizationId, eventData)
               : createTransactionUpdatedEvent(organizationId, eventData);

         const jobId = await enqueueManualWorkflowRun(event);

         return {
            eventId: event.id,
            jobId,
            status: "queued",
            triggerType: rule.triggerType,
         };
      }),

   update: protectedProcedure
      .input(
         z.object({
            data: updateAutomationRuleSchema,
            id: z.string(),
         }),
      )
      .mutation(async ({ ctx, input }) => {
         const resolvedCtx = await ctx;
         const organizationId = resolvedCtx.organizationId;
         const userId = resolvedCtx.session?.user?.id;

         const existingRule = await findAutomationRuleById(
            resolvedCtx.db,
            input.id,
         );

         if (!existingRule || existingRule.organizationId !== organizationId) {
            throw APIError.notFound("Automation rule not found");
         }

         const oldSnapshot = createSnapshotFromRule(existingRule);

         const updatedRule = await updateAutomationRule(
            resolvedCtx.db,
            input.id,
            {
               ...input.data,
               consequences: input.data.consequences as
                  | Consequence[]
                  | undefined,
               conditions: input.data.conditions as ConditionGroup | undefined,
               flowData: input.data.flowData as FlowData | undefined | null,
               triggerConfig: input.data.triggerConfig as
                  | TriggerConfig
                  | undefined,
            },
         );

         if (updatedRule) {
            const newSnapshot = createSnapshotFromRule(updatedRule);
            const diff = computeDiff(oldSnapshot, newSnapshot);

            if (diff.length > 0) {
               await createVersion(resolvedCtx.db, {
                  changeType: "updated",
                  changedBy: userId,
                  diff,
                  ruleId: input.id,
                  snapshot: newSnapshot as AutomationRuleVersionSnapshot,
               });
            }

            // Handle schedule job updates
            const wasSchedule = isScheduleTrigger(existingRule.triggerType);
            const isNowSchedule = isScheduleTrigger(updatedRule.triggerType);

            try {
               if (wasSchedule && !isNowSchedule) {
                  // Trigger type changed from schedule to non-schedule
                  await removeScheduleJob(input.id);
               } else if (isNowSchedule && updatedRule.enabled) {
                  // Trigger is schedule and enabled - create/update job
                  await upsertScheduleJob(
                     input.id,
                     organizationId,
                     updatedRule.triggerType as ScheduleTriggerType,
                     updatedRule.triggerConfig as ScheduleTriggerConfig,
                  );
               } else if (isNowSchedule && !updatedRule.enabled) {
                  // Trigger is schedule but disabled - remove job
                  await removeScheduleJob(input.id);
               }
            } catch (error) {
               console.error("Failed to manage schedule job:", error);
            }
         }

         return updatedRule;
      }),
});
