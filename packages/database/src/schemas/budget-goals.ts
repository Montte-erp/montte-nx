import { relations, sql } from "drizzle-orm";
import {
   index,
   integer,
   numeric,
   pgTable,
   timestamp,
   uniqueIndex,
   uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories";
import { subcategories } from "./subcategories";

export const budgetGoals = pgTable(
   "budget_goals",
   {
      id: uuid("id").default(sql`pg_catalog.gen_random_uuid()`).primaryKey(),
      teamId: uuid("team_id").notNull(),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "cascade",
      }),
      subcategoryId: uuid("subcategory_id").references(() => subcategories.id, {
         onDelete: "cascade",
      }),
      month: integer("month").notNull(), // 1–12
      year: integer("year").notNull(),
      limitAmount: numeric("limit_amount", {
         precision: 12,
         scale: 2,
      }).notNull(),
      alertThreshold: integer("alert_threshold"), // 0–100, nullable = no alert
      alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("budget_goals_team_id_idx").on(table.teamId),
      uniqueIndex("budget_goals_team_category_month_unique")
         .on(table.teamId, table.categoryId, table.month, table.year)
         .where(sql`${table.categoryId} IS NOT NULL`),
      uniqueIndex("budget_goals_team_subcategory_month_unique")
         .on(table.teamId, table.subcategoryId, table.month, table.year)
         .where(sql`${table.subcategoryId} IS NOT NULL`),
   ],
);

export const budgetGoalsRelations = relations(budgetGoals, ({ one }) => ({
   category: one(categories, {
      fields: [budgetGoals.categoryId],
      references: [categories.id],
   }),
   subcategory: one(subcategories, {
      fields: [budgetGoals.subcategoryId],
      references: [subcategories.id],
   }),
}));

export type BudgetGoal = typeof budgetGoals.$inferSelect;
export type NewBudgetGoal = typeof budgetGoals.$inferInsert;
