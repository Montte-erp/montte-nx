import {
   archiveCategory,
   bulkDeleteCategories,
   createCategory,
   deleteCategory,
   ensureCategoryOwnership,
   listCategories,
   updateCategory,
} from "@core/database/repositories/categories-repository";
import { ORPCError } from "@orpc/server";
import {
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { z } from "zod";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createCategorySchema)
   .handler(async ({ context, input }) => {
      return createCategory(context.db, context.teamId, input);
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
      return listCategories(context.db, context.teamId, {
         type: input?.type,
         includeArchived: input?.includeArchived,
      });
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateCategorySchema))
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId);
      const { id, ...data } = input;
      return updateCategory(context.db, id, data);
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId);
      await deleteCategory(context.db, input.id);
      return { success: true };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   return listCategories(context.db, context.teamId, { includeArchived: true });
});

export const importBatch = protectedProcedure
   .input(
      z.object({
         categories: z.array(createCategorySchema),
      }),
   )
   .handler(async ({ context, input }) => {
      const results = [];
      for (const cat of input.categories) {
         const created = await createCategory(context.db, context.teamId, cat);
         results.push(created);
      }
      return results;
   });

export const archive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId);
      return archiveCategory(context.db, input.id);
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      await bulkDeleteCategories(context.db, input.ids, context.teamId);
      return { deleted: input.ids.length };
   });
