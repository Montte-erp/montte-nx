import { sql } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { categories } from "./categories";

export const budgetGoals = pgTable(
  "budget_goals",
  {
    id: uuid("id")
      .default(sql`pg_catalog.gen_random_uuid()`)
      .primaryKey(),
    teamId: uuid("team_id").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    limitAmount: numeric("limit_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    alertThreshold: integer("alert_threshold"),
    alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("budget_goals_team_id_idx").on(table.teamId),
    uniqueIndex("budget_goals_team_category_month_unique").on(
      table.teamId,
      table.categoryId,
      table.month,
      table.year,
    ),
  ],
);

export type BudgetGoal = typeof budgetGoals.$inferSelect;
export type NewBudgetGoal = typeof budgetGoals.$inferInsert;

const numericPositive = (msg: string) =>
  z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
    message: msg,
  });

const baseBudgetGoalSchema = createInsertSchema(budgetGoals).pick({
  categoryId: true,
  month: true,
  year: true,
  limitAmount: true,
  alertThreshold: true,
});

export const createBudgetGoalSchema = baseBudgetGoalSchema.extend({
  categoryId: z.string().uuid("ID da categoria inválido."),
  month: z
    .number()
    .int()
    .min(1, "Mês deve ser entre 1 e 12.")
    .max(12, "Mês deve ser entre 1 e 12."),
  year: z.number().int().min(2020, "Ano deve ser maior ou igual a 2020."),
  limitAmount: numericPositive("Valor limite deve ser um número válido maior que zero."),
  alertThreshold: z
    .number()
    .int()
    .min(1, "Alerta deve ser entre 1 e 100.")
    .max(100, "Alerta deve ser entre 1 e 100.")
    .nullable()
    .optional(),
});

export const updateBudgetGoalSchema = baseBudgetGoalSchema
  .pick({ limitAmount: true, alertThreshold: true })
  .extend({
    limitAmount: numericPositive(
      "Valor limite deve ser um número válido maior que zero.",
    ).optional(),
    alertThreshold: z
      .number()
      .int()
      .min(1, "Alerta deve ser entre 1 e 100.")
      .max(100, "Alerta deve ser entre 1 e 100.")
      .nullable()
      .optional(),
  })
  .partial();

export type CreateBudgetGoalInput = z.infer<typeof createBudgetGoalSchema>;
export type UpdateBudgetGoalInput = z.infer<typeof updateBudgetGoalSchema>;
