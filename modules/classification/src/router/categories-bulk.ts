import dayjs from "dayjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { errAsync, fromPromise, safeTry } from "neverthrow";
import { z } from "zod";
import {
   categories,
   categorySchema,
   createCategorySchema,
} from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   enqueueKeywords,
   expandWithDescendants,
   insertCategoryRow,
   loadOwnedCategories,
   wrapTx,
} from "@modules/classification/services/categories";

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

      const result = await wrapTx(
         context.db.transaction(async (tx) => {
            const all: CategoryRow[] = [];
            const parents: CategoryRow[] = [];
            for (const item of input.categories) {
               const { subcategories, ...catData } = item;
               const created = await insertCategoryRow(
                  tx,
                  context.teamId,
                  catData,
               );
               parents.push(created);
               all.push(created);
               for (const sub of subcategories ?? []) {
                  const subCreated = await insertCategoryRow(
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
                  all.push(subCreated);
               }
            }
            return { all, parents };
         }),
         "Falha ao importar categorias.",
      );
      if (result.isErr()) throw result.error;

      const { all, parents } = result.value;
      for (const created of parents) {
         await enqueueKeywords(context.workflowClient, created, context);
      }
      return all;
   });

export const bulkRemove = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const flow = await safeTry(async function* () {
         const existing = yield* fromPromise(
            loadOwnedCategories(context.db, context.teamId, input.ids),
            () => WebAppError.internal("Falha ao verificar categorias."),
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

         const allIds = yield* fromPromise(
            expandWithDescendants(context.db, input.ids),
            () => WebAppError.internal("Falha ao verificar descendentes."),
         );

         const txCount = yield* fromPromise(
            context.db
               .select({ count: sql<number>`count(*)::int` })
               .from(transactions)
               .where(inArray(transactions.categoryId, allIds)),
            () => WebAppError.internal("Falha ao verificar lançamentos."),
         );
         if ((txCount[0]?.count ?? 0) > 0)
            yield* errAsync(
               WebAppError.conflict(
                  "Categorias com lançamentos não podem ser excluídas. Use arquivamento.",
               ),
            );

         return fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .delete(categories)
                  .where(inArray(categories.id, input.ids));
            }),
            () => WebAppError.internal("Falha ao excluir categorias."),
         );
      });
      if (flow.isErr()) throw flow.error;
      return { deleted: input.ids.length };
   });

export const bulkArchive = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const flow = await safeTry(async function* () {
         const existing = yield* fromPromise(
            loadOwnedCategories(context.db, context.teamId, input.ids),
            () => WebAppError.internal("Falha ao verificar categorias."),
         );
         if (existing.some((c) => c.isDefault))
            yield* errAsync(
               WebAppError.conflict(
                  "Categorias padrão não podem ser arquivadas.",
               ),
            );

         const allIds = yield* fromPromise(
            expandWithDescendants(context.db, input.ids),
            () => WebAppError.internal("Falha ao verificar descendentes."),
         );

         return fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .update(categories)
                  .set({ isArchived: true, updatedAt: dayjs().toDate() })
                  .where(
                     and(
                        inArray(categories.id, allIds),
                        eq(categories.teamId, context.teamId),
                     ),
                  );
            }),
            () => WebAppError.internal("Falha ao arquivar categorias."),
         );
      });
      if (flow.isErr()) throw flow.error;
      return { archived: input.ids.length };
   });
