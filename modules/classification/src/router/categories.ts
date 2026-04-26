import dayjs from "dayjs";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   createCategorySchema,
   updateCategorySchema,
} from "../contracts/categories";
import { enqueueDeriveKeywordsWorkflow } from "../workflows/derive-keywords-workflow";
import { requireCategory } from "./middlewares";

const idSchema = z.object({ id: z.string().uuid() });

type DbOrTx =
   | DatabaseInstance
   | Parameters<Parameters<DatabaseInstance["transaction"]>[0]>[0];

async function getDescendantIds(
   db: DbOrTx,
   categoryId: string,
): Promise<string[]> {
   const level2 = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, categoryId));
   const level2Ids = level2.map((r) => r.id);
   if (level2Ids.length === 0) return [];
   const level3 = await db
      .select({ id: categories.id })
      .from(categories)
      .where(inArray(categories.parentId, level2Ids));
   return [...level2Ids, ...level3.map((r) => r.id)];
}

async function categoryTreeHasTransactions(
   db: DbOrTx,
   categoryId: string,
): Promise<boolean> {
   const descendantIds = await getDescendantIds(db, categoryId);
   const allIds = [categoryId, ...descendantIds];
   const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .where(inArray(transactions.categoryId, allIds));
   return (row?.count ?? 0) > 0;
}

async function validateKeywordsUniqueness(
   db: DbOrTx,
   teamId: string,
   keywords: string[],
   excludeCategoryId?: string,
): Promise<void> {
   const conditions: SQL[] = [
      eq(categories.teamId, teamId),
      eq(categories.isArchived, false),
      sql`${categories.keywords} && ARRAY[${sql.join(
         keywords.map((k) => sql`${k}`),
         sql`,`,
      )}]::text[]`,
   ];
   if (excludeCategoryId) {
      conditions.push(sql`${categories.id} != ${excludeCategoryId}`);
   }
   const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(categories)
      .where(and(...conditions));
   if ((row?.count ?? 0) > 0) {
      throw WebAppError.conflict(
         "Palavras-chave já utilizadas em outra categoria ativa.",
      );
   }
}

async function insertCategoryRow(
   db: DbOrTx,
   teamId: string,
   data: z.infer<typeof createCategorySchema>,
) {
   let level = 1;
   let type = data.type;
   if (data.parentId) {
      const parent = await db.query.categories.findFirst({
         where: (f, { eq }) => eq(f.id, data.parentId!),
      });
      if (!parent) throw WebAppError.notFound("Categoria pai não encontrada.");
      if (parent.level >= 3)
         throw WebAppError.badRequest("Limite de 3 níveis atingido.");
      level = parent.level + 1;
      type = parent.type;
   }
   if (data.keywords?.length) {
      await validateKeywordsUniqueness(db, teamId, data.keywords);
   }
   const [row] = await db
      .insert(categories)
      .values({ ...data, teamId, level, type })
      .returning();
   if (!row) throw WebAppError.internal("Falha ao criar categoria.");
   return row;
}

const subcategoryInputSchema = z.object({
   name: z.string().min(1).max(100),
});

const importSubcategoryInputSchema = z.object({
   name: z.string().min(1).max(100),
   keywords: z.array(z.string()).optional(),
});

export const create = protectedProcedure
   .input(
      createCategorySchema.extend({
         subcategories: z.array(subcategoryInputSchema).optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { subcategories, ...catData } = input;

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const created = await insertCategoryRow(
               tx,
               context.teamId,
               catData,
            );
            if (subcategories && subcategories.length > 0) {
               for (const sub of subcategories) {
                  await insertCategoryRow(tx, context.teamId, {
                     name: sub.name,
                     type: catData.type,
                     parentId: created.id,
                     participatesDre: false,
                  });
               }
            }
            return created;
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao criar categoria.", {
                    cause: e,
                 }),
      );
      if (result.isErr()) throw result.error;
      const category = result.value;

      await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
         categoryId: category.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         name: category.name,
         description: category.description,
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
      const result = await fromPromise(
         (async () => {
            const conditions: SQL[] = [eq(categories.teamId, context.teamId)];
            if (input?.type) conditions.push(eq(categories.type, input.type));
            if (!input?.includeArchived)
               conditions.push(eq(categories.isArchived, false));
            return context.db.query.categories.findMany({
               where: and(...conditions),
               orderBy: (f, { asc }) => [asc(f.name)],
            });
         })(),
         () => WebAppError.internal("Falha ao listar categorias."),
      );
      if (result.isErr()) throw result.error;
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

const getPaginatedInput = z.object({
   type: z.enum(["income", "expense"]).optional(),
   includeArchived: z.boolean().optional(),
   search: z.string().optional(),
   page: z.number().int().min(1).default(1),
   pageSize: z.number().int().min(1).max(100).default(20),
});

export const getPaginated = protectedProcedure
   .input(getPaginatedInput)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         (async () => {
            const parentCat = alias(categories, "parent_cat");
            const base: SQL[] = [eq(categories.teamId, context.teamId)];
            if (input.type) base.push(eq(categories.type, input.type));
            if (!input.includeArchived)
               base.push(eq(categories.isArchived, false));

            const trimmedSearch = input.search?.trim();
            const searchPattern = trimmedSearch
               ? `%${trimmedSearch.replace(/[\\%_]/g, "\\$&")}%`
               : null;

            if (searchPattern) {
               const matched = await context.db
                  .selectDistinct({
                     rootId: sql<string>`COALESCE(${categories.parentId}, ${categories.id})`,
                  })
                  .from(categories)
                  .where(and(...base, ilike(categories.name, searchPattern)));
               const rootIds = matched.map((r) => r.rootId);
               if (rootIds.length === 0) {
                  return {
                     data: [] as (typeof categories.$inferSelect)[],
                     total: 0,
                  };
               }
               base.push(
                  sql`COALESCE(${categories.parentId}, ${categories.id}) IN ${rootIds}`,
               );
            }

            const countRows = await context.db
               .select({ count: sql<number>`count(*)::int` })
               .from(categories)
               .where(and(...base));
            const total = countRows[0]?.count ?? 0;

            const sortKey = sql`COALESCE(${parentCat.name}, ${categories.name})`;
            const depthKey = sql`CASE WHEN ${categories.parentId} IS NULL THEN 0 ELSE 1 END`;
            const offset = Math.max(0, (input.page - 1) * input.pageSize);
            const rows = await context.db
               .select({ c: categories })
               .from(categories)
               .leftJoin(parentCat, eq(parentCat.id, categories.parentId))
               .where(and(...base))
               .orderBy(asc(sortKey), asc(depthKey), asc(categories.name))
               .limit(input.pageSize)
               .offset(offset);

            return { data: rows.map((r) => r.c), total };
         })(),
         () => WebAppError.internal("Falha ao listar categorias."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateCategorySchema))
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const { category } = context;
      if (category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser editadas.",
         );

      if (data.keywords?.length) {
         const check = await fromPromise(
            validateKeywordsUniqueness(
               context.db,
               context.teamId,
               data.keywords,
               id,
            ),
            (e) =>
               e instanceof WebAppError
                  ? e
                  : WebAppError.internal("Falha ao validar palavras-chave.", {
                       cause: e,
                    }),
         );
         if (check.isErr()) throw check.error;
      }

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(categories)
               .set({ ...data, updatedAt: dayjs().toDate() })
               .where(eq(categories.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar categoria."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar categoria: update vazio.",
         );

      const updated = result.value;

      const keywordsProvided = data.keywords !== undefined;
      if (!keywordsProvided) {
         await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
            categoryId: updated.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            userId: context.userId,
            name: updated.name,
            description: updated.description,
         });
      }

      return updated;
   });

export const regenerateKeywords = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context }) => {
      const { category } = context;
      await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
         categoryId: category.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         name: category.name,
         description: category.description,
      });
      return { success: true };
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { category } = context;
      if (category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser excluídas.",
         );

      const hasTxResult = await fromPromise(
         categoryTreeHasTransactions(context.db, input.id),
         () => WebAppError.internal("Falha ao verificar lançamentos."),
      );
      if (hasTxResult.isErr()) throw hasTxResult.error;
      if (hasTxResult.value)
         throw WebAppError.conflict(
            "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
         );

      const deleteResult = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(categories).where(eq(categories.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir categoria."),
      );
      if (deleteResult.isErr()) throw deleteResult.error;
      return { success: true };
   });

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
               const { subcategories, ...catData } = item;
               const created = await insertCategoryRow(
                  tx,
                  context.teamId,
                  catData,
               );
               parents.push(created);
               all.push(created);
               if (subcategories && subcategories.length > 0) {
                  for (const sub of subcategories) {
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
            }
            return { all, parents };
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao importar categorias.", {
                    cause: e,
                 }),
      );
      if (result.isErr()) throw result.error;

      const { all, parents } = result.value;
      for (const created of parents) {
         await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
            categoryId: created.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            userId: context.userId,
            name: created.name,
            description: created.description,
         });
      }
      return all;
   });

export const archive = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { category } = context;
      if (category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser arquivadas.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const descendantIds = await getDescendantIds(tx, input.id);
            const allIds = [input.id, ...descendantIds];
            await tx
               .update(categories)
               .set({ isArchived: true, updatedAt: dayjs().toDate() })
               .where(inArray(categories.id, allIds));
            return tx.query.categories.findFirst({
               where: (f, { eq }) => eq(f.id, input.id),
            });
         }),
         () => WebAppError.internal("Falha ao arquivar categoria."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao arquivar categoria: update vazio.",
         );
      return result.value;
   });

export const unarchive = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(categories)
               .set({ isArchived: false, updatedAt: dayjs().toDate() })
               .where(eq(categories.id, input.id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao reativar categoria."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao reativar categoria: update vazio.",
         );
      return result.value;
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const existing = await fromPromise(
         context.db.query.categories.findMany({
            where: (f, { and, inArray, eq }) =>
               and(inArray(f.id, input.ids), eq(f.teamId, context.teamId)),
         }),
         () => WebAppError.internal("Falha ao verificar categorias."),
      );
      if (existing.isErr()) throw existing.error;
      if (existing.value.length !== input.ids.length)
         throw WebAppError.notFound(
            "Uma ou mais categorias não foram encontradas.",
         );
      if (existing.value.some((c) => c.isDefault))
         throw WebAppError.conflict(
            "Categorias padrão não podem ser excluídas.",
         );

      const allDescendantIdsResult = await fromPromise(
         (async () =>
            (
               await Promise.all(
                  input.ids.map((id) => getDescendantIds(context.db, id)),
               )
            ).flat())(),
         () => WebAppError.internal("Falha ao verificar descendentes."),
      );
      if (allDescendantIdsResult.isErr()) throw allDescendantIdsResult.error;
      const allIds = [
         ...new Set([...input.ids, ...allDescendantIdsResult.value]),
      ];

      const txCheck = await fromPromise(
         context.db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(inArray(transactions.categoryId, allIds)),
         () => WebAppError.internal("Falha ao verificar lançamentos."),
      );
      if (txCheck.isErr()) throw txCheck.error;
      if ((txCheck.value[0]?.count ?? 0) > 0)
         throw WebAppError.conflict(
            "Categorias com lançamentos não podem ser excluídas. Use arquivamento.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(categories)
               .where(inArray(categories.id, input.ids));
         }),
         () => WebAppError.internal("Falha ao excluir categorias."),
      );
      if (result.isErr()) throw result.error;
      return { deleted: input.ids.length };
   });

export const bulkArchive = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const existing = await fromPromise(
         context.db.query.categories.findMany({
            where: (f, { and, inArray, eq }) =>
               and(inArray(f.id, input.ids), eq(f.teamId, context.teamId)),
         }),
         () => WebAppError.internal("Falha ao verificar categorias."),
      );
      if (existing.isErr()) throw existing.error;
      if (existing.value.some((c) => c.isDefault))
         throw WebAppError.conflict(
            "Categorias padrão não podem ser arquivadas.",
         );

      const allDescendantIdsResult = await fromPromise(
         (async () =>
            (
               await Promise.all(
                  input.ids.map((id) => getDescendantIds(context.db, id)),
               )
            ).flat())(),
         () => WebAppError.internal("Falha ao verificar descendentes."),
      );
      if (allDescendantIdsResult.isErr()) throw allDescendantIdsResult.error;
      const allIds = [
         ...new Set([...input.ids, ...allDescendantIdsResult.value]),
      ];

      const result = await fromPromise(
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
      if (result.isErr()) throw result.error;
      return { archived: input.ids.length };
   });
