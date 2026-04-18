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
import dayjs from "dayjs";
import { WebAppError } from "@core/logging/errors";
import { sdkProcedure } from "../server";

function mapBudgetGoal(goal: {
   createdAt?: string | Date | null;
   updatedAt?: string | Date | null;
   [key: string]: unknown;
}) {
   return {
      ...goal,
      currentSpent:
         typeof goal.spentAmount === "string" ? goal.spentAmount : "0",
      percentUsed: typeof goal.percentUsed === "number" ? goal.percentUsed : 0,
      createdAt: dayjs(goal.createdAt).toISOString(),
      updatedAt: dayjs(goal.updatedAt).toISOString(),
   };
}

export const list = sdkProcedure
   .input(ListBudgetGoalsFilterSchema)
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const goals = await listBudgetGoals(
         context.db,
         context.teamId,
         input.month,
         input.year,
      );
      return goals.map(mapBudgetGoal);
   });

export const get = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      await ensureBudgetGoalOwnership(context.db, input.id, context.teamId);
      const now = dayjs();
      const goals = await listBudgetGoals(
         context.db,
         context.teamId,
         now.month() + 1,
         now.year(),
      );
      const goal = goals.find((g) => g.id === input.id);
      if (goal) return mapBudgetGoal(goal);
      const raw = await getBudgetGoal(context.db, input.id, context.teamId);
      return mapBudgetGoal({ ...raw, spentAmount: "0", percentUsed: 0 });
   });

export const create = sdkProcedure
   .input(CreateBudgetGoalSchema)
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const goal = await createBudgetGoal(context.db, context.teamId, input);
      return mapBudgetGoal({ ...goal, spentAmount: "0", percentUsed: 0 });
   });

export const update = sdkProcedure
   .input(z.object({ id: z.string().uuid() }).merge(UpdateBudgetGoalSchema))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const { id, ...data } = input;
      const goal = await updateBudgetGoal(context.db, id, context.teamId, data);
      return mapBudgetGoal({ ...goal, spentAmount: "0", percentUsed: 0 });
   });

export const remove = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      await ensureBudgetGoalOwnership(context.db, input.id, context.teamId);
      await deleteBudgetGoal(context.db, input.id, context.teamId);
      return { success: true };
   });
