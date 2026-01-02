import type { ConditionGroup } from "@f-o-t/rules-engine";
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
import type {
   Consequence,
   FlowData,
   TriggerConfig,
   TriggerType,
} from "./automations";
import { automationRule } from "./automations";

// ============================================
// Template Types
// ============================================

export type TemplateCategory =
   | "bill_management"
   | "transaction_processing"
   | "notifications"
   | "reporting"
   | "custom";

// ============================================
// Automation Template Table
// ============================================

export const automationTemplate = pgTable(
   "automation_template",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),

      // Identity
      name: text("name").notNull(),
      description: text("description").notNull(),
      category: text("category")
         .$type<TemplateCategory>()
         .notNull()
         .default("custom"),

      // The workflow blueprint (same structure as automationRule)
      flowData: jsonb("flow_data").$type<FlowData>().notNull(),
      triggerType: text("trigger_type").$type<TriggerType>().notNull(),
      triggerConfig: jsonb("trigger_config").$type<TriggerConfig>().default({}),
      conditions: jsonb("conditions").$type<ConditionGroup>().notNull(),
      consequences: jsonb("consequences")
         .$type<Consequence[]>()
         .notNull()
         .default([]),

      // Ownership (null organizationId = system template)
      organizationId: uuid("organization_id").references(
         () => organization.id,
         {
            onDelete: "cascade",
         },
      ),
      createdBy: uuid("created_by").references(() => user.id, {
         onDelete: "set null",
      }),

      // Metadata
      icon: text("icon"), // Lucide icon name, e.g., "ClipboardList", "Mail"
      tags: text("tags").array().notNull().default([]),
      isSystemTemplate: boolean("is_system_template").notNull().default(false),

      // Usage tracking
      usageCount: integer("usage_count").notNull().default(0),
      lastUsedAt: timestamp("last_used_at"),

      // Timestamps
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      // Organization templates + system templates
      index("idx_automation_template_org").on(table.organizationId),
      index("idx_automation_template_system").on(table.isSystemTemplate),
      index("idx_automation_template_category").on(table.category),
      // Unique name per organization (system templates don't have org)
      unique("automation_template_name_org_unique").on(
         table.organizationId,
         table.name,
      ),
   ],
);

// ============================================
// Template Usage Tracking
// ============================================

export const automationTemplateUsage = pgTable(
   "automation_template_usage",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      templateId: uuid("template_id")
         .notNull()
         .references(() => automationTemplate.id, { onDelete: "cascade" }),
      automationRuleId: uuid("automation_rule_id")
         .notNull()
         .references(() => automationRule.id, { onDelete: "cascade" }),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      createdBy: uuid("created_by").references(() => user.id, {
         onDelete: "set null",
      }),
      createdAt: timestamp("created_at").defaultNow().notNull(),
   },
   (table) => [
      index("idx_template_usage_template").on(table.templateId),
      index("idx_template_usage_rule").on(table.automationRuleId),
      index("idx_template_usage_org").on(table.organizationId),
   ],
);

// ============================================
// Relations
// ============================================

export const automationTemplateRelations = relations(
   automationTemplate,
   ({ one, many }) => ({
      organization: one(organization, {
         fields: [automationTemplate.organizationId],
         references: [organization.id],
      }),
      createdByUser: one(user, {
         fields: [automationTemplate.createdBy],
         references: [user.id],
      }),
      usages: many(automationTemplateUsage),
   }),
);

export const automationTemplateUsageRelations = relations(
   automationTemplateUsage,
   ({ one }) => ({
      template: one(automationTemplate, {
         fields: [automationTemplateUsage.templateId],
         references: [automationTemplate.id],
      }),
      automationRule: one(automationRule, {
         fields: [automationTemplateUsage.automationRuleId],
         references: [automationRule.id],
      }),
      organization: one(organization, {
         fields: [automationTemplateUsage.organizationId],
         references: [organization.id],
      }),
      createdByUser: one(user, {
         fields: [automationTemplateUsage.createdBy],
         references: [user.id],
      }),
   }),
);

// ============================================
// Inferred Types
// ============================================

export type AutomationTemplate = typeof automationTemplate.$inferSelect;
export type NewAutomationTemplate = typeof automationTemplate.$inferInsert;
export type AutomationTemplateUsage =
   typeof automationTemplateUsage.$inferSelect;
export type NewAutomationTemplateUsage =
   typeof automationTemplateUsage.$inferInsert;
