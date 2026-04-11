import { z } from "zod";
import {
   listBudgetGoals,
   getBudgetGoal,
   ensureBudgetGoalOwnership,
   createBudgetGoal,
   updateBudgetGoal,
   deleteBudgetGoal,
} from "@core/database/repositories/budget-goals-repository";
import {
   CreateBudgetGoalSchema,
   UpdateBudgetGoalSchema,
   ListBudgetGoalsFilterSchema,
} from "@montte/cli/contract";
import { sdkProcedure } from "../server";

function mapBudgetGoal(goal: Record<string, unknown>) {
   return {
      ...goal,
      currentSpent: (goal.spentAmount as string) ?? "0",
      percentUsed: (goal.percentUsed as number) ?? 0,
      createdAt: (goal.createdAt as Date).toISOString(),
      updatedAt: (goal.updatedAt as Date).toISOString(),
   };
}

export const list = sdkProcedure
   .input(ListBudgetGoalsFilterSchema)
   .handler(async ({ context, input }) => {
      const goals = await listBudgetGoals(
         context.db,
         context.teamId!,
         input.month,
         input.year,
      );
      return goals.map(mapBudgetGoal);
   });

export const get = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureBudgetGoalOwnership(context.db, input.id, context.teamId!);
      const now = new Date();
      const goals = await listBudgetGoals(
         context.db,
         context.teamId!,
         now.getMonth() + 1,
         now.getFullYear(),
      );
      const goal = goals.find((g) => g.id === input.id);
      if (goal) return mapBudgetGoal(goal);
      const raw = await getBudgetGoal(context.db, input.id, context.teamId!);
      return mapBudgetGoal({ ...raw, spentAmount: "0", percentUsed: 0 });
   });

export const create = sdkProcedure
   .input(CreateBudgetGoalSchema)
   .handler(async ({ context, input }) => {
      const goal = await createBudgetGoal(context.db, context.teamId!, input);
      return mapBudgetGoal({ ...goal, spentAmount: "0", percentUsed: 0 });
   });

export const update = sdkProcedure
   .input(z.object({ id: z.string().uuid() }).merge(UpdateBudgetGoalSchema))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const goal = await updateBudgetGoal(
         context.db,
         id,
         context.teamId!,
         data,
      );
      return mapBudgetGoal({ ...goal, spentAmount: "0", percentUsed: 0 });
   });

export const remove = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      await ensureBudgetGoalOwnership(context.db, input.id, context.teamId!);
      await deleteBudgetGoal(context.db, input.id, context.teamId!);
      return { success: true as const };
   });
