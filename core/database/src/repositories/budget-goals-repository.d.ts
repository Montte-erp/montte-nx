import type { DatabaseInstance } from "@core/database/client";
import {
   type BudgetGoal,
   type CreateBudgetGoalInput,
   type UpdateBudgetGoalInput,
} from "@core/database/schemas/budget-goals";
export type BudgetGoalWithProgress = BudgetGoal & {
   categoryName: string | null;
   categoryIcon: string | null;
   categoryColor: string | null;
   spentAmount: string;
   percentUsed: number;
};
export declare function createBudgetGoal(
   db: DatabaseInstance,
   teamId: string,
   data: CreateBudgetGoalInput,
): Promise<{
   alertSentAt: Date | null;
   alertThreshold: number | null;
   categoryId: string;
   createdAt: Date;
   id: string;
   limitAmount: string;
   month: number;
   teamId: string;
   updatedAt: Date;
   year: number;
}>;
export declare function getBudgetGoal(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   id: string;
   teamId: string;
   categoryId: string;
   month: number;
   year: number;
   limitAmount: string;
   alertThreshold: number | null;
   alertSentAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function ensureBudgetGoalOwnership(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   id: string;
   teamId: string;
   categoryId: string;
   month: number;
   year: number;
   limitAmount: string;
   alertThreshold: number | null;
   alertSentAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function updateBudgetGoal(
   db: DatabaseInstance,
   id: string,
   teamId: string,
   data: UpdateBudgetGoalInput,
): Promise<{
   id: string;
   teamId: string;
   categoryId: string;
   month: number;
   year: number;
   limitAmount: string;
   alertThreshold: number | null;
   alertSentAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteBudgetGoal(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<void>;
export declare function markAlertSent(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   id: string;
   teamId: string;
   categoryId: string;
   month: number;
   year: number;
   limitAmount: string;
   alertThreshold: number | null;
   alertSentAt: Date | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function listBudgetGoals(
   db: DatabaseInstance,
   teamId: string,
   month: number,
   year: number,
): Promise<BudgetGoalWithProgress[]>;
export declare function copyPreviousMonth(
   db: DatabaseInstance,
   teamId: string,
   fromMonth: number,
   fromYear: number,
   toMonth: number,
   toYear: number,
): Promise<number>;
export declare function getGoalsForAlertCheck(
   db: DatabaseInstance,
   month: number,
   year: number,
): Promise<BudgetGoalWithProgress[]>;
//# sourceMappingURL=budget-goals-repository.d.ts.map
