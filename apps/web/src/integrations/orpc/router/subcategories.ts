import { ORPCError } from "@orpc/server";
import { getCategory } from "@core/database/repositories/categories-repository";
import {
   createSubcategory,
   deleteSubcategory,
   getSubcategory,
   listSubcategoriesByCategoryId,
   subcategoryHasTransactions,
   updateSubcategory,
} from "@core/database/repositories/subcategories-repository";
import { subcategories } from "@core/database/schemas/subcategories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const subcategorySchema = createInsertSchema(subcategories)
   .pick({ name: true })
   .extend({
      keywords: z.array(z.string()).nullable().optional(),
      isReturn: z.boolean().optional(),
      notes: z.string().nullable().optional(),
   });

// =============================================================================
// Subcategory Procedures
// =============================================================================

export const listByCategoryId = protectedProcedure
   .input(z.object({ categoryId: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const category = await getCategory(db, input.categoryId);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      return listSubcategoriesByCategoryId(db, input.categoryId, teamId);
   });

export const create = protectedProcedure
   .input(z.object({ categoryId: z.string().uuid() }).merge(subcategorySchema))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const category = await getCategory(db, input.categoryId);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      return createSubcategory(db, {
         teamId,
         categoryId: input.categoryId,
         name: input.name,
         keywords: input.keywords ?? null,
         isReturn: input.isReturn ?? false,
         notes: input.notes ?? null,
      });
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(subcategorySchema))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const sub = await getSubcategory(db, input.id);
      if (!sub || sub.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Subcategoria não encontrada.",
         });
      }
      return updateSubcategory(db, input.id, {
         name: input.name,
         keywords: input.keywords ?? null,
         isReturn: input.isReturn ?? false,
         notes: input.notes ?? null,
      });
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const sub = await getSubcategory(db, input.id);
      if (!sub || sub.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Subcategoria não encontrada.",
         });
      }
      const hasTransactions = await subcategoryHasTransactions(db, input.id);
      if (hasTransactions) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Não é possível excluir uma subcategoria com transações.",
         });
      }
      await deleteSubcategory(db, input.id);
      return { success: true };
   });
