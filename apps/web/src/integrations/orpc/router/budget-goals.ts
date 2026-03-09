import { ORPCError } from "@orpc/server";
import {
   copyPreviousMonth,
   createBudgetGoal,
   deleteBudgetGoal,
   getBudgetGoal,
   listBudgetGoals,
   updateBudgetGoal,
} from "@core/database/repositories/budget-goals-repository";
import { getCategory } from "@core/database/repositories/categories-repository";
import { getSubcategory } from "@core/database/repositories/subcategories-repository";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const createSchema = z
   .object({
      categoryId: z.string().uuid().optional(),
      subcategoryId: z.string().uuid().optional(),
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2000).max(2100),
      limitAmount: z
         .string()
         .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
            message: "Limite deve ser maior que zero.",
         }),
      alertThreshold: z.number().int().min(1).max(100).optional(),
   })
   .refine((d) => !!(d.categoryId ?? d.subcategoryId), {
      message: "Informe uma categoria ou subcategoria.",
   });

// =============================================================================
// Budget Goal Procedures
// =============================================================================

export const getAll = protectedProcedure
   .input(
      z.object({
         month: z.number().int().min(1).max(12),
         year: z.number().int().min(2000).max(2100),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return listBudgetGoals(db, {
         teamId,
         month: input.month,
         year: input.year,
      });
   });

export const create = protectedProcedure
   .input(createSchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;

      if (input.categoryId) {
         const cat = await getCategory(db, input.categoryId);
         if (!cat || cat.teamId !== teamId) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Categoria inválida.",
            });
         }
      }
      if (input.subcategoryId) {
         const sub = await getSubcategory(db, input.subcategoryId);
         if (!sub || sub.teamId !== teamId) {
            throw new ORPCError("BAD_REQUEST", {
               message: "Subcategoria inválida.",
            });
         }
      }

      return createBudgetGoal(db, {
         teamId,
         categoryId: input.categoryId ?? null,
         subcategoryId: input.subcategoryId ?? null,
         month: input.month,
         year: input.year,
         limitAmount: input.limitAmount,
         alertThreshold: input.alertThreshold ?? null,
      });
   });

export const update = protectedProcedure
   .input(
      z.object({
         id: z.string().uuid(),
         limitAmount: z
            .string()
            .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
               message: "Limite deve ser maior que zero.",
            })
            .optional(),
         alertThreshold: z.number().int().min(1).max(100).nullable().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const existing = await getBudgetGoal(db, { id: input.id, teamId });
      if (!existing) {
         throw new ORPCError("NOT_FOUND", { message: "Meta não encontrada." });
      }
      const { id, ...data } = input;
      return updateBudgetGoal(db, { id, teamId }, data);
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const existing = await getBudgetGoal(db, { id: input.id, teamId });
      if (!existing) {
         throw new ORPCError("NOT_FOUND", { message: "Meta não encontrada." });
      }
      await deleteBudgetGoal(db, { id: input.id, teamId });
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
      const { db, teamId } = context;
      const prevMonth = input.month === 1 ? 12 : input.month - 1;
      const prevYear = input.month === 1 ? input.year - 1 : input.year;
      const count = await copyPreviousMonth(db, {
         teamId,
         fromMonth: prevMonth,
         fromYear: prevYear,
         toMonth: input.month,
         toYear: input.year,
      });
      return { count };
   });
