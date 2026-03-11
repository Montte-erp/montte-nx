import { AppError, propagateError, validateInput } from "@core/logging/errors";
import { greaterThanOrEqual, of, toDecimal } from "@f-o-t/money";
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
         .values({
            ...validated,
            teamId,
            currentAmount: "0",
         })
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
      if (!goal) throw AppError.database("Failed to update financial goal");
      return goal;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to update financial goal");
   }
}

export async function deleteFinancialGoal(id: string, teamId: string) {
   try {
      const [goal] = await db
         .delete(financialGoals)
         .where(
            and(eq(financialGoals.id, id), eq(financialGoals.teamId, teamId)),
         )
         .returning();
      if (!goal) throw AppError.database("Failed to delete financial goal");
      return goal;
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

   return await db.transaction(async (tx) => {
      const [goal] = await tx
         .select()
         .from(financialGoals)
         .where(eq(financialGoals.id, goalId));

      if (!goal) throw AppError.notFound("Meta não encontrada");

      const currentMoney = of(Number(goal.currentAmount), "BRL");
      const amountMoney = of(Number(validated.amount), "BRL");

      if (validated.type === "withdrawal") {
         if (!greaterThanOrEqual(currentMoney, amountMoney)) {
            throw AppError.conflict(
               `Valor maior que o saldo atual (saldo atual: ${toDecimal(currentMoney)})`,
            );
         }
      }

      const [movement] = await tx
         .insert(financialGoalMovements)
         .values({
            ...validated,
            goalId,
         })
         .returning();

      const delta =
         validated.type === "deposit"
            ? Number(validated.amount)
            : -Number(validated.amount);

      const [updatedGoal] = await tx
         .update(financialGoals)
         .set({
            currentAmount: sql`${financialGoals.currentAmount} + ${delta}`,
            isCompleted: sql`(${financialGoals.currentAmount} + ${delta}) >= ${financialGoals.targetAmount}::numeric`,
         })
         .where(eq(financialGoals.id, goalId))
         .returning();

      if (!movement) throw AppError.database("Failed to create goal movement");
      return { movement, goal: updatedGoal };
   });
}

export async function deleteGoalMovement(id: string) {
   return await db.transaction(async (tx) => {
      const [movement] = await tx
         .select()
         .from(financialGoalMovements)
         .where(eq(financialGoalMovements.id, id));

      if (!movement) throw AppError.notFound("Movimentação não encontrada");

      const amountNum = Number(movement.amount);
      const delta = movement.type === "deposit" ? -amountNum : amountNum;

      await tx
         .delete(financialGoalMovements)
         .where(eq(financialGoalMovements.id, id));

      await tx
         .update(financialGoals)
         .set({
            currentAmount: sql`${financialGoals.currentAmount} + ${delta}`,
            isCompleted: sql`(${financialGoals.currentAmount} + ${delta}) >= ${financialGoals.targetAmount}::numeric`,
         })
         .where(eq(financialGoals.id, movement.goalId));

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
