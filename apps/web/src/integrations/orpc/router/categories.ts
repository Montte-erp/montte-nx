import {
   archiveCategory,
   bulkArchiveCategories,
   bulkDeleteCategories,
   createCategory,
   deleteCategory,
   ensureCategoryOwnership,
   listCategories,
   reactivateCategory,
   updateCategory,
} from "@core/database/repositories/categories-repository";
import {
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { user as userTable } from "@core/database/schemas/auth";
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
      const { subcategories, ...catData } = input;
      const [category, userRecord] = await Promise.all([
         context.db.transaction(async (tx) => {
            const created = await createCategory(tx, context.teamId, catData);
            if (subcategories && subcategories.length > 0) {
               for (const sub of subcategories) {
                  await createCategory(tx, context.teamId, {
                     name: sub.name,
                     type: catData.type,
                     parentId: created.id,
                     participatesDre: false,
                  });
               }
            }
            return created;
         }),
         context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         }),
      ]);
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
      const all = await listCategories(context.db, context.teamId, {
         type: input?.type,
         includeArchived: input?.includeArchived,
      });
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
      await ensureCategoryOwnership(context.db, input.id, context.teamId);
      const { id, ...data } = input;
      const category = await updateCategory(context.db, id, data);
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

      const { allResults, parentCategories } = await context.db.transaction(
         async (tx) => {
            const allResults = [];
            const parentCategories = [];
            for (const cat of input.categories) {
               const { subcategories, ...catData } = cat;
               const created = await createCategory(
                  tx,
                  context.teamId,
                  catData,
               );
               parentCategories.push(created);
               allResults.push(created);
               if (subcategories && subcategories.length > 0) {
                  for (const sub of subcategories) {
                     const createdSub = await createCategory(
                        tx,
                        context.teamId,
                        {
                           name: sub.name,
                           type: catData.type,
                           parentId: created.id,
                           participatesDre: false,
                           keywords: sub.keywords ?? null,
                        },
                     );
                     allResults.push(createdSub);
                  }
               }
            }
            return { allResults, parentCategories };
         },
      );

      for (const created of parentCategories) {
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

      return allResults;
   });

export const archive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId);
      return archiveCategory(context.db, input.id);
   });

export const unarchive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId);
      return reactivateCategory(context.db, input.id);
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      await bulkDeleteCategories(context.db, input.ids, context.teamId);
      return { deleted: input.ids.length };
   });

export const bulkArchive = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      await bulkArchiveCategories(context.db, input.ids, context.teamId);
      return { archived: input.ids.length };
   });
