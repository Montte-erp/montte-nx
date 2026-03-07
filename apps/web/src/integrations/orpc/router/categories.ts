import { ORPCError } from "@orpc/server";
import {
   categoryHasTransactions,
   createCategory,
   deleteCategory,
   getCategory,
   listCategories,
   updateCategory,
} from "@packages/database/repositories/categories-repository";
import { createSubcategory } from "@packages/database/repositories/subcategories-repository";
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
      const { db, teamId } = context;
      return createCategory(db, {
         teamId,
         name: input.name,
         isDefault: false,
         color: input.color ?? null,
         icon: input.icon ?? null,
         keywords: input.keywords ?? null,
         notes: input.notes ?? null,
         type: input.type ?? null,
      });
   });

const getAllInput = z
   .object({
      search: z.string().optional(),
      type: z.enum(["income", "expense"]).optional(),
      includeArchived: z.boolean().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(50),
   })
   .optional();

export const getAll = protectedProcedure
   .input(getAllInput)
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      return listCategories(db, teamId, {
         search: input?.search,
         type: input?.type,
         includeArchived: input?.includeArchived,
         page: input?.page,
         pageSize: input?.pageSize,
      });
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
         keywords: input.keywords ?? null,
         notes: input.notes ?? null,
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

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const { db, teamId } = context;
   const result = await listCategories(db, teamId, {
      includeArchived: true,
      pageSize: 10000,
   });
   return result.data;
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
         const created = await createCategory(db, {
            teamId,
            name: cat.name,
            isDefault: false,
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
