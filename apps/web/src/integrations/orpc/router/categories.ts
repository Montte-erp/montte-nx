import { ORPCError } from "@orpc/server";
import {
   archiveCategory,
   categoryTreeHasTransactions,
   createCategory,
   deleteCategory,
   getCategory,
   listCategories,
   updateCategory,
} from "@core/database/repositories/categories-repository";
import { createSubcategory } from "@core/database/repositories/subcategories-repository";
import { categories } from "@core/database/schemas/categories";
import { createInsertSchema } from "drizzle-orm/zod";
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
      keywords: z.array(z.string()).nullable().optional(),
      notes: z.string().nullable().optional(),
      type: z.enum(["income", "expense"]).nullable().optional(),
   });

// =============================================================================
// Category Procedures
// =============================================================================

export const create = protectedProcedure
   .input(categorySchema)
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return createCategory(teamId, {
         name: input.name,
         color: input.color ?? null,
         icon: input.icon ?? null,
         keywords: input.keywords ?? null,
         notes: input.notes ?? null,
         type: input.type ?? null,
      });
   });

const getAllInput = z
   .object({
      type: z.enum(["income", "expense"]).optional(),
      includeArchived: z.boolean().optional(),
   })
   .optional();

export const getAll = protectedProcedure
   .input(getAllInput)
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      return listCategories(teamId, {
         type: input?.type,
         includeArchived: input?.includeArchived,
      });
   });

export const update = protectedProcedure
   .input(z.object({ id: z.string().uuid() }).merge(categorySchema))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const category = await getCategory(input.id);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      return updateCategory(input.id, {
         name: input.name,
         color: input.color ?? null,
         icon: input.icon ?? null,
         keywords: input.keywords ?? null,
         notes: input.notes ?? null,
         type: input.type ?? null,
      });
   });

export const remove = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const category = await getCategory(input.id);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      const hasTransactions = await categoryTreeHasTransactions(input.id);
      if (hasTransactions) {
         throw new ORPCError("BAD_REQUEST", {
            message: "Não é possível excluir uma categoria com transações.",
         });
      }
      await deleteCategory(input.id);
      return { success: true };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const { teamId } = context;
   return listCategories(teamId, { includeArchived: true });
});

export const importBatch = protectedProcedure
   .input(
      z.object({
         categories: z.array(
            categorySchema.extend({
               subcategories: z
                  .array(
                     z.object({
                        name: z.string(),
                        keywords: z.array(z.string()).nullable().optional(),
                     }),
                  )
                  .optional(),
            }),
         ),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      const results = [];
      for (const cat of input.categories) {
         const created = await createCategory(teamId, {
            name: cat.name,
            color: cat.color ?? null,
            icon: cat.icon ?? null,
            keywords: cat.keywords ?? null,
            type: cat.type ?? null,
         });
         if (cat.subcategories) {
            for (const sub of cat.subcategories) {
               await createSubcategory(db, {
                  teamId,
                  categoryId: created.id,
                  name: sub.name,
                  keywords: sub.keywords ?? null,
               });
            }
         }
         results.push(created);
      }
      return results;
   });

export const archive = protectedProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      const { teamId } = context;
      const category = await getCategory(input.id);
      if (!category || category.teamId !== teamId) {
         throw new ORPCError("NOT_FOUND", {
            message: "Categoria não encontrada.",
         });
      }
      return archiveCategory(input.id);
   });
