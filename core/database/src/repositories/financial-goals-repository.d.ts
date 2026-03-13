import type { DatabaseInstance } from "@core/database/client";
import {
   type CreateFinancialGoalInput,
   type CreateGoalMovementInput,
   type UpdateFinancialGoalInput,
} from "@core/database/schemas/financial-goals";
export declare function createFinancialGoal(
   db: DatabaseInstance,
   teamId: string,
   data: CreateFinancialGoalInput,
): Promise<{
   alertSentAt: Date | null;
   alertThreshold: number | null;
   categoryId: string | null;
   createdAt: Date;
   currentAmount: string;
   id: string;
   isCompleted: boolean;
   name: string;
   startDate: string;
   targetAmount: string;
   targetDate: string | null;
   teamId: string;
   updatedAt: Date;
}>;
export declare function getFinancialGoal(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   id: string;
   teamId: string;
   categoryId: string | null;
   name: string;
   targetAmount: string;
   currentAmount: string;
   startDate: string;
   targetDate: string | null;
   alertThreshold: number | null;
   alertSentAt: Date | null;
   isCompleted: boolean;
   createdAt: Date;
   updatedAt: Date;
} | null>;
export declare function listFinancialGoals(
   db: DatabaseInstance,
   teamId: string,
   opts?: {
      isCompleted?: boolean;
   },
): Promise<
   {
      id: string;
      teamId: string;
      categoryId: string | null;
      name: string;
      targetAmount: string;
      currentAmount: string;
      startDate: string;
      targetDate: string | null;
      alertThreshold: number | null;
      alertSentAt: Date | null;
      isCompleted: boolean;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
export declare function updateFinancialGoal(
   db: DatabaseInstance,
   id: string,
   teamId: string,
   data: UpdateFinancialGoalInput,
): Promise<{
   id: string;
   teamId: string;
   categoryId: string | null;
   name: string;
   targetAmount: string;
   currentAmount: string;
   startDate: string;
   targetDate: string | null;
   alertThreshold: number | null;
   alertSentAt: Date | null;
   isCompleted: boolean;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function deleteFinancialGoal(
   db: DatabaseInstance,
   id: string,
   teamId: string,
): Promise<{
   alertSentAt: Date | null;
   alertThreshold: number | null;
   categoryId: string | null;
   createdAt: Date;
   currentAmount: string;
   id: string;
   isCompleted: boolean;
   name: string;
   startDate: string;
   targetAmount: string;
   targetDate: string | null;
   teamId: string;
   updatedAt: Date;
}>;
export declare function createGoalMovement(
   db: DatabaseInstance,
   goalId: string,
   data: CreateGoalMovementInput,
): Promise<{
   movement: {
      amount: string;
      createdAt: Date;
      date: string;
      goalId: string;
      id: string;
      notes: string | null;
      transactionId: string | null;
      type: "deposit" | "withdrawal";
      updatedAt: Date;
   };
   goal:
      | {
           id: string;
           teamId: string;
           categoryId: string | null;
           name: string;
           targetAmount: string;
           currentAmount: string;
           startDate: string;
           targetDate: string | null;
           alertThreshold: number | null;
           alertSentAt: Date | null;
           isCompleted: boolean;
           createdAt: Date;
           updatedAt: Date;
        }
      | undefined;
}>;
export declare function deleteGoalMovement(
   db: DatabaseInstance,
   id: string,
): Promise<{
   id: string;
   goalId: string;
   type: "deposit" | "withdrawal";
   amount: string;
   date: string;
   transactionId: string | null;
   notes: string | null;
   createdAt: Date;
   updatedAt: Date;
}>;
export declare function listGoalMovements(
   db: DatabaseInstance,
   goalId: string,
): Promise<
   {
      id: string;
      goalId: string;
      type: "deposit" | "withdrawal";
      amount: string;
      date: string;
      transactionId: string | null;
      notes: string | null;
      createdAt: Date;
      updatedAt: Date;
   }[]
>;
//# sourceMappingURL=financial-goals-repository.d.ts.map
