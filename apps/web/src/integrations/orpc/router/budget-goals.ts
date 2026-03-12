import {
   copyPreviousMonth,
   createBudgetGoal,
   deleteBudgetGoal,
   ensureBudgetGoalOwnership,
   listBudgetGoals,
   updateBudgetGoal,
} from "@core/database/repositories/budget-goals-repository";
import {
   createBudgetGoalSchema,
   updateBudgetGoalSchema,
} from "@core/database/schemas/budget-goals";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

const monthYearSchema = z.object({
   month: z.number().int().min(1).max(12),
   year: z.number().int().min(2000).max(2100),
});

export const getAll = protectedProcedure
   .input(monthYearSchema)
   .handler(async ({ context, input }) => {
      return listBudgetGoals(context.teamId, input.month, input.year);
   });

export const create = protectedProcedure
   .input(createBudgetGoalSchema)
   .handler(async ({ context, input }) => {
      return createBudgetGoal(context.teamId, input);
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateBudgetGoalSchema))
   .handler(async ({ context, input }) => {
      await ensureBudgetGoalOwnership(input.id, context.teamId);
      const { id, ...data } = input;
      return updateBudgetGoal(id, context.teamId, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureBudgetGoalOwnership(input.id, context.teamId);
      await deleteBudgetGoal(input.id, context.teamId);
      return { success: true };
   });

export const copyFromPreviousMonth = protectedProcedure
   .input(monthYearSchema)
   .handler(async ({ context, input }) => {
      const prevMonth = input.month === 1 ? 12 : input.month - 1;
      const prevYear = input.month === 1 ? input.year - 1 : input.year;
      const count = await copyPreviousMonth(
         context.teamId,
         prevMonth,
         prevYear,
         input.month,
         input.year,
      );
      return { count };
   });
