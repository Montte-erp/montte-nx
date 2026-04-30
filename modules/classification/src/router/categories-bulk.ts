import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import {
   categories,
   categorySchema,
   createCategorySchema,
} from "@core/database/schemas/categories";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   blockDefaultCategories,
   requireNoTransactionsForExpandedIds,
   requireOwnedCategoryIds,
   withExpandedCategoryIds,
} from "@modules/classification/router/middlewares";
import { enqueueDeriveKeywordsWorkflow } from "@modules/classification/workflows/derive-keywords-workflow";

const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

const importSubcategoryInputSchema = categorySchema
   .pick({ name: true })
   .extend({ keywords: z.array(z.string()).optional() });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.categories.findMany({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
         orderBy: (f, { asc }) => [asc(f.name)],
      }),
      () => WebAppError.internal("Falha ao exportar categorias."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const importBatch = protectedProcedure
   .input(
      z.object({
         categories: z.array(
            createCategorySchema.extend({
               subcategories: z.array(importSubcategoryInputSchema).optional(),
            }),
         ),
      }),
   )
   .handler(async ({ context, input }) => {
      type CategoryRow = typeof categories.$inferSelect;

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const all: CategoryRow[] = [];
            const parents: CategoryRow[] = [];
            for (const item of input.categories) {
               const { subcategories, ...data } = item;
               const [parent] = await tx
                  .insert(categories)
                  .values({
                     ...data,
                     teamId: context.teamId,
                     level: 1,
                     type: data.type,
                  })
                  .returning();
               if (!parent) throw new Error("empty insert");
               parents.push(parent);
               all.push(parent);
               for (const sub of subcategories ?? []) {
                  const [child] = await tx
                     .insert(categories)
                     .values({
                        name: sub.name,
                        type: parent.type,
                        parentId: parent.id,
                        level: 2,
                        teamId: context.teamId,
                        participatesDre: false,
                        keywords: sub.keywords ?? null,
                     })
                     .returning();
                  if (!child) throw new Error("empty insert");
                  all.push(child);
               }
            }
            return { all, parents };
         }),
         () => WebAppError.internal("Falha ao importar categorias."),
      );
      if (result.isErr()) throw result.error;

      const { all, parents } = result.value;
      await Promise.all(
         parents.map((p) =>
            enqueueDeriveKeywordsWorkflow(context.workflowClient, {
               categoryId: p.id,
               teamId: context.teamId,
               organizationId: context.organizationId,
               userId: context.userId,
               name: p.name,
               description: p.description,
            }),
         ),
      );
      return all;
   });

export const bulkRemove = protectedProcedure
   .input(idsSchema)
   .use(requireOwnedCategoryIds, (input) => input.ids)
   .use(
      blockDefaultCategories,
      () => "Categorias padrão não podem ser excluídas.",
   )
   .use(withExpandedCategoryIds, (input) => input.ids)
   .use(requireNoTransactionsForExpandedIds)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .delete(categories)
            .where(inArray(categories.id, input.ids))
            .then(() => undefined),
         () => WebAppError.internal("Falha ao excluir categorias."),
      );
      if (result.isErr()) throw result.error;
      return { deleted: input.ids.length };
   });

export const bulkArchive = protectedProcedure
   .input(idsSchema)
   .use(requireOwnedCategoryIds, (input) => input.ids)
   .use(
      blockDefaultCategories,
      () => "Categorias padrão não podem ser arquivadas.",
   )
   .use(withExpandedCategoryIds, (input) => input.ids)
   .handler(async ({ context }) => {
      const result = await fromPromise(
         context.db
            .update(categories)
            .set({ isArchived: true, updatedAt: dayjs().toDate() })
            .where(
               and(
                  inArray(categories.id, context.expandedCategoryIds),
                  eq(categories.teamId, context.teamId),
               ),
            )
            .then(() => undefined),
         () => WebAppError.internal("Falha ao arquivar categorias."),
      );
      if (result.isErr()) throw result.error;
      return { archived: context.ownedCategories.length };
   });
