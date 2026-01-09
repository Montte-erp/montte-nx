import { relations, sql } from "drizzle-orm";
import {
   boolean,
   decimal,
   jsonb,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";

export const budgetPeriodTypeEnum = pgEnum("budget_period_type", [
   "daily",
   "weekly",
   "monthly",
   "quarterly",
   "yearly",
   "custom",
]);

export const budgetTargetTypeEnum = pgEnum("budget_target_type", [
   "category",
   "categories",
   "tag",
   "cost_center",
]);

export const budgetRegimeEnum = pgEnum("budget_regime", ["cash", "accrual"]);

export const budgetModeEnum = pgEnum("budget_mode", ["personal", "business"]);

export type BudgetTarget =
   | { type: "category"; categoryId: string }
   | { type: "categories"; categoryIds: string[] }
   | { type: "tag"; tagId: string }
   | { type: "cost_center"; costCenterId: string };

export type AlertThreshold = {
   percentage: number;
   notified: boolean;
   notifiedAt?: Date;
};

export type BudgetAlertConfig = {
   enabled: boolean;
   thresholds: AlertThreshold[];
   // Predictive alerts
   predictiveAlertSent?: boolean;
   predictiveAlertSentAt?: Date;
};

export type ShadowBudgetConfig = {
   enabled: boolean;
   visibleLimit: number;
   internalLimit: number;
};

export const budget = pgTable("budget", {
   alertConfig: jsonb("alert_config")
      .$type<BudgetAlertConfig>()
      .default({
         enabled: true,
         thresholds: [
            { notified: false, percentage: 50 },
            { notified: false, percentage: 80 },
            { notified: false, percentage: 100 },
         ],
      }),

   amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

   blockOnExceed: boolean("block_on_exceed").default(false).notNull(),
   color: text("color").default("#3B82F6"),
   createdAt: timestamp("created_at").defaultNow().notNull(),
   customPeriodEnd: timestamp("custom_period_end"),
   customPeriodStart: timestamp("custom_period_start"),
   description: text("description"),
   endDate: timestamp("end_date"),
   icon: text("icon").default("Wallet"),
   id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),

   isActive: boolean("is_active").default(true).notNull(),

   mode: budgetModeEnum("mode").default("personal").notNull(),

   name: text("name").notNull(),
   organizationId: uuid("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
   periodStartDay: decimal("period_start_day", {
      precision: 2,
      scale: 0,
   }).default("1"),

   periodType: budgetPeriodTypeEnum("period_type").default("monthly").notNull(),

   regime: budgetRegimeEnum("regime").default("cash").notNull(),

   rollover: boolean("rollover").default(false).notNull(),
   rolloverCap: decimal("rollover_cap", { precision: 12, scale: 2 }),

   shadowBudget: jsonb("shadow_budget").$type<ShadowBudgetConfig>(),

   startDate: timestamp("start_date"),

   target: jsonb("target").$type<BudgetTarget>().notNull(),
   updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
});

export const budgetPeriod = pgTable("budget_period", {
   baseAmount: decimal("base_amount", { precision: 12, scale: 2 }).notNull(),

   budgetId: uuid("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
   closedAt: timestamp("closed_at"),
   createdAt: timestamp("created_at").defaultNow().notNull(),
   id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),

   isClosed: boolean("is_closed").default(false).notNull(),
   periodEnd: timestamp("period_end").notNull(),

   periodStart: timestamp("period_start").notNull(),
   rolloverAmount: decimal("rollover_amount", {
      precision: 12,
      scale: 2,
   }).default("0"),
   scheduledAmount: decimal("scheduled_amount", {
      precision: 12,
      scale: 2,
   }).default("0"),

   spentAmount: decimal("spent_amount", { precision: 12, scale: 2 }).default(
      "0",
   ),
   totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
   updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
});

export const budgetRelations = relations(budget, ({ one, many }) => ({
   organization: one(organization, {
      fields: [budget.organizationId],
      references: [organization.id],
   }),
   periods: many(budgetPeriod),
}));

export const budgetPeriodRelations = relations(budgetPeriod, ({ one }) => ({
   budget: one(budget, {
      fields: [budgetPeriod.budgetId],
      references: [budget.id],
   }),
}));
