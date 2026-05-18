import dayjs from "dayjs";
import { Result, type Result as ResultType } from "better-result";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
   categories,
   categorySchema,
   createCategorySchema,
} from "@core/database/schemas/categories";
import {
   DeriveKeywordsJobError,
   enqueueDeriveKeywordsJob,
} from "@modules/classification/jobs/derive-keywords-job";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { protectedProcedure } from "@core/orpc/server";
import {
   ClassificationRouterError,
   classificationRouterErrors,
   requireNoTransactionsForExpandedIds,
   requireOwnedCategoryIds,
   withExpandedCategoryIds,
} from "@modules/classification/router/middlewares";

const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

const importSubcategoryInputSchema = categorySchema
   .pick({ name: true })
   .extend({ keywords: z.array(z.string()).optional() });

type CategoryKeywordsSource = {
   id: string;
   name: string;
   description: string | null;
};

async function enqueueCategoryKeywordsDerivations(
   context: Pick<
      ORPCContextWithOrganization,
      "organizationId" | "teamId" | "userId" | "pgBoss"
   >,
   rows: CategoryKeywordsSource[],
): Promise<ResultType<void, DeriveKeywordsJobError>> {
   const boss = await context.pgBoss;
   const queued = await Promise.all(
      rows.map((row) =>
         enqueueDeriveKeywordsJob({
            boss,
            input: {
               categoryId: row.id,
               teamId: context.teamId,
               organizationId: context.organizationId,
               userId: context.userId,
               name: row.name,
               description: row.description,
            },
         }),
      ),
   );

   for (const result of queued) {
      if (Result.isError(result)) return Result.err(result.error);
   }

   return Result.ok(undefined);
}

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () =>
         context.db.query.categories.findMany({
            where: (f, { eq }) => eq(f.teamId, context.teamId),
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
      catch: () =>
         new ClassificationRouterError({
            error: classificationRouterErrors.INTERNAL(),
            message: "Falha ao exportar categorias.",
         }),
   });
   if (Result.isError(result)) throw result.error;
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

      const result = await Result.tryPromise({
         try: () =>
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
                  if (!parent) return undefined;
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
                     if (!child) return undefined;
                     all.push(child);
                  }
               }
               return { all, parents };
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao importar categorias.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      if (!result.value) {
         throw new ClassificationRouterError({
            error: classificationRouterErrors.INTERNAL(),
            message: "Falha ao importar categorias: insert vazio.",
         });
      }

      const { all, parents } = result.value;
      const queued = await enqueueCategoryKeywordsDerivations(context, parents);
      if (Result.isError(queued)) throw queued.error;
      return all;
   });

export const bulkRemove = protectedProcedure
   .input(idsSchema)
   .use(requireOwnedCategoryIds, (input) => input.ids)
   .use(withExpandedCategoryIds, (input) => input.ids)
   .use(requireNoTransactionsForExpandedIds)
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db
               .delete(categories)
               .where(inArray(categories.id, input.ids))
               .then(() => undefined),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao excluir categorias.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { deleted: input.ids.length };
   });

export const bulkArchive = protectedProcedure
   .input(idsSchema)
   .use(requireOwnedCategoryIds, (input) => input.ids)
   .use(withExpandedCategoryIds, (input) => input.ids)
   .handler(async ({ context }) => {
      const result = await Result.tryPromise({
         try: () =>
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
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao arquivar categorias.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return { archived: context.ownedCategories.length };
   });
