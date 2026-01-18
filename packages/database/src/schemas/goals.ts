import { relations, sql } from "drizzle-orm";
import {
   boolean,
   decimal,
   index,
   jsonb,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

// ============================================
// Enums
// ============================================

export const goalTypeEnum = pgEnum("goal_type", [
   "savings",
   "debt_payoff",
   "spending_limit",
   "income_target",
]);

export const goalStatusEnum = pgEnum("goal_status", [
   "active",
   "completed",
   "paused",
   "cancelled",
]);

// ============================================
// Types
// ============================================

export type GoalMetadata = {
   // Linked entities for automatic tracking
   linkedBankAccountIds?: string[];
   linkedCategoryIds?: string[];
   linkedTagIds?: string[];
   // For debt payoff goals
   initialDebtAmount?: number;
   interestRate?: number;
   // Milestones tracking
   milestonesReached?: number[]; // Array of percentages reached (25, 50, 75, 100)
   lastMilestoneNotifiedAt?: string;
   // Additional notes
   notes?: string;
};

// ============================================
// Tables
// ============================================

export const financialGoal = pgTable(
   "financial_goal",
   {
      id: uuid("id").default(sql`gen_random_uuid()`).primaryKey(),
      organizationId: uuid("organization_id")
         .notNull()
         .references(() => organization.id, { onDelete: "cascade" }),
      createdBy: uuid("created_by").references(() => user.id),
      name: text("name").notNull(),
      description: text("description"),
      type: goalTypeEnum("type").notNull(),
      status: goalStatusEnum("status").notNull().default("active"),
      // Target and progress
      targetAmount: decimal("target_amount", {
         precision: 15,
         scale: 2,
      }).notNull(),
      currentAmount: decimal("current_amount", { precision: 15, scale: 2 })
         .notNull()
         .default("0"),
      startingAmount: decimal("starting_amount", { precision: 15, scale: 2 })
         .notNull()
         .default("0"),
      // Timeline
      startDate: timestamp("start_date").defaultNow().notNull(),
      targetDate: timestamp("target_date"),
      completedAt: timestamp("completed_at"),
      // Settings
      isAutoTracked: boolean("is_auto_tracked").notNull().default(false),
      metadata: jsonb("metadata").$type<GoalMetadata>().default({}),
      // Timestamps
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
         .defaultNow()
         .$onUpdate(() => new Date())
         .notNull(),
   },
   (table) => [
      index("idx_goal_org_status").on(table.organizationId, table.status),
      index("idx_goal_type").on(table.type),
      index("idx_goal_target_date").on(table.targetDate),
   ],
);

// ============================================
// Relations
// ============================================

export const financialGoalRelations = relations(financialGoal, ({ one }) => ({
   organization: one(organization, {
      fields: [financialGoal.organizationId],
      references: [organization.id],
   }),
   createdByUser: one(user, {
      fields: [financialGoal.createdBy],
      references: [user.id],
   }),
}));

// ============================================
// Type Inference
// ============================================

export type FinancialGoal = typeof financialGoal.$inferSelect;
export type NewFinancialGoal = typeof financialGoal.$inferInsert;
export type GoalType =
   | "savings"
   | "debt_payoff"
   | "spending_limit"
   | "income_target";
export type GoalStatus = "active" | "completed" | "paused" | "cancelled";
