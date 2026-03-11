# Planning (Budgets & Financial Goals) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor budget-goals and create financial-goals domain with Zod validators, singleton db, `@f-o-t/money`, and full PGlite test coverage.

**Architecture:** Two independent domains — `budget-goals` (refactored from existing) and `financial-goals` (new, follows inventory movement pattern). Both use singleton `db`, Zod validation via `validateInput`, and `@f-o-t/money` for monetary values.

**Tech Stack:** Drizzle ORM, Zod, `@f-o-t/money`, PGlite (tests), Vitest

---

### Task 1: Refactor budget-goals schema (add Zod validators, make categoryId notNull)

**Files:**

- Modify: `core/database/src/schemas/budget-goals.ts`

**Context:**

- Reference schema pattern: `core/database/src/schemas/bank-accounts.ts` (Zod validators with `createInsertSchema`)
- Reference schema pattern: `core/database/src/schemas/inventory.ts` (numeric validators)
- The existing `budget_goals` table has `categoryId` as nullable with a partial unique index. We're making it `notNull()` and simplifying the unique index.

**Step 1: Rewrite `core/database/src/schemas/budget-goals.ts`**

Replace the entire file with:

```typescript
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
   year: z.number().int().min(2020, "Ano deve ser 2020 ou posterior."),
   limitAmount: numericPositive(
      "Valor planejado deve ser um número válido maior que zero.",
   ),
   alertThreshold: z
      .number()
      .int()
      .min(1, "Percentual de alerta deve ser entre 1 e 100.")
      .max(100, "Percentual de alerta deve ser entre 1 e 100.")
      .nullable()
      .optional(),
});

export const updateBudgetGoalSchema = baseBudgetGoalSchema
   .extend({
      limitAmount: numericPositive(
         "Valor planejado deve ser um número válido maior que zero.",
      ).optional(),
      alertThreshold: z
         .number()
         .int()
         .min(1, "Percentual de alerta deve ser entre 1 e 100.")
         .max(100, "Percentual de alerta deve ser entre 1 e 100.")
         .nullable()
         .optional(),
   })
   .pick({ limitAmount: true, alertThreshold: true })
   .partial();

export type CreateBudgetGoalInput = z.infer<typeof createBudgetGoalSchema>;
export type UpdateBudgetGoalInput = z.infer<typeof updateBudgetGoalSchema>;
```

**Step 2: Verify no TypeScript errors**

Run: `cd /home/yorizel/Documents/montte-nx && npx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 3: Commit**

```bash
git add core/database/src/schemas/budget-goals.ts
git commit -m "refactor(database): add Zod validators to budget-goals schema, make categoryId notNull"
```

---

### Task 2: Create financial-goals schema

**Files:**

- Create: `core/database/src/schemas/financial-goals.ts`
- Modify: `core/database/src/schema.ts` (add export)
- Modify: `core/database/src/schemas/enums.ts` (add goalMovementTypeEnum)
- Modify: `core/database/src/relations.ts` (add relations)

**Context:**

- Reference: `core/database/src/schemas/inventory.ts` for table + movements pattern
- Reference: `core/database/src/schemas/subscriptions.ts` for date/money validators
- The enum goes in `enums.ts` alongside other enums
- `schema.ts` must export the new file for the test DB setup (PGlite `pushSchema`) to pick it up
- `relations.ts` defines relations using `defineRelations` with `r.one` / `r.many`

**Step 1: Add enum to `core/database/src/schemas/enums.ts`**

Add at the end of the file (before any closing):

```typescript
export const goalMovementTypeEnum = pgEnum("goal_movement_type", [
   "deposit",
   "withdrawal",
]);

export type GoalMovementType = (typeof goalMovementTypeEnum.enumValues)[number];
```

**Step 2: Create `core/database/src/schemas/financial-goals.ts`**

```typescript
import { sql } from "drizzle-orm";
import {
   boolean,
   date,
   index,
   integer,
   numeric,
   pgTable,
   text,
   timestamp,
   uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";
import { categories } from "./categories";
import { goalMovementTypeEnum } from "./enums";
import { transactions } from "./transactions";

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

const dateSchema = z
   .string()
   .regex(ISO_DATE_REGEX, "Data deve estar no formato YYYY-MM-DD.");

const numericPositive = (msg: string) =>
   z.string().refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: msg,
   });

const baseGoalSchema = createInsertSchema(financialGoals).pick({
   name: true,
   categoryId: true,
   targetAmount: true,
   startDate: true,
   targetDate: true,
   alertThreshold: true,
});

export const createFinancialGoalSchema = baseGoalSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(120, "Nome deve ter no máximo 120 caracteres."),
      categoryId: z
         .string()
         .uuid("ID da categoria inválido.")
         .nullable()
         .optional(),
      targetAmount: numericPositive(
         "Valor alvo deve ser um número válido maior que zero.",
      ),
      startDate: dateSchema,
      targetDate: dateSchema.nullable().optional(),
      alertThreshold: z
         .number()
         .int()
         .min(1, "Percentual de alerta deve ser entre 1 e 100.")
         .max(100, "Percentual de alerta deve ser entre 1 e 100.")
         .nullable()
         .optional(),
   })
   .superRefine((data, ctx) => {
      if (
         data.targetDate &&
         data.startDate &&
         data.targetDate < data.startDate
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["targetDate"],
            message: "Data alvo deve ser igual ou posterior à data de início.",
         });
      }
   });

export const updateFinancialGoalSchema = baseGoalSchema
   .extend({
      name: z
         .string()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(120, "Nome deve ter no máximo 120 caracteres."),
      categoryId: z
         .string()
         .uuid("ID da categoria inválido.")
         .nullable()
         .optional(),
      targetAmount: numericPositive(
         "Valor alvo deve ser um número válido maior que zero.",
      ),
      startDate: dateSchema,
      targetDate: dateSchema.nullable().optional(),
      alertThreshold: z
         .number()
         .int()
         .min(1, "Percentual de alerta deve ser entre 1 e 100.")
         .max(100, "Percentual de alerta deve ser entre 1 e 100.")
         .nullable()
         .optional(),
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
            path: ["targetDate"],
            message: "Data alvo deve ser igual ou posterior à data de início.",
         });
      }
   });

export const createGoalMovementSchema = z.object({
   type: z.enum(["deposit", "withdrawal"]),
   amount: numericPositive("Valor deve ser um número válido maior que zero."),
   date: dateSchema,
   transactionId: z
      .string()
      .uuid("ID da transação inválido.")
      .nullable()
      .optional(),
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
```

**Step 3: Add export in `core/database/src/schema.ts`**

Add this line after the `export * from "./schemas/event-views";` line:

```typescript
export * from "./schemas/financial-goals";
```

**Step 4: Add relations in `core/database/src/relations.ts`**

Inside the `defineRelations` return object, add after the `budgetGoals` block (which is inside the Categories section):

```typescript
financialGoals: {
   category: r.one.categories({
      from: r.financialGoals.categoryId,
      to: r.categories.id,
   }),
   movements: r.many.financialGoalMovements(),
},

financialGoalMovements: {
   goal: r.one.financialGoals({
      from: r.financialGoalMovements.goalId,
      to: r.financialGoals.id,
   }),
   transaction: r.one.transactions({
      from: r.financialGoalMovements.transactionId,
      to: r.transactions.id,
   }),
},
```

**Step 5: Verify no TypeScript errors**

Run: `cd /home/yorizel/Documents/montte-nx && npx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 6: Commit**

```bash
git add core/database/src/schemas/financial-goals.ts core/database/src/schemas/enums.ts core/database/src/schema.ts core/database/src/relations.ts
git commit -m "feat(database): add financial-goals schema with movements and Zod validators"
```

---

### Task 3: Refactor budget-goals repository (singleton db, Zod, @f-o-t/money)

**Files:**

- Modify: `core/database/src/repositories/budget-goals-repository.ts`

**Context:**

- Reference: `core/database/src/repositories/bank-accounts-repository.ts` for singleton db + validateInput pattern
- Reference: `core/database/src/repositories/inventory-repository.ts` for `@f-o-t/money` usage
- The existing repo uses `db: DatabaseInstance` param — switch to singleton `import { db } from "@core/database/client"`
- The existing repo uses raw `NewBudgetGoal` — switch to Zod validated input types
- `validateInput(schema, data)` is from `@core/utils/errors` — throws `AppError.validation` on failure
- `computeSpentAmount` and `computePercentUsed` stay as internal helpers
- `@f-o-t/money` usage: `of(value, "BRL")` creates a Money, `toDecimal(money)` returns string
- New: `createBudgetGoal` must verify the category exists and is `type: "expense"` by querying the DB
- `listBudgetGoals` must filter by teamId + month + year and compute spent amounts
- `copyPreviousMonth` stays as-is (already works)
- `getGoalsForAlertCheck` stays as-is (already works)

**Step 1: Rewrite `core/database/src/repositories/budget-goals-repository.ts`**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { of, toDecimal } from "@f-o-t/money";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type BudgetGoal,
   type CreateBudgetGoalInput,
   type UpdateBudgetGoalInput,
   budgetGoals,
   createBudgetGoalSchema,
   updateBudgetGoalSchema,
} from "@core/database/schemas/budget-goals";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";

export type BudgetGoalWithProgress = BudgetGoal & {
   categoryName: string | null;
   categoryIcon: string | null;
   categoryColor: string | null;
   spentAmount: string;
   percentUsed: number;
};

export async function createBudgetGoal(
   teamId: string,
   data: CreateBudgetGoalInput,
) {
   const validated = validateInput(createBudgetGoalSchema, data);
   try {
      const category = await db.query.categories.findFirst({
         where: { id: validated.categoryId },
      });
      if (!category) throw AppError.notFound("Categoria não encontrada.");
      if (category.type !== "expense") {
         throw AppError.validation(
            "Orçamento só pode ser vinculado a categorias de despesa.",
         );
      }

      const [goal] = await db
         .insert(budgetGoals)
         .values({ ...validated, teamId })
         .returning();
      if (!goal) throw AppError.database("Failed to create budget goal");
      return goal;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create budget goal");
   }
}

export async function getBudgetGoal(id: string, teamId: string) {
   try {
      const [goal] = await db
         .select()
         .from(budgetGoals)
         .where(and(eq(budgetGoals.id, id), eq(budgetGoals.teamId, teamId)));
      return goal ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get budget goal");
   }
}

export async function updateBudgetGoal(
   id: string,
   teamId: string,
   data: UpdateBudgetGoalInput,
) {
   const validated = validateInput(updateBudgetGoalSchema, data);
   try {
      const [updated] = await db
         .update(budgetGoals)
         .set(validated)
         .where(and(eq(budgetGoals.id, id), eq(budgetGoals.teamId, teamId)))
         .returning();
      if (!updated) throw AppError.notFound("Orçamento não encontrado.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update budget goal");
   }
}

export async function deleteBudgetGoal(id: string, teamId: string) {
   try {
      await db
         .delete(budgetGoals)
         .where(and(eq(budgetGoals.id, id), eq(budgetGoals.teamId, teamId)));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete budget goal");
   }
}

async function computeSpentAmount(
   goal: BudgetGoal,
   month: number,
   year: number,
): Promise<string> {
   const categoryId = goal.categoryId;

   const categoryCondition = inArray(
      transactions.categoryId,
      db
         .select({ id: categories.id })
         .from(categories)
         .where(
            sql`${categories.id} = ${categoryId} OR ${categories.parentId} = ${categoryId}`,
         ),
   );

   const [row] = await db
      .select({
         spent: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      })
      .from(transactions)
      .where(
         and(
            eq(transactions.type, "expense"),
            eq(transactions.teamId, goal.teamId),
            sql`EXTRACT(MONTH FROM ${transactions.date}) = ${month}`,
            sql`EXTRACT(YEAR FROM ${transactions.date}) = ${year}`,
            categoryCondition,
         ),
      );

   return toDecimal(of(Number(row?.spent ?? "0"), "BRL"));
}

function computePercentUsed(spentAmount: string, limitAmount: string): number {
   const limit = Number(limitAmount);
   if (limit === 0) return 0;
   return Math.round((Number(spentAmount) / limit) * 100);
}

export async function listBudgetGoals(
   teamId: string,
   month: number,
   year: number,
): Promise<BudgetGoalWithProgress[]> {
   try {
      const rows = await db
         .select({
            goal: budgetGoals,
            categoryName: categories.name,
            categoryIcon: categories.icon,
            categoryColor: categories.color,
         })
         .from(budgetGoals)
         .leftJoin(categories, eq(budgetGoals.categoryId, categories.id))
         .where(
            and(
               eq(budgetGoals.teamId, teamId),
               eq(budgetGoals.month, month),
               eq(budgetGoals.year, year),
            ),
         );

      const result: BudgetGoalWithProgress[] = [];

      for (const row of rows) {
         const spentAmount = await computeSpentAmount(row.goal, month, year);
         const percentUsed = computePercentUsed(
            spentAmount,
            row.goal.limitAmount,
         );

         result.push({
            ...row.goal,
            categoryName: row.categoryName ?? null,
            categoryIcon: row.categoryIcon ?? null,
            categoryColor: row.categoryColor ?? null,
            spentAmount,
            percentUsed,
         });
      }

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list budget goals");
   }
}

export async function copyPreviousMonth(
   teamId: string,
   fromMonth: number,
   fromYear: number,
   toMonth: number,
   toYear: number,
): Promise<number> {
   try {
      const sourceGoals = await db
         .select()
         .from(budgetGoals)
         .where(
            and(
               eq(budgetGoals.teamId, teamId),
               eq(budgetGoals.month, fromMonth),
               eq(budgetGoals.year, fromYear),
            ),
         );

      if (sourceGoals.length === 0) return 0;

      const newGoals = sourceGoals.map((goal) => ({
         teamId: goal.teamId,
         categoryId: goal.categoryId,
         month: toMonth,
         year: toYear,
         limitAmount: goal.limitAmount,
         alertThreshold: goal.alertThreshold,
         alertSentAt: null,
      }));

      await db.insert(budgetGoals).values(newGoals).onConflictDoNothing();

      return sourceGoals.length;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to copy previous month budget goals");
   }
}

export async function getGoalsForAlertCheck(
   month: number,
   year: number,
): Promise<BudgetGoalWithProgress[]> {
   try {
      const rows = await db
         .select({
            goal: budgetGoals,
            categoryName: categories.name,
            categoryIcon: categories.icon,
            categoryColor: categories.color,
         })
         .from(budgetGoals)
         .leftJoin(categories, eq(budgetGoals.categoryId, categories.id))
         .where(
            and(
               sql`${budgetGoals.alertThreshold} IS NOT NULL`,
               sql`${budgetGoals.alertSentAt} IS NULL`,
               eq(budgetGoals.month, month),
               eq(budgetGoals.year, year),
            ),
         );

      const result: BudgetGoalWithProgress[] = [];

      for (const row of rows) {
         const spentAmount = await computeSpentAmount(row.goal, month, year);
         const percentUsed = computePercentUsed(
            spentAmount,
            row.goal.limitAmount,
         );

         if (percentUsed >= (row.goal.alertThreshold ?? 0)) {
            result.push({
               ...row.goal,
               categoryName: row.categoryName ?? null,
               categoryIcon: row.categoryIcon ?? null,
               categoryColor: row.categoryColor ?? null,
               spentAmount,
               percentUsed,
            });
         }
      }

      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get goals for alert check");
   }
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /home/yorizel/Documents/montte-nx && npx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 3: Commit**

```bash
git add core/database/src/repositories/budget-goals-repository.ts
git commit -m "refactor(database): rewrite budget-goals repository with singleton db, Zod validation, @f-o-t/money"
```

---

### Task 4: Create financial-goals repository

**Files:**

- Create: `core/database/src/repositories/financial-goals-repository.ts`

**Context:**

- Reference: `core/database/src/repositories/inventory-repository.ts` for atomic movement pattern with `db.transaction()`
- The `createGoalMovement` function must be atomic: validate → check balance for withdrawal → insert movement → update `currentAmount` → auto-complete if target reached
- `deleteGoalMovement` must revert the delta atomically and reset `isCompleted` if needed
- `@f-o-t/money` functions: `of(value, "BRL")` creates Money, `add(a, b)` adds, `subtract(a, b)` subtracts, `toDecimal(m)` returns string, `greaterThanOrEqual(a, b)` compares
- The SQL delta pattern for `currentAmount`: `sql\`${financialGoals.currentAmount} + ${delta}\`` where delta is positive for deposit, negative for withdrawal
- `validateInput(schema, data)` throws `AppError.validation` on invalid input

**Step 1: Create `core/database/src/repositories/financial-goals-repository.ts`**

```typescript
import { AppError, propagateError, validateInput } from "@core/utils/errors";
import { add, greaterThanOrEqual, of, subtract, toDecimal } from "@f-o-t/money";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@core/database/client";
import {
   type CreateFinancialGoalInput,
   type CreateGoalMovementInput,
   type UpdateFinancialGoalInput,
   createFinancialGoalSchema,
   createGoalMovementSchema,
   financialGoalMovements,
   financialGoals,
   updateFinancialGoalSchema,
} from "@core/database/schemas/financial-goals";

export async function createFinancialGoal(
   teamId: string,
   data: CreateFinancialGoalInput,
) {
   const validated = validateInput(createFinancialGoalSchema, data);
   try {
      const [goal] = await db
         .insert(financialGoals)
         .values({ ...validated, teamId, currentAmount: "0" })
         .returning();
      if (!goal) throw AppError.database("Failed to create financial goal");
      return goal;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create financial goal");
   }
}

export async function getFinancialGoal(id: string, teamId: string) {
   try {
      const [goal] = await db
         .select()
         .from(financialGoals)
         .where(
            and(eq(financialGoals.id, id), eq(financialGoals.teamId, teamId)),
         );
      return goal ?? null;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to get financial goal");
   }
}

export async function listFinancialGoals(
   teamId: string,
   opts?: { isCompleted?: boolean },
) {
   try {
      const conditions = [eq(financialGoals.teamId, teamId)];
      if (opts?.isCompleted !== undefined) {
         conditions.push(eq(financialGoals.isCompleted, opts.isCompleted));
      }
      return await db
         .select()
         .from(financialGoals)
         .where(and(...conditions))
         .orderBy(financialGoals.name);
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list financial goals");
   }
}

export async function updateFinancialGoal(
   id: string,
   teamId: string,
   data: UpdateFinancialGoalInput,
) {
   const validated = validateInput(updateFinancialGoalSchema, data);
   try {
      const [goal] = await db
         .update(financialGoals)
         .set(validated)
         .where(
            and(eq(financialGoals.id, id), eq(financialGoals.teamId, teamId)),
         )
         .returning();
      if (!goal) throw AppError.notFound("Objetivo não encontrado.");
      return goal;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update financial goal");
   }
}

export async function deleteFinancialGoal(id: string, teamId: string) {
   try {
      await db
         .delete(financialGoals)
         .where(
            and(eq(financialGoals.id, id), eq(financialGoals.teamId, teamId)),
         );
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to delete financial goal");
   }
}

export async function createGoalMovement(
   goalId: string,
   data: CreateGoalMovementInput,
) {
   const validated = validateInput(createGoalMovementSchema, data);
   const amountNum = Number(validated.amount);

   return await db.transaction(async (tx) => {
      const [goal] = await tx
         .select()
         .from(financialGoals)
         .where(eq(financialGoals.id, goalId));

      if (!goal) throw AppError.notFound("Objetivo não encontrado.");

      const currency = "BRL";
      const currentMoney = of(Number(goal.currentAmount), currency);
      const movementMoney = of(amountNum, currency);

      if (validated.type === "withdrawal") {
         if (!greaterThanOrEqual(currentMoney, movementMoney)) {
            throw AppError.conflict(
               `Valor maior que o saldo atual (saldo atual: ${goal.currentAmount})`,
            );
         }
      }

      const [movement] = await tx
         .insert(financialGoalMovements)
         .values({ ...validated, goalId })
         .returning();

      const delta = validated.type === "deposit" ? amountNum : -amountNum;
      const newAmount =
         validated.type === "deposit"
            ? add(currentMoney, movementMoney)
            : subtract(currentMoney, movementMoney);

      const targetMoney = of(Number(goal.targetAmount), currency);
      const shouldComplete = greaterThanOrEqual(newAmount, targetMoney);

      await tx
         .update(financialGoals)
         .set({
            currentAmount: sql`${financialGoals.currentAmount} + ${delta}`,
            ...(shouldComplete ? { isCompleted: true } : {}),
         })
         .where(eq(financialGoals.id, goalId));

      if (!movement) throw AppError.database("Failed to create goal movement");
      return movement;
   });
}

export async function deleteGoalMovement(id: string) {
   return await db.transaction(async (tx) => {
      const [movement] = await tx
         .select()
         .from(financialGoalMovements)
         .where(eq(financialGoalMovements.id, id));

      if (!movement) throw AppError.notFound("Movimento não encontrado.");

      const amountNum = Number(movement.amount);
      const delta = movement.type === "deposit" ? -amountNum : amountNum;

      await tx
         .delete(financialGoalMovements)
         .where(eq(financialGoalMovements.id, id));

      const [updatedGoal] = await tx
         .update(financialGoals)
         .set({
            currentAmount: sql`${financialGoals.currentAmount} + ${delta}`,
         })
         .where(eq(financialGoals.id, movement.goalId))
         .returning();

      if (
         updatedGoal &&
         Number(updatedGoal.currentAmount) < Number(updatedGoal.targetAmount)
      ) {
         await tx
            .update(financialGoals)
            .set({ isCompleted: false })
            .where(eq(financialGoals.id, movement.goalId));
      }

      return movement;
   });
}

export async function listGoalMovements(goalId: string) {
   try {
      return await db
         .select()
         .from(financialGoalMovements)
         .where(eq(financialGoalMovements.goalId, goalId))
         .orderBy(desc(financialGoalMovements.date));
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list goal movements");
   }
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd /home/yorizel/Documents/montte-nx && npx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 3: Commit**

```bash
git add core/database/src/repositories/financial-goals-repository.ts
git commit -m "feat(database): add financial-goals repository with atomic movements"
```

---

### Task 5: Write budget-goals repository tests

**Files:**

- Create: `core/database/__tests__/repositories/budget-goals-repository.test.ts`

**Context:**

- Reference: `core/database/__tests__/repositories/bank-accounts-repository.test.ts` for test setup pattern
- The test uses `vi.mock("@core/database/client")` to redirect the singleton `db` to PGlite
- `setupTestDb()` creates PGlite instance, pushes schema, sets `globalThis.__TEST_DB__`
- To test `computeSpentAmount`, insert real transactions (type `expense`) with matching categoryId and date in the target month
- To test category expense validation, create both `income` and `expense` categories
- The categories table requires `teamId`, `name`, `type` fields
- The transactions table requires `teamId`, `type`, `amount`, `date`, `bankAccountId` (need a bank account) — but bank account can be omitted if not enforced by DB constraint. Check if `bankAccountId` is nullable in transactions schema. If not, create a dummy bank account.
- `copyPreviousMonth` copies goals from one month to another and uses `onConflictDoNothing`

**Step 1: Create `core/database/__tests__/repositories/budget-goals-repository.test.ts`**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import * as repo from "../../src/repositories/budget-goals-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

async function createExpenseCategory(teamId: string, name = "Alimentação") {
   const [cat] = await testDb.db
      .insert(categories)
      .values({ teamId, name, type: "expense" })
      .returning();
   return cat!;
}

async function createIncomeCategory(teamId: string, name = "Salário") {
   const [cat] = await testDb.db
      .insert(categories)
      .values({ teamId, name, type: "income" })
      .returning();
   return cat!;
}

function validCreateInput(
   categoryId: string,
   overrides: Record<string, unknown> = {},
) {
   return {
      categoryId,
      month: 3,
      year: 2026,
      limitAmount: "1000.00",
      ...overrides,
   };
}

describe("budget-goals-repository", () => {
   describe("createBudgetGoal", () => {
      it("creates a budget goal with correct fields", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);

         const goal = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         expect(goal).toMatchObject({
            teamId,
            categoryId: cat.id,
            month: 3,
            year: 2026,
            limitAmount: "1000.00",
         });
         expect(goal.id).toBeDefined();
         expect(goal.createdAt).toBeInstanceOf(Date);
      });

      it("rejects income category", async () => {
         const teamId = randomTeamId();
         const cat = await createIncomeCategory(teamId);

         await expect(
            repo.createBudgetGoal(teamId, validCreateInput(cat.id)),
         ).rejects.toThrow(/despesa/);
      });

      it("rejects non-existent category", async () => {
         const teamId = randomTeamId();

         await expect(
            repo.createBudgetGoal(
               teamId,
               validCreateInput(crypto.randomUUID()),
            ),
         ).rejects.toThrow(/não encontrada/);
      });

      it("rejects invalid month", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);

         await expect(
            repo.createBudgetGoal(
               teamId,
               validCreateInput(cat.id, { month: 13 }),
            ),
         ).rejects.toThrow();
      });

      it("rejects duplicate (same team, category, month, year)", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);

         await repo.createBudgetGoal(teamId, validCreateInput(cat.id));

         await expect(
            repo.createBudgetGoal(teamId, validCreateInput(cat.id)),
         ).rejects.toThrow();
      });
   });

   describe("getBudgetGoal", () => {
      it("gets a budget goal by id and teamId", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const created = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         const found = await repo.getBudgetGoal(created.id, teamId);
         expect(found).toMatchObject({ id: created.id, categoryId: cat.id });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getBudgetGoal(
            crypto.randomUUID(),
            crypto.randomUUID(),
         );
         expect(found).toBeNull();
      });
   });

   describe("updateBudgetGoal", () => {
      it("updates limitAmount", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const created = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         const updated = await repo.updateBudgetGoal(created.id, teamId, {
            limitAmount: "2000.00",
         });

         expect(updated.limitAmount).toBe("2000.00");
      });

      it("updates alertThreshold", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const created = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         const updated = await repo.updateBudgetGoal(created.id, teamId, {
            alertThreshold: 80,
         });

         expect(updated.alertThreshold).toBe(80);
      });
   });

   describe("deleteBudgetGoal", () => {
      it("deletes a budget goal", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         const created = await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id),
         );

         await repo.deleteBudgetGoal(created.id, teamId);
         const found = await repo.getBudgetGoal(created.id, teamId);
         expect(found).toBeNull();
      });
   });

   describe("listBudgetGoals", () => {
      it("lists goals for a specific month with spent amounts", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         await repo.createBudgetGoal(teamId, validCreateInput(cat.id));

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "250.00",
            date: "2026-03-15",
            categoryId: cat.id,
         });

         const goals = await repo.listBudgetGoals(teamId, 3, 2026);

         expect(goals).toHaveLength(1);
         expect(goals[0]!.spentAmount).toBe("250.00");
         expect(goals[0]!.percentUsed).toBe(25);
         expect(goals[0]!.categoryName).toBe("Alimentação");
      });

      it("includes subcategory spending", async () => {
         const teamId = randomTeamId();
         const parent = await createExpenseCategory(teamId, "Transporte");
         const [child] = await testDb.db
            .insert(categories)
            .values({
               teamId,
               name: "Uber",
               type: "expense",
               parentId: parent.id,
            })
            .returning();

         await repo.createBudgetGoal(teamId, validCreateInput(parent.id));

         await testDb.db.insert(transactions).values({
            teamId,
            type: "expense",
            amount: "100.00",
            date: "2026-03-10",
            categoryId: child!.id,
         });

         const goals = await repo.listBudgetGoals(teamId, 3, 2026);
         expect(goals[0]!.spentAmount).toBe("100.00");
      });
   });

   describe("copyPreviousMonth", () => {
      it("copies goals from one month to another", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id, { month: 2 }),
         );

         const count = await repo.copyPreviousMonth(teamId, 2, 2026, 3, 2026);

         expect(count).toBe(1);
         const goals = await repo.listBudgetGoals(teamId, 3, 2026);
         expect(goals).toHaveLength(1);
         expect(goals[0]!.limitAmount).toBe("1000.00");
      });

      it("skips duplicates on copy", async () => {
         const teamId = randomTeamId();
         const cat = await createExpenseCategory(teamId);
         await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id, { month: 2 }),
         );
         await repo.createBudgetGoal(
            teamId,
            validCreateInput(cat.id, { month: 3 }),
         );

         const count = await repo.copyPreviousMonth(teamId, 2, 2026, 3, 2026);
         expect(count).toBe(1);

         const goals = await repo.listBudgetGoals(teamId, 3, 2026);
         expect(goals).toHaveLength(1);
      });
   });
});
```

**Step 2: Run the tests**

Run: `cd /home/yorizel/Documents/montte-nx && npx vitest run core/database/__tests__/repositories/budget-goals-repository.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/budget-goals-repository.test.ts
git commit -m "test(database): add budget-goals repository tests"
```

---

### Task 6: Write financial-goals repository tests

**Files:**

- Create: `core/database/__tests__/repositories/financial-goals-repository.test.ts`

**Context:**

- Same test setup pattern as Task 5
- Movement tests follow the inventory-repository test pattern: create goal → create movements → verify currentAmount updated
- Withdrawal blocking: try to withdraw more than currentAmount → expect `AppError.conflict`
- Auto-complete: deposit enough to reach targetAmount → verify `isCompleted` becomes true
- Delete movement: create deposit → delete it → verify currentAmount reverted
- Delete deposit that caused completion → verify `isCompleted` reverted to false

**Step 1: Create `core/database/__tests__/repositories/financial-goals-repository.test.ts`**

```typescript
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { setupTestDb } from "../helpers/setup-test-db";
import { financialGoals } from "@core/database/schemas/financial-goals";
import { eq } from "drizzle-orm";
import * as repo from "../../src/repositories/financial-goals-repository";

vi.mock("@core/database/client", () => ({
   get db() {
      return (globalThis as any).__TEST_DB__;
   },
}));

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
});

afterAll(async () => {
   await testDb.cleanup();
});

function randomTeamId() {
   return crypto.randomUUID();
}

function validGoalInput(overrides: Record<string, unknown> = {}) {
   return {
      name: "Viagem Europa",
      targetAmount: "10000.00",
      startDate: "2026-01-01",
      ...overrides,
   };
}

describe("financial-goals-repository", () => {
   describe("createFinancialGoal", () => {
      it("creates a goal with currentAmount = 0", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(teamId, validGoalInput());

         expect(goal).toMatchObject({
            teamId,
            name: "Viagem Europa",
            targetAmount: "10000.00",
            currentAmount: "0",
            isCompleted: false,
         });
         expect(goal.id).toBeDefined();
      });

      it("rejects name shorter than 2 chars", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createFinancialGoal(teamId, validGoalInput({ name: "A" })),
         ).rejects.toThrow();
      });

      it("rejects targetDate before startDate", async () => {
         const teamId = randomTeamId();
         await expect(
            repo.createFinancialGoal(
               teamId,
               validGoalInput({
                  startDate: "2026-06-01",
                  targetDate: "2026-01-01",
               }),
            ),
         ).rejects.toThrow();
      });
   });

   describe("getFinancialGoal", () => {
      it("gets a goal by id and teamId", async () => {
         const teamId = randomTeamId();
         const created = await repo.createFinancialGoal(
            teamId,
            validGoalInput(),
         );

         const found = await repo.getFinancialGoal(created.id, teamId);
         expect(found).toMatchObject({ id: created.id, name: "Viagem Europa" });
      });

      it("returns null for non-existent id", async () => {
         const found = await repo.getFinancialGoal(
            crypto.randomUUID(),
            crypto.randomUUID(),
         );
         expect(found).toBeNull();
      });
   });

   describe("listFinancialGoals", () => {
      it("lists all goals for a team", async () => {
         const teamId = randomTeamId();
         await repo.createFinancialGoal(
            teamId,
            validGoalInput({ name: "Meta A" }),
         );
         await repo.createFinancialGoal(
            teamId,
            validGoalInput({ name: "Meta B" }),
         );

         const goals = await repo.listFinancialGoals(teamId);
         expect(goals).toHaveLength(2);
      });

      it("filters by isCompleted", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            teamId,
            validGoalInput({ name: "Concluida", targetAmount: "100.00" }),
         );
         await repo.createFinancialGoal(
            teamId,
            validGoalInput({ name: "Em andamento" }),
         );

         await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "100.00",
            date: "2026-03-01",
         });

         const completed = await repo.listFinancialGoals(teamId, {
            isCompleted: true,
         });
         expect(completed).toHaveLength(1);
         expect(completed[0]!.name).toBe("Concluida");

         const active = await repo.listFinancialGoals(teamId, {
            isCompleted: false,
         });
         expect(active).toHaveLength(1);
         expect(active[0]!.name).toBe("Em andamento");
      });
   });

   describe("updateFinancialGoal", () => {
      it("updates goal name and targetAmount", async () => {
         const teamId = randomTeamId();
         const created = await repo.createFinancialGoal(
            teamId,
            validGoalInput(),
         );

         const updated = await repo.updateFinancialGoal(created.id, teamId, {
            name: "Viagem Japão",
            targetAmount: "15000.00",
         });

         expect(updated.name).toBe("Viagem Japão");
         expect(updated.targetAmount).toBe("15000.00");
      });
   });

   describe("deleteFinancialGoal", () => {
      it("deletes a goal and cascades movements", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(teamId, validGoalInput());

         await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "500.00",
            date: "2026-03-01",
         });

         await repo.deleteFinancialGoal(goal.id, teamId);
         const found = await repo.getFinancialGoal(goal.id, teamId);
         expect(found).toBeNull();

         const movements = await repo.listGoalMovements(goal.id);
         expect(movements).toHaveLength(0);
      });
   });

   describe("createGoalMovement", () => {
      it("deposit increases currentAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(teamId, validGoalInput());

         await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "500.00",
            date: "2026-03-01",
         });

         const updated = await repo.getFinancialGoal(goal.id, teamId);
         expect(updated!.currentAmount).toBe("500.00");
      });

      it("withdrawal decreases currentAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(teamId, validGoalInput());

         await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "1000.00",
            date: "2026-03-01",
         });

         await repo.createGoalMovement(goal.id, {
            type: "withdrawal",
            amount: "300.00",
            date: "2026-03-02",
         });

         const updated = await repo.getFinancialGoal(goal.id, teamId);
         expect(updated!.currentAmount).toBe("700.00");
      });

      it("blocks withdrawal when amount > currentAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(teamId, validGoalInput());

         await expect(
            repo.createGoalMovement(goal.id, {
               type: "withdrawal",
               amount: "100.00",
               date: "2026-03-01",
            }),
         ).rejects.toThrow(/saldo atual/);
      });

      it("auto-completes when currentAmount >= targetAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            teamId,
            validGoalInput({ targetAmount: "500.00" }),
         );

         await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "500.00",
            date: "2026-03-01",
         });

         const updated = await repo.getFinancialGoal(goal.id, teamId);
         expect(updated!.isCompleted).toBe(true);
      });

      it("auto-completes when deposit exceeds targetAmount", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            teamId,
            validGoalInput({ targetAmount: "500.00" }),
         );

         await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "600.00",
            date: "2026-03-01",
         });

         const updated = await repo.getFinancialGoal(goal.id, teamId);
         expect(updated!.isCompleted).toBe(true);
      });
   });

   describe("deleteGoalMovement", () => {
      it("reverts deposit delta", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(teamId, validGoalInput());

         const movement = await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "500.00",
            date: "2026-03-01",
         });

         await repo.deleteGoalMovement(movement.id);

         const updated = await repo.getFinancialGoal(goal.id, teamId);
         expect(updated!.currentAmount).toBe("0");
      });

      it("reverts isCompleted when deleting completing deposit", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(
            teamId,
            validGoalInput({ targetAmount: "500.00" }),
         );

         const movement = await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "500.00",
            date: "2026-03-01",
         });

         let updated = await repo.getFinancialGoal(goal.id, teamId);
         expect(updated!.isCompleted).toBe(true);

         await repo.deleteGoalMovement(movement.id);

         updated = await repo.getFinancialGoal(goal.id, teamId);
         expect(updated!.isCompleted).toBe(false);
         expect(updated!.currentAmount).toBe("0");
      });
   });

   describe("listGoalMovements", () => {
      it("lists movements for a goal in date order", async () => {
         const teamId = randomTeamId();
         const goal = await repo.createFinancialGoal(teamId, validGoalInput());

         await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "100.00",
            date: "2026-03-01",
         });

         await repo.createGoalMovement(goal.id, {
            type: "deposit",
            amount: "200.00",
            date: "2026-03-15",
         });

         const movements = await repo.listGoalMovements(goal.id);
         expect(movements).toHaveLength(2);
         expect(movements[0]!.date).toBe("2026-03-15");
         expect(movements[1]!.date).toBe("2026-03-01");
      });
   });
});
```

**Step 2: Run the tests**

Run: `cd /home/yorizel/Documents/montte-nx && npx vitest run core/database/__tests__/repositories/financial-goals-repository.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add core/database/__tests__/repositories/financial-goals-repository.test.ts
git commit -m "test(database): add financial-goals repository tests"
```

---

### Task 7: Update consumers of budget-goals repository

**Files:**

- Search for all imports of `budget-goals-repository` in `apps/web/src/`

**Context:**

- The repository API changed: functions no longer take `db` as first param
- `createBudgetGoal(db, data)` → `createBudgetGoal(teamId, data)`
- `getBudgetGoal(db, { id, teamId })` → `getBudgetGoal(id, teamId)`
- `updateBudgetGoal(db, { id, teamId }, data)` → `updateBudgetGoal(id, teamId, data)`
- `deleteBudgetGoal(db, { id, teamId })` → `deleteBudgetGoal(id, teamId)`
- `listBudgetGoals(db, { teamId, month, year })` → `listBudgetGoals(teamId, month, year)`
- `copyPreviousMonth(db, { teamId, fromMonth, fromYear, toMonth, toYear })` → `copyPreviousMonth(teamId, fromMonth, fromYear, toMonth, toYear)`
- `getGoalsForAlertCheck(db, { month, year })` → `getGoalsForAlertCheck(month, year)`
- `spentAmount` changed from `number` to `string` (now uses `@f-o-t/money`)

**Step 1: Find all consumer files**

Run: `cd /home/yorizel/Documents/montte-nx && grep -r "budget-goals-repository" apps/ packages/ --include="*.ts" --include="*.tsx" -l`

**Step 2: Update each file to use the new API signatures**

Update imports (remove `db` param), update function calls to match new signatures.

**Step 3: Verify no TypeScript errors**

Run: `cd /home/yorizel/Documents/montte-nx && npx tsc --noEmit -p core/database/tsconfig.json 2>&1 | head -30`

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: update budget-goals repository consumers to new API"
```

---

### Task 8: Run all tests and verify

**Files:** None (verification only)

**Step 1: Run all database tests**

Run: `cd /home/yorizel/Documents/montte-nx && npx vitest run core/database/__tests__/`
Expected: All tests pass.

**Step 2: Run full test suite**

Run: `cd /home/yorizel/Documents/montte-nx && bun run test`
Expected: All tests pass.

**Step 3: Final commit (if any fixes needed)**

Only commit if fixes were needed. Otherwise, implementation is complete.
