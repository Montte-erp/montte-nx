import { AppError, propagateError } from "@packages/utils/errors";
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { DatabaseInstance } from "../client";
import {
   type FinancialGoal,
   financialGoal,
   type GoalStatus,
   type NewFinancialGoal,
   type ProgressCalculationType,
} from "../schemas/goals";
import { transaction } from "../schemas/transactions";
import { transactionTag } from "../schemas/tags";
import { transactionCategory } from "../schemas/categories";

export type {
   FinancialGoal,
   GoalStatus,
   NewFinancialGoal,
   ProgressCalculationType,
} from "../schemas/goals";

// ============================================
// Types
// ============================================

export type GoalWithTag = FinancialGoal & {
   tag: {
      id: string;
      name: string;
      color: string;
   };
   currentAmount: number;
};

export type GoalProgressSummary = {
   goalId: string;
   name: string;
   progressCalculationType: ProgressCalculationType;
   targetAmount: number;
   currentAmount: number;
   startingAmount: number;
   progressPercentage: number;
   remainingAmount: number;
   daysRemaining: number | null;
   isOnTrack: boolean;
   projectedCompletionDate: Date | null;
   tag: {
      id: string;
      name: string;
      color: string;
   };
};

// ============================================
// Progress Calculation
// ============================================

export async function calculateGoalProgress(
   dbClient: DatabaseInstance,
   tagId: string,
   organizationId: string,
   progressCalculationType: ProgressCalculationType,
   startDate?: Date,
   startingAmount = 0,
   linkedCategoryIds?: string[],
): Promise<number> {
   try {
      let amountCondition: ReturnType<typeof sql>;

      switch (progressCalculationType) {
         case "income":
            amountCondition = sql`CASE WHEN ${transaction.amount}::numeric > 0 THEN ${transaction.amount}::numeric ELSE 0 END`;
            break;
         case "expense":
            amountCondition = sql`CASE WHEN ${transaction.amount}::numeric < 0 THEN ABS(${transaction.amount}::numeric) ELSE 0 END`;
            break;
         case "net":
            amountCondition = sql`${transaction.amount}::numeric`;
            break;
      }

      const conditions = [
         eq(transactionTag.tagId, tagId),
         eq(transaction.organizationId, organizationId),
      ];

      if (startDate) {
         conditions.push(gte(transaction.date, startDate));
      }

      // Build query with optional category filter
      let query = dbClient
         .select({
            total: sql<string>`COALESCE(SUM(${amountCondition}), 0)`,
         })
         .from(transactionTag)
         .innerJoin(transaction, eq(transactionTag.transactionId, transaction.id));

      // Add category join if linkedCategoryIds are provided
      if (linkedCategoryIds && linkedCategoryIds.length > 0) {
         query = query.innerJoin(
            transactionCategory,
            eq(transactionCategory.transactionId, transaction.id),
         );
         conditions.push(inArray(transactionCategory.categoryId, linkedCategoryIds));
      }

      const result = await query.where(and(...conditions));

      const transactionTotal = Number(result[0]?.total ?? 0);
      return startingAmount + transactionTotal;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to calculate goal progress: ${(err as Error).message}`,
      );
   }
}

// ============================================
// CRUD Operations
// ============================================

export async function createGoal(
   dbClient: DatabaseInstance,
   data: NewFinancialGoal,
): Promise<FinancialGoal> {
   try {
      const result = await dbClient
         .insert(financialGoal)
         .values(data)
         .returning();
      const goal = result[0];
      if (!goal) {
         throw AppError.database("Failed to create goal - no result returned");
      }
      return goal;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to create goal: ${(err as Error).message}`,
         {
            cause: err,
         },
      );
   }
}

export async function findGoalById(
   dbClient: DatabaseInstance,
   goalId: string,
): Promise<GoalWithTag | undefined> {
   try {
      const result = await dbClient.query.financialGoal.findFirst({
         where: eq(financialGoal.id, goalId),
         with: {
            tag: true,
         },
      });

      if (!result || !result.tag) return undefined;

      const currentAmount = await calculateGoalProgress(
         dbClient,
         result.tagId,
         result.organizationId,
         result.progressCalculationType,
         result.startDate,
         Number(result.startingAmount),
         result.metadata?.linkedCategoryIds,
      );

      return {
         ...result,
         tag: {
            id: result.tag.id,
            name: result.tag.name,
            color: result.tag.color,
         },
         currentAmount,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find goal by id: ${(err as Error).message}`,
      );
   }
}

export async function findGoalsByOrganizationId(
   dbClient: DatabaseInstance,
   organizationId: string,
   options?: {
      status?: GoalStatus;
      limit?: number;
      offset?: number;
   },
): Promise<GoalWithTag[]> {
   const { status, limit = 50, offset = 0 } = options ?? {};
   try {
      const conditions = [eq(financialGoal.organizationId, organizationId)];

      if (status) {
         conditions.push(eq(financialGoal.status, status));
      }

      const results = await dbClient.query.financialGoal.findMany({
         where: and(...conditions),
         orderBy: [desc(financialGoal.createdAt)],
         limit,
         offset,
         with: {
            tag: true,
         },
      });

      // Calculate current amount for each goal
      const goalsWithProgress = await Promise.all(
         results.map(async (goal) => {
            if (!goal.tag) {
               throw AppError.database(`Goal ${goal.id} has no associated tag`);
            }

            const currentAmount = await calculateGoalProgress(
               dbClient,
               goal.tagId,
               goal.organizationId,
               goal.progressCalculationType,
               goal.startDate,
               Number(goal.startingAmount),
               goal.metadata?.linkedCategoryIds,
            );

            return {
               ...goal,
               tag: {
                  id: goal.tag.id,
                  name: goal.tag.name,
                  color: goal.tag.color,
               },
               currentAmount,
            };
         }),
      );

      return goalsWithProgress;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find goals: ${(err as Error).message}`,
      );
   }
}

export async function findGoalByTagId(
   dbClient: DatabaseInstance,
   tagId: string,
): Promise<FinancialGoal | undefined> {
   try {
      const result = await dbClient.query.financialGoal.findFirst({
         where: eq(financialGoal.tagId, tagId),
      });
      return result;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to find goal by tag id: ${(err as Error).message}`,
      );
   }
}

export async function updateGoal(
   dbClient: DatabaseInstance,
   goalId: string,
   data: Partial<Omit<NewFinancialGoal, "id" | "organizationId" | "createdAt" | "tagId">>,
): Promise<FinancialGoal | undefined> {
   try {
      const result = await dbClient
         .update(financialGoal)
         .set(data)
         .where(eq(financialGoal.id, goalId))
         .returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to update goal: ${(err as Error).message}`,
      );
   }
}

export async function completeGoal(
   dbClient: DatabaseInstance,
   goalId: string,
): Promise<FinancialGoal | undefined> {
   try {
      const result = await dbClient
         .update(financialGoal)
         .set({
            status: "completed",
            completedAt: new Date(),
         })
         .where(eq(financialGoal.id, goalId))
         .returning();
      return result[0];
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to complete goal: ${(err as Error).message}`,
      );
   }
}

export async function deleteGoal(
   dbClient: DatabaseInstance,
   goalId: string,
): Promise<boolean> {
   try {
      const result = await dbClient
         .delete(financialGoal)
         .where(eq(financialGoal.id, goalId))
         .returning({ id: financialGoal.id });
      return result.length > 0;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to delete goal: ${(err as Error).message}`,
      );
   }
}

export async function getActiveGoalsCount(
   dbClient: DatabaseInstance,
   organizationId: string,
): Promise<number> {
   try {
      const result = await dbClient.query.financialGoal.findMany({
         where: and(
            eq(financialGoal.organizationId, organizationId),
            eq(financialGoal.status, "active"),
         ),
         columns: { id: true },
      });
      return result.length;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to count goals: ${(err as Error).message}`,
      );
   }
}

export async function getGoalsNearingDeadline(
   dbClient: DatabaseInstance,
   organizationId: string,
   daysAhead = 30,
): Promise<GoalWithTag[]> {
   try {
      const now = new Date();
      const futureDate = new Date(
         now.getTime() + daysAhead * 24 * 60 * 60 * 1000,
      );

      const results = await dbClient.query.financialGoal.findMany({
         where: and(
            eq(financialGoal.organizationId, organizationId),
            eq(financialGoal.status, "active"),
            isNotNull(financialGoal.targetDate),
            gte(financialGoal.targetDate, now),
            lte(financialGoal.targetDate, futureDate),
         ),
         orderBy: [financialGoal.targetDate],
         with: {
            tag: true,
         },
      });

      const goalsWithProgress = await Promise.all(
         results.map(async (goal) => {
            if (!goal.tag) {
               throw AppError.database(`Goal ${goal.id} has no associated tag`);
            }

            const currentAmount = await calculateGoalProgress(
               dbClient,
               goal.tagId,
               goal.organizationId,
               goal.progressCalculationType,
               goal.startDate,
               Number(goal.startingAmount),
               goal.metadata?.linkedCategoryIds,
            );

            return {
               ...goal,
               tag: {
                  id: goal.tag.id,
                  name: goal.tag.name,
                  color: goal.tag.color,
               },
               currentAmount,
            };
         }),
      );

      return goalsWithProgress;
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get goals nearing deadline: ${(err as Error).message}`,
      );
   }
}

export async function getGoalProgressSummary(
   dbClient: DatabaseInstance,
   goalId: string,
): Promise<GoalProgressSummary | null> {
   try {
      const goal = await findGoalById(dbClient, goalId);
      if (!goal) return null;

      const targetAmount = Number(goal.targetAmount);
      const currentAmount = goal.currentAmount;
      const startingAmount = Number(goal.startingAmount);

      // Calculate progress percentage based on calculation type
      let progressPercentage: number;
      let remainingAmount: number;

      if (goal.progressCalculationType === "expense") {
         // For expense goals, higher spending = higher progress (spending limit tracking)
         progressPercentage =
            targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
         remainingAmount = Math.max(0, targetAmount - currentAmount);
      } else {
         // For income and net goals, we're tracking towards the target
         progressPercentage =
            targetAmount > 0 ? (currentAmount / targetAmount) * 100 : 0;
         remainingAmount = Math.max(0, targetAmount - currentAmount);
      }

      // Calculate days remaining
      let daysRemaining: number | null = null;
      if (goal.targetDate) {
         const now = new Date();
         daysRemaining = Math.max(
            0,
            Math.ceil(
               (goal.targetDate.getTime() - now.getTime()) /
                  (1000 * 60 * 60 * 24),
            ),
         );
      }

      // Calculate if on track (simple linear projection)
      let isOnTrack = true;
      let projectedCompletionDate: Date | null = null;

      if (goal.targetDate && goal.startDate && currentAmount > startingAmount) {
         const daysSinceStart = Math.max(
            1,
            (new Date().getTime() - goal.startDate.getTime()) /
               (1000 * 60 * 60 * 24),
         );
         const progressRate = (currentAmount - startingAmount) / daysSinceStart;

         if (progressRate > 0) {
            const daysToComplete = remainingAmount / progressRate;
            projectedCompletionDate = new Date(
               new Date().getTime() + daysToComplete * 24 * 60 * 60 * 1000,
            );
            isOnTrack = projectedCompletionDate <= goal.targetDate;
         }
      }

      return {
         goalId: goal.id,
         name: goal.name,
         progressCalculationType: goal.progressCalculationType,
         targetAmount,
         currentAmount,
         startingAmount,
         progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
         remainingAmount,
         daysRemaining,
         isOnTrack,
         projectedCompletionDate,
         tag: goal.tag,
      };
   } catch (err) {
      propagateError(err);
      throw AppError.database(
         `Failed to get goal progress: ${(err as Error).message}`,
      );
   }
}
