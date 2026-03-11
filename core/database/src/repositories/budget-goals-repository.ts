import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { of, toDecimal } from "@f-o-t/money";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
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
      if (!updated)
         throw AppError.notFound("Meta de orçamento não encontrada.");
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

export async function markAlertSent(id: string, teamId: string) {
   try {
      const [updated] = await db
         .update(budgetGoals)
         .set({ alertSentAt: new Date() })
         .where(and(eq(budgetGoals.id, id), eq(budgetGoals.teamId, teamId)))
         .returning();
      if (!updated)
         throw AppError.notFound("Meta de orçamento não encontrada.");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to mark alert as sent");
   }
}

async function computeSpentAmount(
   goal: BudgetGoal,
   month: number,
   year: number,
): Promise<string> {
   if (goal.categoryId == null) return toDecimal(of(0, "BRL"));

   const categoryId = goal.categoryId;
   const spentResult = await db
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
            sql`${transactions.categoryId} IN (
					SELECT id FROM categories WHERE id = ${categoryId} OR parent_id = ${categoryId}
				)`,
         ),
      );

   return toDecimal(of(spentResult[0]?.spent ?? "0", "BRL"));
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
               isNotNull(budgetGoals.alertThreshold),
               isNull(budgetGoals.alertSentAt),
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
