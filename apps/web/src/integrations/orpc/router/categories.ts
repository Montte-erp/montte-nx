import {
   archiveCategory,
   bulkDeleteCategories,
   createCategory,
   deleteCategory,
   ensureCategoryOwnership,
   listCategories,
   updateCategory,
} from "@core/database/repositories/categories-repository";
import {
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { user as userTable } from "@core/database/schemas/auth";
import { getLogger } from "@core/logging/root";
import { eq } from "drizzle-orm";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { z } from "zod";
import { DeriveKeywordsWorkflow } from "@/integrations/dbos/workflows";
import { protectedProcedure } from "../server";

const logger = getLogger().child({ module: "categories.router" });

function enqueueKeywordDerivation(input: {
   categoryId: string;
   teamId: string;
   organizationId: string;
   userId: string;
   name: string;
   description?: string | null;
   stripeCustomerId?: string | null;
}): void {
   void DBOS.startWorkflow(DeriveKeywordsWorkflow)
      .run(input)
      .catch((err) => {
         logger.error(
            { err, categoryId: input.categoryId },
            "Failed to start derive-keywords workflow",
         );
      });
}

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createCategorySchema)
   .handler(async ({ context, input }) => {
      const [category, userRecord] = await Promise.all([
         createCategory(context.db, context.teamId, input),
         context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         }),
      ]);
      enqueueKeywordDerivation({
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
      const category = await updateCategory(context.db, id, data);
      if (data.name !== undefined || data.description !== undefined) {
         const userRecord = await context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         });
         enqueueKeywordDerivation({
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
