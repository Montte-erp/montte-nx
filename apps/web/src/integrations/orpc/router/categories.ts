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
      const [categoryResult, userRecord] = await Promise.all([
         createCategoryWithSubcategories(context.db, context.teamId, input),
         context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         }),
      ]);
      const { category } = categoryResult.match(
         (v) => v,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
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
      const all = (
         await listCategories(context.db, context.teamId, {
            type: input?.type,
            includeArchived: input?.includeArchived,
         })
      ).match(
         (v) => v,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
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
      const { id, ...data } = input;
      const category = (
         await ensureCategoryOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => updateCategory(context.db, id, data))
      ).match(
         (v) => v,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
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
      (
         await ensureCategoryOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => deleteCategory(context.db, input.id))
      ).match(
         () => null,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return { success: true };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   return (
      await listCategories(context.db, context.teamId, {
         includeArchived: true,
      })
   ).match(
      (v) => v,
      (e) => {
         throw WebAppError.fromAppError(e);
      },
   );
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
      const { all, parents } = (
         await importCategoriesBatch(
            context.db,
            context.teamId,
            input.categories,
         )
      ).match(
         (v) => v,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
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
      return (
         await ensureCategoryOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => archiveCategory(context.db, input.id))
      ).match(
         (v) => v,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const unarchive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      return (
         await ensureCategoryOwnership(
            context.db,
            input.id,
            context.teamId,
         ).andThen(() => reactivateCategory(context.db, input.id))
      ).match(
         (v) => v,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      (await bulkDeleteCategories(context.db, input.ids, context.teamId)).match(
         () => null,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return { deleted: input.ids.length };
   });

export const bulkArchive = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      (
         await bulkArchiveCategories(context.db, input.ids, context.teamId)
      ).match(
         () => null,
         (e) => {
            throw WebAppError.fromAppError(e);
         },
      );
      return { archived: input.ids.length };
   });
