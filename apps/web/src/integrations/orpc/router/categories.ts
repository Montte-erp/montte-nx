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
import {
   startDeriveKeywordsWorkflow,
   startImportBatchWorkflow,
} from "@/integrations/dbos/workflows/runner";
import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
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
      const [userRecord] = await Promise.all([
         context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         }),
      ]);

      const importId = crypto.randomUUID();
      startImportBatchWorkflow({
         importId,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         stripeCustomerId: userRecord?.stripeCustomerId ?? null,
         categories: input.categories.map((cat) => ({
            name: cat.name,
            type: cat.type,
            color: cat.color ?? null,
            icon: cat.icon ?? null,
            keywords: cat.keywords ?? null,
            participatesDre: cat.participatesDre,
            subcategories: (cat.subcategories ?? []).map((s) => ({
               name: s.name,
               keywords: s.keywords ?? undefined,
            })),
         })),
      });

      return { importId };
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

export const checkDuplicates = protectedProcedure
   .input(z.object({ names: z.array(z.string().min(1)) }))
   .handler(async ({ context, input }) => {
      const existing = await listCategories(context.db, context.teamId, {
         includeArchived: false,
      });
      const parents = existing.filter((c) => c.parentId === null);
      return input.names.map((name) => {
         if (parents.length === 0) return 0;
         const evalContext = { data: { name: name.toLowerCase() } };
         return Math.max(
            ...parents.map((e) => {
               const group = {
                  id: e.id,
                  operator: "OR" as const,
                  scoringMode: "weighted" as const,
                  conditions: [
                     {
                        id: `${e.id}-name`,
                        type: "string" as const,
                        field: "name",
                        operator: "ilike" as const,
                        value: e.name.toLowerCase(),
                        options: { weight: 1.0 },
                     },
                  ],
               };
               const result = evaluateConditionGroup(group, evalContext);
               return result.scorePercentage ?? (result.passed ? 1 : 0);
            }),
         );
      });
   });
