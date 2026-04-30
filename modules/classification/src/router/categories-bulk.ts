import dayjs from "dayjs";
import { and, eq, inArray } from "drizzle-orm";
import { errAsync, okAsync, safeTry } from "neverthrow";
import { z } from "zod";
import {
   categories,
   categorySchema,
   createCategorySchema,
} from "@core/database/schemas/categories";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   anyTransactionsForCategoryIds,
   createCategory,
   enqueueKeywords,
   expandWithDescendants,
   loadCategoriesByIds,
   tryDb,
} from "@modules/classification/services/categories";

const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

const importSubcategoryInputSchema = categorySchema
   .pick({ name: true })
   .extend({ keywords: z.array(z.string()).optional() });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const result = await tryDb(
      context.db.query.categories.findMany({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
         orderBy: (f, { asc }) => [asc(f.name)],
      }),
      "Falha ao exportar categorias.",
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

      const flow = await safeTry(async function* () {
         const all: CategoryRow[] = [];
         const parents: CategoryRow[] = [];
         for (const item of input.categories) {
            const { subcategories, ...catData } = item;
            const created = yield* createCategory(
               context.db,
               context.teamId,
               catData,
            );
            parents.push(created);
            all.push(created);
            for (const sub of subcategories ?? []) {
               const subCreated = yield* createCategory(
                  context.db,
                  context.teamId,
                  {
                     name: sub.name,
                     type: catData.type,
                     parentId: created.id,
                     participatesDre: false,
                     keywords: sub.keywords ?? null,
                  },
               );
               all.push(subCreated);
            }
         }
         return okAsync({ all, parents });
      });
      if (flow.isErr()) throw flow.error;

      const { all, parents } = flow.value;
      await Promise.all(
         parents.map((p) =>
            enqueueKeywords(context.workflowClient, p, context),
         ),
      );
      return all;
   });

export const bulkRemove = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const flow = await safeTry(async function* () {
         const existing = yield* loadCategoriesByIds(
            context.db,
            context.teamId,
            input.ids,
         );
         if (existing.length !== input.ids.length)
            yield* errAsync(
               WebAppError.notFound(
                  "Uma ou mais categorias não foram encontradas.",
               ),
            );
         if (existing.some((c) => c.isDefault))
            yield* errAsync(
               WebAppError.conflict(
                  "Categorias padrão não podem ser excluídas.",
               ),
            );

         const allIds = yield* expandWithDescendants(context.db, input.ids);
         const hasTx = yield* anyTransactionsForCategoryIds(context.db, allIds);
         if (hasTx)
            yield* errAsync(
               WebAppError.conflict(
                  "Categorias com lançamentos não podem ser excluídas. Use arquivamento.",
               ),
            );

         return tryDb(
            context.db
               .delete(categories)
               .where(inArray(categories.id, input.ids))
               .then(() => undefined),
            "Falha ao excluir categorias.",
         );
      });
      if (flow.isErr()) throw flow.error;
      return { deleted: input.ids.length };
   });

export const bulkArchive = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const flow = await safeTry(async function* () {
         const existing = yield* loadCategoriesByIds(
            context.db,
            context.teamId,
            input.ids,
         );
         if (existing.some((c) => c.isDefault))
            yield* errAsync(
               WebAppError.conflict(
                  "Categorias padrão não podem ser arquivadas.",
               ),
            );

         const allIds = yield* expandWithDescendants(context.db, input.ids);
         return tryDb(
            context.db
               .update(categories)
               .set({ isArchived: true, updatedAt: dayjs().toDate() })
               .where(
                  and(
                     inArray(categories.id, allIds),
                     eq(categories.teamId, context.teamId),
                  ),
               )
               .then(() => undefined),
            "Falha ao arquivar categorias.",
         );
      });
      if (flow.isErr()) throw flow.error;
      return { archived: input.ids.length };
   });
