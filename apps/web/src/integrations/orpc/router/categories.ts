import {
   archiveCategory,
   bulkArchiveCategories,
   bulkDeleteCategories,
   createCategoryWithSubcategories,
   deleteCategory,
   ensureCategoryOwnership,
   importCategoriesBatch,
   listCategories,
   reactivateCategory,
   updateCategory,
} from "@core/database/repositories/categories-repository";
import {
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { user as userTable } from "@core/database/schemas/auth";
import { WebAppError } from "@core/logging/errors";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { startDeriveKeywordsWorkflow } from "@/integrations/dbos/workflows/runner";
import { protectedProcedure } from "../server";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(
      createCategorySchema.extend({
         subcategories: z
            .array(z.object({ name: z.string().min(1).max(100) }))
            .optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const [result, userRecord] = await Promise.all([
         createCategoryWithSubcategories(context.db, context.teamId, input),
         context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         }),
      ]);
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      const { category } = result.value;
      startDeriveKeywordsWorkflow({
         categoryId: category.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         name: category.name,
         description: category.description,
         stripeCustomerId: userRecord?.stripeCustomerId ?? null,
      });
      return category;
   });

const getAllInput = z
   .object({
      type: z.enum(["income", "expense"]).optional(),
      includeArchived: z.boolean().optional(),
      search: z.string().optional(),
   })
   .optional();

export const getAll = protectedProcedure
   .input(getAllInput)
   .handler(async ({ context, input }) => {
      const result = await listCategories(context.db, context.teamId, {
         type: input?.type,
         includeArchived: input?.includeArchived,
      });
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      const all = result.value;
      if (!input?.search) return all;
      const q = input.search.toLowerCase();
      const matchingParentIds = new Set<string>();
      for (const c of all) {
         if (c.name.toLowerCase().includes(q)) {
            if (c.parentId === null) matchingParentIds.add(c.id);
            else matchingParentIds.add(c.parentId);
         }
      }
      return all.filter((c) =>
         c.parentId === null
            ? matchingParentIds.has(c.id)
            : matchingParentIds.has(c.parentId),
      );
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateCategorySchema))
   .handler(async ({ context, input }) => {
      const ownershipResult = await ensureCategoryOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const { id, ...data } = input;
      const updateResult = await updateCategory(context.db, id, data);
      if (updateResult.isErr())
         throw WebAppError.fromAppError(updateResult.error);
      const category = updateResult.value;
      if (data.name !== undefined || data.description !== undefined) {
         const userRecord = await context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         });
         startDeriveKeywordsWorkflow({
            categoryId: category.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            userId: context.userId,
            name: category.name,
            description: category.description,
            stripeCustomerId: userRecord?.stripeCustomerId ?? null,
         });
      }
      return category;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownershipResult = await ensureCategoryOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const deleteResult = await deleteCategory(context.db, input.id);
      if (deleteResult.isErr())
         throw WebAppError.fromAppError(deleteResult.error);
      return { success: true };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const result = await listCategories(context.db, context.teamId, {
      includeArchived: true,
   });
   if (result.isErr()) throw WebAppError.fromAppError(result.error);
   return result.value;
});

export const importBatch = protectedProcedure
   .input(
      z.object({
         categories: z.array(
            createCategorySchema.extend({
               subcategories: z
                  .array(
                     z.object({
                        name: z.string().min(1).max(100),
                        keywords: z.array(z.string()).optional(),
                     }),
                  )
                  .optional(),
            }),
         ),
      }),
   )
   .handler(async ({ context, input }) => {
      const userRecord = await context.db.query.user.findFirst({
         where: eq(userTable.id, context.userId),
         columns: { stripeCustomerId: true },
      });
      const result = await importCategoriesBatch(
         context.db,
         context.teamId,
         input.categories,
      );
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      const { all, parents } = result.value;
      for (const created of parents) {
         startDeriveKeywordsWorkflow({
            categoryId: created.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            userId: context.userId,
            name: created.name,
            description: created.description,
            stripeCustomerId: userRecord?.stripeCustomerId ?? null,
         });
      }
      return all;
   });

export const archive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownershipResult = await ensureCategoryOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const archiveResult = await archiveCategory(context.db, input.id);
      if (archiveResult.isErr())
         throw WebAppError.fromAppError(archiveResult.error);
      return archiveResult.value;
   });

export const unarchive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      const ownershipResult = await ensureCategoryOwnership(
         context.db,
         input.id,
         context.teamId,
      );
      if (ownershipResult.isErr())
         throw WebAppError.fromAppError(ownershipResult.error);
      const reactivateResult = await reactivateCategory(context.db, input.id);
      if (reactivateResult.isErr())
         throw WebAppError.fromAppError(reactivateResult.error);
      return reactivateResult.value;
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const result = await bulkDeleteCategories(
         context.db,
         input.ids,
         context.teamId,
      );
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      return { deleted: input.ids.length };
   });

export const bulkArchive = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const result = await bulkArchiveCategories(
         context.db,
         input.ids,
         context.teamId,
      );
      if (result.isErr()) throw WebAppError.fromAppError(result.error);
      return { archived: input.ids.length };
   });
