import type {
   ArrayOperator,
   BooleanOperator,
   ConditionGroup,
   DateOperator,
   NumberOperator,
   StringOperator,
} from "@f-o-t/rules-engine";
import { relations, sql } from "drizzle-orm";
import {
   boolean,
   index,
   integer,
   jsonb,
   pgTable,
   text,
   timestamp,
   unique,
   uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

export type ConditionOperator =
   | StringOperator
   | NumberOperator
   | BooleanOperator
   | DateOperator
   | ArrayOperator;

export type ConditionType =
   | "string"
   | "number"
   | "boolean"
   | "date"
   | "array"
   | "custom";

export type TriggerType =
   | "transaction.created"
   | "transaction.updated"
   | "schedule.daily"
   | "schedule.weekly"
   | "schedule.biweekly"
   | "schedule.custom"
   | "budget.threshold_reached"
   | "budget.period_end"
   | "budget.overspent"
   | "anomaly.spending_spike"
   | "anomaly.unusual_category"
   | "anomaly.large_transaction"
   | "goal.milestone_reached"
   | "goal.at_risk"
   | "goal.completed";

export type ScheduleTriggerType =
   | "schedule.daily"
   | "schedule.weekly"
   | "schedule.biweekly"
   | "schedule.custom";

/**
 * Configuration for schedule-based triggers
 */
export type ScheduleTriggerConfig = {
   /** Time in HH:mm format (24h), e.g., "09:00" */
   time: string;
   /** IANA timezone, e.g., "America/Sao_Paulo" */
   timezone: string;
   /** Day of week (0-6, where 0 = Sunday) - used for schedule.weekly */
   dayOfWeek?: number;
   /** Custom cron pattern - used for schedule.custom */
   cronPattern?: string;
};

export type TriggerConfig = ScheduleTriggerConfig | Record<string, never>;

export type ActionType =
   | "set_category"
   | "add_tag"
   | "remove_tag"
   | "set_cost_center"
   | "update_description"
   | "create_transaction"
   | "mark_as_transfer"
   | "send_push_notification"
   | "send_email"
   | "fetch_bills_report"
   | "format_data"
   | "stop_execution"
   | "generate_custom_report"
   | "fetch_budget_report"
   | "check_budget_status";

export type CategorySplitMode = "equal" | "percentage" | "fixed" | "dynamic";

export type CategorySplitConfig = {
   categoryId: string;
   value: number;
};

export type BillsDigestRecipient = "owner" | "all_members" | "specific";
export type BillsDigestDetailLevel = "summary" | "detailed" | "full";
export type FormatDataOutputFormat = "csv" | "pdf" | "html_table" | "json";
export type CsvDelimiter = "," | ";" | "\t";

export type ActionConfig = {
   categoryId?: string;
   categoryIds?: string[];
   categorySplitMode?: CategorySplitMode;
   categorySplits?: CategorySplitConfig[];
   dynamicSplitPattern?: string;
   mode?: "replace" | "append" | "prepend";
   tagIds?: string[];
   costCenterId?: string;
   value?: string;
   template?: boolean;
   type?: "income" | "expense";
   amountField?: string;
   amountFixed?: number;
   description?: string;
   bankAccountId?: string;
   toBankAccountId?: string;
   dateField?: string;
   title?: string;
   body?: string;
   url?: string;
   to?: "owner" | "custom";
   customEmail?: string;
   subject?: string;
   reason?: string;
   // fetch_bills_report config
   recipients?: BillsDigestRecipient;
   memberIds?: string[];
   detailLevel?: BillsDigestDetailLevel;
   includePending?: boolean;
   includeOverdue?: boolean;
   daysAhead?: number;
   billTypes?: ("expense" | "income")[];
   // send_email template mode
   useTemplate?: "bills_digest" | "custom" | "visual";
   // send_email visual template
   emailTemplate?: {
      blocks: unknown[];
      styles?: {
         primaryColor?: string;
         backgroundColor?: string;
         textColor?: string;
         fontFamily?: "sans-serif" | "serif" | "monospace";
      };
   };
   // send_email attachment support
   includeAttachment?: boolean;
   // format_data config
   outputFormat?: FormatDataOutputFormat;
   fileName?: string;
   csvIncludeHeaders?: boolean;
   csvDelimiter?: CsvDelimiter;
   pdfTemplate?: "bills_report" | "custom";
   pdfPageSize?: "A4" | "Letter";
   htmlTableStyle?: "default" | "striped" | "bordered";
   // generate_custom_report config
   reportType?:
      | "dre_gerencial"
      | "dre_fiscal"
      | "budget_vs_actual"
      | "spending_trends"
      | "cash_flow_forecast"
      | "counterparty_analysis";
   periodType?: "previous_month" | "previous_week" | "current_month" | "custom";
   daysBack?: number;
   forecastDays?: number;
   filterConfig?: {
      bankAccountIds?: string[];
      categoryIds?: string[];
      costCenterIds?: string[];
      tagIds?: string[];
      includeTransfers?: boolean;
   };
   saveReport?: boolean;
   reportName?: string;
   // fetch_budget_report config
   includeOverBudget?: boolean;
   includeNearLimit?: boolean;
   budgetIds?: string[];
   includeInactive?: boolean;
   // check_budget_status config
   alertThresholds?: number[];
   checkCurrentStatus?: boolean;
};

/**
 * Consequence type aligned with @f-o-t/rules-engine
 * Replaces the old Action type
 */
export type Consequence = {
   type: ActionType;
   payload: ActionConfig;
};

export type FlowData = {
   nodes: unknown[];
   edges: unknown[];
   viewport?: {
      x: number;
      y: number;
      zoom: number;
   };
};

export const automationRule = pgTable(
   "automation_rule",
   {
      category: text("category"),
      // Changed from ConditionGroup[] to single ConditionGroup (aligned with rules-engine)
      conditions: jsonb("conditions").$type<ConditionGroup>().notNull(),
      // Renamed from actions to consequences (aligned with rules-engine)
      consequences: jsonb("consequences")
         .$type<Consequence[]>()
         .notNull()
         .default([]),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      createdBy: uuid("created_by").references(() => user.id),
      description: text("description"),
      // Renamed from isActive to enabled (aligned with rules-engine)
      enabled: boolean("enabled").notNull().default(true),
      flowData: jsonb("flow_data").$type<FlowData>(),
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      metadata: jsonb("metadata")
         .$type<Record<string, unknown>>()
         .notNull()
         .default({}),
      name: text("name").notNull(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      priority: integer("priority").notNull().default(0),
      // Renamed from stopOnFirstMatch to stopOnMatch (aligned with rules-engine)
      stopOnMatch: boolean("stop_on_match").default(false),
      tags: text("tags").array().notNull().default([]),
      triggerConfig: jsonb("trigger_config").$type<TriggerConfig>().default({}),
      triggerType: text("trigger_type").$type<TriggerType>().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      unique("automation_rule_name_org_unique").on(
         table.organizationId,
         table.name,
      ),
      index("idx_automation_rule_org_enabled").on(
         table.organizationId,
         table.enabled,
      ),
      index("idx_automation_rule_trigger").on(table.triggerType, table.enabled),
      index("idx_automation_rule_category").on(table.category),
   ],
);

export type AutomationLogStatus = "success" | "partial" | "failed" | "skipped";
export type TriggeredBy = "event" | "manual";
export type RelatedEntityType = "transaction";
export type RuleChangeType = "created" | "updated" | "restored" | "deleted";

export type ConditionEvaluationLogResult = {
   conditionId: string;
   passed: boolean;
   actualValue?: unknown;
   expectedValue?: unknown;
};

export type ConsequenceExecutionLogResult = {
   consequenceIndex: number;
   type: ActionType;
   success: boolean;
   result?: unknown;
   error?: string;
};

export const automationLog = pgTable(
   "automation_log",
   {
      consequencesExecuted: jsonb("consequences_executed").$type<
         ConsequenceExecutionLogResult[]
      >(),
      completedAt: timestamp("completed_at"),
      conditionsEvaluated: jsonb("conditions_evaluated").$type<
         ConditionEvaluationLogResult[]
      >(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      dryRun: boolean("dry_run").default(false),
      durationMs: integer("duration_ms"),
      errorMessage: text("error_message"),
      errorStack: text("error_stack"),
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      relatedEntityId: uuid("related_entity_id"),
      relatedEntityType: text("related_entity_type").$type<RelatedEntityType>(),
      ruleId: uuid("rule_id").references(() => automationRule.id, {
         onDelete: "set null",
      }),
      ruleName: text("rule_name").notNull(),
      ruleSnapshot: jsonb("rule_snapshot"),
      startedAt: timestamp("started_at").notNull(),
      status: text("status").$type<AutomationLogStatus>().notNull(),
      triggerEvent: jsonb("trigger_event").notNull(),
      triggeredBy: text("triggered_by").$type<TriggeredBy>(),
      triggerType: text("trigger_type").$type<TriggerType>().notNull(),
   },
   (table) => [
      index("idx_automation_log_rule").on(table.ruleId),
      index("idx_automation_log_org_created").on(
         table.organizationId,
         table.createdAt,
      ),
      index("idx_automation_log_status").on(table.status),
      index("idx_automation_log_entity").on(
         table.relatedEntityType,
         table.relatedEntityId,
      ),
   ],
);

export const automationRuleRelations = relations(
   automationRule,
   ({ one, many }) => ({
      createdByUser: one(user, {
         fields: [automationRule.createdBy],
         references: [user.id],
      }),
      logs: many(automationLog),
      organization: one(organization, {
         fields: [automationRule.organizationId],
         references: [organization.id],
      }),
      versions: many(automationRuleVersion),
   }),
);

export const automationLogRelations = relations(automationLog, ({ one }) => ({
   organization: one(organization, {
      fields: [automationLog.organizationId],
      references: [organization.id],
   }),
   rule: one(automationRule, {
      fields: [automationLog.ruleId],
      references: [automationRule.id],
   }),
}));

export type AutomationRuleVersionSnapshot = {
   id: string;
   name: string;
   description?: string | null;
   triggerType: TriggerType;
   triggerConfig: TriggerConfig;
   conditions: ConditionGroup;
   consequences: Consequence[];
   flowData?: FlowData | null;
   enabled: boolean;
   priority: number;
   stopOnMatch?: boolean | null;
   tags: string[];
   category?: string | null;
   metadata: Record<string, unknown>;
};

export type AutomationRuleVersionDiff = {
   field: string;
   oldValue: unknown;
   newValue: unknown;
}[];

export const automationRuleVersion = pgTable(
   "automation_rule_version",
   {
      changeDescription: text("change_description"),
      changedAt: timestamp("changed_at").defaultNow().notNull(),
      changedBy: uuid("changed_by").references(() => user.id),
      changeType: text("change_type").$type<RuleChangeType>().notNull(),
      diff: jsonb("diff").$type<AutomationRuleVersionDiff>(),
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      ruleId: uuid("rule_id")
         .notNull()
         .references(() => automationRule.id, { onDelete: "cascade" }),
      snapshot: jsonb("snapshot")
         .$type<AutomationRuleVersionSnapshot>()
         .notNull(),
      version: integer("version").notNull(),
   },
   (table) => [
      index("idx_automation_rule_version_rule").on(table.ruleId),
      unique("automation_rule_version_rule_version_unique").on(
         table.ruleId,
         table.version,
      ),
   ],
);

export const automationRuleVersionRelations = relations(
   automationRuleVersion,
   ({ one }) => ({
      changedByUser: one(user, {
         fields: [automationRuleVersion.changedBy],
         references: [user.id],
      }),
      rule: one(automationRule, {
         fields: [automationRuleVersion.ruleId],
         references: [automationRule.id],
      }),
   }),
);
