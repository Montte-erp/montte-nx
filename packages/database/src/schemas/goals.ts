import { relations, sql } from "drizzle-orm";
import {
   decimal,
   index,
   jsonb,
   pgEnum,
   pgTable,
   text,
   timestamp,
   unique,
   uuid,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { tag } from "./tags";

// ============================================
// Enums
// ============================================

export const progressCalculationTypeEnum = pgEnum("progress_calculation_type", [
   "income",
   "expense",
   "net",
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
   // For tracking linked entities (bank accounts, categories) - optional filters
   linkedBankAccountIds?: string[];
   linkedCategoryIds?: string[];
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
      tagId: uuid("tag_id")
         .notNull()
         .references(() => tag.id, { onDelete: "restrict" }),
      createdBy: uuid("created_by").references(() => user.id),
      name: text("name").notNull(),
      description: text("description"),
      progressCalculationType: progressCalculationTypeEnum(
         "progress_calculation_type",
      )
         .notNull()
         .default("income"),
      status: goalStatusEnum("status").notNull().default("active"),
      // Target and progress
      targetAmount: decimal("target_amount", {
         precision: 15,
         scale: 2,
      }).notNull(),
      startingAmount: decimal("starting_amount", { precision: 15, scale: 2 })
         .notNull()
         .default("0"),
      // Timeline
      startDate: timestamp("start_date").defaultNow().notNull(),
      targetDate: timestamp("target_date"),
      completedAt: timestamp("completed_at"),
      // Settings
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
      index("idx_goal_tag").on(table.tagId),
      index("idx_goal_target_date").on(table.targetDate),
      unique("uq_goal_tag").on(table.tagId),
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
   tag: one(tag, {
      fields: [financialGoal.tagId],
      references: [tag.id],
   }),
}));

// ============================================
// Type Inference
// ============================================

export type FinancialGoal = typeof financialGoal.$inferSelect;
export type NewFinancialGoal = typeof financialGoal.$inferInsert;
export type ProgressCalculationType = "income" | "expense" | "net";
export type GoalStatus = "active" | "completed" | "paused" | "cancelled";
