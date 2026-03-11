import { ORPCError } from "@orpc/server";
import {
   copyPreviousMonth,
   createBudgetGoal,
   deleteBudgetGoal,
   getBudgetGoal,
   listBudgetGoals,
   updateBudgetGoal,
} from "@core/database/repositories/budget-goals-repository";
import {
   createBudgetGoalSchema,
   updateBudgetGoalSchema,
} from "@core/database/schemas/budget-goals";
import { z } from "zod";
import { protectedProcedure } from "../server";

export const getAll = protectedProcedure
   .input(
      z.object({
         month: z.number().int().min(1).max(12),
         year: z.number().int().min(2000).max(2100),
      }),
   )
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return listBudgetGoals(teamId, input.month, input.year);
   });

export const create = protectedProcedure
   .input(createBudgetGoalSchema)
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return createBudgetGoal(teamId, input);
   });

export const update = protectedProcedure
   .input(
      z.object({
         id: z.string().uuid(),
         data: updateBudgetGoalSchema,
      }),
   )
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const existing = await getBudgetGoal(input.id, teamId);
      if (!existing) {
         throw new ORPCError("NOT_FOUND", { message: "Meta não encontrada." });
      }
      return updateBudgetGoal(input.id, teamId, input.data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const existing = await getBudgetGoal(input.id, teamId);
      if (!existing) {
         throw new ORPCError("NOT_FOUND", { message: "Meta não encontrada." });
      }
      await deleteBudgetGoal(input.id, teamId);
      return { success: true };
   });

export const copyFromPreviousMonth = protectedProcedure
   .input(
      z.object({
         month: z.number().int().min(1).max(12),
         year: z.number().int().min(2000).max(2100),
      }),
   )
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const prevMonth = input.month === 1 ? 12 : input.month - 1;
      const prevYear = input.month === 1 ? input.year - 1 : input.year;
      const count = await copyPreviousMonth(
         teamId,
         prevMonth,
         prevYear,
         input.month,
         input.year,
      );
      return { count };
   });
