import { AppError, propagateError } from "@packages/utils/errors";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   type BudgetGoal,
   budgetGoals,
   categories,
   type NewBudgetGoal,
   subcategories,
   transactions,
} from "../schema";

export type BudgetGoalWithProgress = BudgetGoal & {
   categoryName: string | null;
   categoryIcon: string | null;
   categoryColor: string | null;
   subcategoryName: string | null;
   spentAmount: number;
   percentUsed: number;
};

export async function createBudgetGoal(
   db: DatabaseInstance,
   data: NewBudgetGoal,
): Promise<BudgetGoal> {
   try {
      const [goal] = await db.insert(budgetGoals).values(data).returning();
      if (!goal) throw AppError.database("Failed to create budget goal");
      return goal;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to create budget goal");
   }
}

export async function getBudgetGoal(
   db: DatabaseInstance,
   { id, teamId }: { id: string; teamId: string },
): Promise<BudgetGoal | null> {
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
   db: DatabaseInstance,
   { id, teamId }: { id: string; teamId: string },
   data: Partial<NewBudgetGoal>,
): Promise<BudgetGoal> {
   try {
      const [updated] = await db
         .update(budgetGoals)
         .set(data)
         .where(and(eq(budgetGoals.id, id), eq(budgetGoals.teamId, teamId)))
         .returning();
      if (!updated) throw AppError.database("Failed to update budget goal");
      return updated;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update budget goal");
   }
}

export async function deleteBudgetGoal(
   db: DatabaseInstance,
   { id, teamId }: { id: string; teamId: string },
): Promise<void> {
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
   db: DatabaseInstance,
   goal: BudgetGoal,
   month: number,
   year: number,
): Promise<number> {
   const baseConditions = [
      eq(transactions.type, "expense"),
      eq(transactions.teamId, goal.teamId),
      sql`EXTRACT(MONTH FROM ${transactions.date}) = ${month}`,
      sql`EXTRACT(YEAR FROM ${transactions.date}) = ${year}`,
   ];

   let categoryCondition: ReturnType<typeof or> | ReturnType<typeof eq>;

   if (goal.categoryId != null) {
      const categoryId = goal.categoryId;
      categoryCondition = or(
         eq(transactions.categoryId, categoryId),
         inArray(
            transactions.subcategoryId,
            db
               .select({ id: subcategories.id })
               .from(subcategories)
               .where(eq(subcategories.categoryId, categoryId)),
         ),
      );
   } else if (goal.subcategoryId != null) {
      const subcategoryId = goal.subcategoryId;
      categoryCondition = eq(transactions.subcategoryId, subcategoryId);
   } else {
      return 0;
   }

   const spentResult = await db
      .select({
         spent: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      })
      .from(transactions)
      .where(and(...baseConditions, categoryCondition));

   return Number(spentResult[0]?.spent ?? "0");
}

function computePercentUsed(spentAmount: number, limitAmount: string): number {
   const limit = Number(limitAmount);
   if (limit === 0) return 0;
   return Math.round((spentAmount / limit) * 100);
}

export async function listBudgetGoals(
   db: DatabaseInstance,
   { teamId, month, year }: { teamId: string; month: number; year: number },
): Promise<BudgetGoalWithProgress[]> {
   try {
      const rows = await db
         .select({
            goal: budgetGoals,
            categoryName: categories.name,
            categoryIcon: categories.icon,
            categoryColor: categories.color,
            subcategoryName: subcategories.name,
         })
         .from(budgetGoals)
         .leftJoin(categories, eq(budgetGoals.categoryId, categories.id))
         .leftJoin(
            subcategories,
            eq(budgetGoals.subcategoryId, subcategories.id),
         )
         .where(
            and(
               eq(budgetGoals.teamId, teamId),
               eq(budgetGoals.month, month),
               eq(budgetGoals.year, year),
            ),
         );

      const result: BudgetGoalWithProgress[] = [];

      for (const row of rows) {
         const spentAmount = await computeSpentAmount(
            db,
            row.goal,
            month,
            year,
         );
         const percentUsed = computePercentUsed(
            spentAmount,
            row.goal.limitAmount,
         );

         result.push({
            ...row.goal,
            categoryName: row.categoryName ?? null,
            categoryIcon: row.categoryIcon ?? null,
            categoryColor: row.categoryColor ?? null,
            subcategoryName: row.subcategoryName ?? null,
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
   db: DatabaseInstance,
   {
      teamId,
      fromMonth,
      fromYear,
      toMonth,
      toYear,
   }: {
      teamId: string;
      fromMonth: number;
      fromYear: number;
      toMonth: number;
      toYear: number;
   },
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

      const newGoals: NewBudgetGoal[] = sourceGoals.map((goal) => ({
         teamId: goal.teamId,
         categoryId: goal.categoryId,
         subcategoryId: goal.subcategoryId,
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
   db: DatabaseInstance,
   { month, year }: { month: number; year: number },
): Promise<BudgetGoalWithProgress[]> {
   try {
      const rows = await db
         .select({
            goal: budgetGoals,
            categoryName: categories.name,
            categoryIcon: categories.icon,
            categoryColor: categories.color,
            subcategoryName: subcategories.name,
         })
         .from(budgetGoals)
         .leftJoin(categories, eq(budgetGoals.categoryId, categories.id))
         .leftJoin(
            subcategories,
            eq(budgetGoals.subcategoryId, subcategories.id),
         )
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
         const spentAmount = await computeSpentAmount(
            db,
            row.goal,
            month,
            year,
         );
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
               subcategoryName: row.subcategoryName ?? null,
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
