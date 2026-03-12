import { sql } from "drizzle-orm";
import {
   boolean,
   date,
   index,
   integer,
   numeric,
   pgEnum,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";

export const goalMovementTypeEnum = pgEnum("goal_movement_type", [
   "deposit",
   "withdrawal",
]);
export type GoalMovementType = (typeof goalMovementTypeEnum.enumValues)[number];

export const financialGoals = pgTable(
   "financial_goals",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      teamId: uuid("team_id").notNull(),
      categoryId: uuid("category_id").references(() => categories.id, {
         onDelete: "set null",
      }),
      name: text("name").notNull(),
      targetAmount: numeric("target_amount", {
         precision: 12,
         scale: 2,
      }).notNull(),
      currentAmount: numeric("current_amount", {
         precision: 12,
         scale: 2,
      })
         .notNull()
         .default("0"),
      startDate: date("start_date").notNull(),
      targetDate: date("target_date"),
      alertThreshold: integer("alert_threshold"),
      alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),
      isCompleted: boolean("is_completed").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("financial_goals_team_id_idx").on(table.teamId),
      index("financial_goals_is_completed_idx").on(table.isCompleted),
   ],
);

export const financialGoalMovements = pgTable(
   "financial_goal_movements",
   {
      id: uuid("id")
         .default(sql`pg_catalog.gen_random_uuid()`)
         .primaryKey(),
      goalId: uuid("goal_id")
         .notNull()
         .references(() => financialGoals.id, { onDelete: "cascade" }),
      type: goalMovementTypeEnum("type").notNull(),
      amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
      date: date("date").notNull(),
      transactionId: uuid("transaction_id").references(() => transactions.id, {
         onDelete: "set null",
      }),
      notes: text("notes"),
      createdAt: timestamp("created_at", { withTimezone: true })
         .notNull()
         .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
         .notNull()
         .defaultNow()
         .$onUpdate(() => new Date()),
   },
   (table) => [
      index("financial_goal_movements_goal_id_idx").on(table.goalId),
      index("financial_goal_movements_transaction_id_idx").on(
         table.transactionId,
      ),
   ],
);

export type FinancialGoal = typeof financialGoals.$inferSelect;
export type NewFinancialGoal = typeof financialGoals.$inferInsert;
export type FinancialGoalMovement = typeof financialGoalMovements.$inferSelect;
export type NewFinancialGoalMovement =
   typeof financialGoalMovements.$inferInsert;

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dateStringSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const numericPositive = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Valor deve ser um número válido maior que zero.",
   });

const baseGoalSchema = createInsertSchema(financialGoals).pick({
   name: true,
   targetAmount: true,
   startDate: true,
   targetDate: true,
   categoryId: true,
   alertThreshold: true,
});

export const createFinancialGoalSchema = baseGoalSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(120, "Nome deve ter no máximo 120 caracteres."),
      targetAmount: numericPositive,
      startDate: dateStringSchema,
      targetDate: dateStringSchema.nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      alertThreshold: z.number().int().min(1).max(100).nullable().optional(),
   })
   .superRefine((data, ctx) => {
      if (
         data.targetDate &&
         data.startDate &&
         data.targetDate < data.startDate
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data alvo deve ser igual ou posterior à data de início.",
            path: ["targetDate"],
         });
      }
   });

export const updateFinancialGoalSchema = baseGoalSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(120, "Nome deve ter no máximo 120 caracteres.")
         .optional(),
      targetAmount: numericPositive.optional(),
      startDate: dateStringSchema.optional(),
      targetDate: dateStringSchema.nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      alertThreshold: z.number().int().min(1).max(100).nullable().optional(),
   })
   .partial()
   .superRefine((data, ctx) => {
      if (
         data.targetDate &&
         data.startDate &&
         data.targetDate < data.startDate
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Data alvo deve ser igual ou posterior à data de início.",
            path: ["targetDate"],
         });
      }
   });

export const createGoalMovementSchema = z.object({
   type: z.enum(["deposit", "withdrawal"]),
   amount: numericPositive,
   date: dateStringSchema,
   transactionId: z.string().uuid().nullable().optional(),
   notes: z
      .string()
      .max(255, "Observações devem ter no máximo 255 caracteres.")
      .nullable()
      .optional(),
});

export type CreateFinancialGoalInput = z.infer<
   typeof createFinancialGoalSchema
>;
export type UpdateFinancialGoalInput = z.infer<
   typeof updateFinancialGoalSchema
>;
export type CreateGoalMovementInput = z.infer<typeof createGoalMovementSchema>;
