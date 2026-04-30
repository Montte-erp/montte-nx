import dayjs from "dayjs";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { errAsync, okAsync, safeTry } from "neverthrow";
import { z } from "zod";
import {
   categories,
   categorySchema,
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireCategory } from "@modules/classification/router/middlewares";
import {
   assertKeywordsUnique,
   categoryTreeHasTransactions,
   createCategory,
   ensureRow,
   enqueueKeywords,
   getDescendantIds,
   tryDb,
} from "@modules/classification/services/categories";

const idSchema = z.object({ id: z.string().uuid() });
const subcategoryInputSchema = categorySchema.pick({ name: true });

export const create = protectedProcedure
   .input(
      createCategorySchema.extend({
         subcategories: z.array(subcategoryInputSchema).optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      const { subcategories, ...catData } = input;
      const flow = await safeTry(async function* () {
         const created = yield* createCategory(
            context.db,
            context.teamId,
            catData,
         );
         for (const sub of subcategories ?? []) {
            yield* createCategory(context.db, context.teamId, {
               name: sub.name,
               type: catData.type,
               parentId: created.id,
               participatesDre: false,
            });
         }
         return okAsync(created);
      });
      if (flow.isErr()) throw flow.error;
      await enqueueKeywords(context.workflowClient, flow.value, context);
      return flow.value;
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
      const result = await tryDb(
         context.db.query.categories.findMany({
            where: (f, { and, eq }) => {
               const conds = [eq(f.teamId, context.teamId)];
               if (input?.type) conds.push(eq(f.type, input.type));
               if (!input?.includeArchived) conds.push(eq(f.isArchived, false));
               return and(...conds);
            },
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
         "Falha ao listar categorias.",
      );
      if (result.isErr()) throw result.error;
      const all = result.value;
      const search = input?.search?.toLowerCase();
      if (!search) return all;
      const matchedRoots = new Set<string>();
      for (const c of all) {
         if (c.name.toLowerCase().includes(search))
            matchedRoots.add(c.parentId ?? c.id);
      }
      return all.filter((c) => matchedRoots.has(c.parentId ?? c.id));
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
      const result = await tryDb(
         (async () => {
            const parentCat = alias(categories, "parent_cat");
            const base: SQL[] = [eq(categories.teamId, context.teamId)];
            if (input.type) base.push(eq(categories.type, input.type));
            if (!input.includeArchived)
               base.push(eq(categories.isArchived, false));

            const trimmed = input.search?.trim();
            const pattern = trimmed
               ? `%${trimmed.replace(/[\\%_]/g, "\\$&")}%`
               : null;

            if (pattern) {
               const matched = await context.db
                  .selectDistinct({
                     rootId: sql<string>`COALESCE(${categories.parentId}, ${categories.id})`,
                  })
                  .from(categories)
                  .where(and(...base, ilike(categories.name, pattern)));
               const rootIds = matched.map((r) => r.rootId);
               if (rootIds.length === 0) return { data: [], total: 0 };
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
         "Falha ao listar categorias.",
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateCategorySchema))
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (context.category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser editadas.",
         );

      const flow = await safeTry(async function* () {
         if (data.keywords?.length) {
            yield* assertKeywordsUnique(
               context.db,
               context.teamId,
               data.keywords,
               id,
            );
         }
         const updated = yield* tryDb(
            context.db
               .update(categories)
               .set({ ...data, updatedAt: dayjs().toDate() })
               .where(eq(categories.id, id))
               .returning()
               .then((rows) => rows[0]),
            "Falha ao atualizar categoria.",
         );
         return ensureRow(
            updated,
            "Falha ao atualizar categoria: update vazio.",
         );
      });
      if (flow.isErr()) throw flow.error;
      const updated = flow.value;

      if (data.keywords === undefined) {
         await enqueueKeywords(context.workflowClient, updated, context);
      }
      return updated;
   });

export const regenerateKeywords = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context }) => {
      await enqueueKeywords(context.workflowClient, context.category, context);
      return { success: true };
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (context.category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser excluídas.",
         );

      const flow = await safeTry(async function* () {
         const hasTx = yield* categoryTreeHasTransactions(context.db, input.id);
         if (hasTx)
            yield* errAsync(
               WebAppError.conflict(
                  "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
               ),
            );
         return tryDb(
            context.db
               .delete(categories)
               .where(eq(categories.id, input.id))
               .then(() => undefined),
            "Falha ao excluir categoria.",
         );
      });
      if (flow.isErr()) throw flow.error;
      return { success: true };
   });

export const archive = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (context.category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser arquivadas.",
         );

      const flow = await safeTry(async function* () {
         const descendants = yield* getDescendantIds(context.db, input.id);
         const allIds = [input.id, ...descendants];
         yield* tryDb(
            context.db
               .update(categories)
               .set({ isArchived: true, updatedAt: dayjs().toDate() })
               .where(inArray(categories.id, allIds))
               .then(() => undefined),
            "Falha ao arquivar categoria.",
         );
         const row = yield* tryDb(
            context.db.query.categories.findFirst({
               where: (f, { eq }) => eq(f.id, input.id),
            }),
            "Falha ao arquivar categoria.",
         );
         return ensureRow(row, "Falha ao arquivar categoria: update vazio.");
      });
      if (flow.isErr()) throw flow.error;
      return flow.value;
   });

export const unarchive = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await tryDb(
         context.db
            .update(categories)
            .set({ isArchived: false, updatedAt: dayjs().toDate() })
            .where(eq(categories.id, input.id))
            .returning()
            .then((rows) => rows[0]),
         "Falha ao reativar categoria.",
      ).andThen((row) =>
         ensureRow(row, "Falha ao reativar categoria: update vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });
