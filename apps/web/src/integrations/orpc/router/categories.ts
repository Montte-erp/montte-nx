import { ORPCError } from "@orpc/server";
import {
   categoryHasTransactions,
   createCategory,
   deleteCategory,
   getCategory,
   listCategories,
   updateCategory,
} from "@packages/database/repositories/categories-repository";
import { categories } from "@packages/database/schemas/categories";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { protectedProcedure } from "../server";

// =============================================================================
// Validation Schemas
// =============================================================================

const categorySchema = createInsertSchema(categories)
   .pick({ name: true })
   .extend({
      color: z
         .string()
         .regex(/^#[0-9a-fA-F]{6}$/)
         .nullable()
         .optional(),
      icon: z.string().max(50).nullable().optional(),
      type: z.enum(["income", "expense"]).nullable().optional(),
   });

// =============================================================================
// Category Procedures
// =============================================================================

export const create = protectedProcedure
   .input(categorySchema)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return createCategory(db, {
         teamId,
         name: input.name,
         isDefault: false,
         color: input.color ?? null,
         icon: input.icon ?? null,
         type: input.type ?? null,
      });
   });

export const getAll = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   return listCategories(db, teamId);
});

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(categorySchema))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const category = await getCategory(db, input.id);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      if (category.isDefault) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Categorias padrão não podem ser editadas.",
         });
      }
      return updateCategory(db, input.id, {
         name: input.name,
         color: input.color ?? null,
         icon: input.icon ?? null,
         type: input.type ?? null,
      });
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const category = await getCategory(db, input.id);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      if (category.isDefault) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Categorias padrão não podem ser excluídas.",
         });
      }
      const hasTransactions = await categoryHasTransactions(db, input.id);
      if (hasTransactions) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Não é possível excluir uma categoria com transações.",
         });
      }
      await deleteCategory(db, input.id);
      return { success: true };
   });

export const archive = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const category = await getCategory(db, input.id);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      if (category.isDefault) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Categorias padrão não podem ser arquivadas.",
         });
      }
      return updateCategory(db, input.id, { isArchived: true });
   });
