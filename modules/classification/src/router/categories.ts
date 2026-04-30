import dayjs from "dayjs";
import { and, asc, eq, ilike, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { errAsync, fromPromise, okAsync } from "neverthrow";
import { z } from "zod";
import {
   categories,
   categorySchema,
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   requireCategory,
   requireEmptyCategoryTree,
   requireKeywordsUnique,
   requireResolvedCategoryParent,
   withCategoryDescendants,
} from "@modules/classification/router/middlewares";
import { enqueueDeriveKeywordsWorkflow } from "@modules/classification/workflows/derive-keywords-workflow";

const idSchema = z.object({ id: z.string().uuid() });
const subcategoryInputSchema = categorySchema.pick({ name: true });

const ensureRow = <T>(row: T | undefined, msg: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(msg));

export const create = protectedProcedure
   .input(
      createCategorySchema.extend({
         subcategories: z.array(subcategoryInputSchema).optional(),
      }),
   )
   .use(requireKeywordsUnique, (input) => ({ keywords: input.keywords }))
   .use(requireResolvedCategoryParent, (input) => ({
      parentId: input.parentId,
      type: input.type,
   }))
   .handler(async ({ context, input }) => {
      const { subcategories, ...data } = input;
      const { resolvedParent } = context;

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [parent] = await tx
               .insert(categories)
               .values({
                  ...data,
                  teamId: context.teamId,
                  level: resolvedParent.level,
                  type: resolvedParent.type,
               })
               .returning();
            if (!parent) return undefined;
            for (const sub of subcategories ?? []) {
               await tx.insert(categories).values({
                  name: sub.name,
                  type: parent.type,
                  parentId: parent.id,
                  level: parent.level + 1,
                  teamId: context.teamId,
                  participatesDre: false,
               });
            }
            return parent;
         }),
         () => WebAppError.internal("Falha ao criar categoria."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao criar categoria: insert vazio."),
      );
      if (result.isErr()) throw result.error;

      await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
         categoryId: result.value.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         name: result.value.name,
         description: result.value.description,
      });
      return result.value;
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
         context.db.query.categories.findMany({
            where: (f, { and, eq }) => {
               const conds = [eq(f.teamId, context.teamId)];
               if (input?.type) conds.push(eq(f.type, input.type));
               if (!input?.includeArchived) conds.push(eq(f.isArchived, false));
               return and(...conds);
            },
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
         () => WebAppError.internal("Falha ao listar categorias."),
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
      const result = await fromPromise(
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
         () => WebAppError.internal("Falha ao listar categorias."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateCategorySchema))
   .use(requireCategory, (input) => input.id)
   .use(requireKeywordsUnique, (input) => ({
      keywords: input.keywords,
      excludeId: input.id,
   }))
   .handler(async ({ context, input }) => {
      if (context.category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser editadas.",
         );

      const { id, ...data } = input;
      const result = await fromPromise(
         context.db
            .update(categories)
            .set({ ...data, updatedAt: dayjs().toDate() })
            .where(eq(categories.id, id))
            .returning()
            .then((rows) => rows[0]),
         () => WebAppError.internal("Falha ao atualizar categoria."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao atualizar categoria: update vazio."),
      );
      if (result.isErr()) throw result.error;

      if (data.keywords === undefined) {
         await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
            categoryId: result.value.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            userId: context.userId,
            name: result.value.name,
            description: result.value.description,
         });
      }
      return result.value;
   });

export const regenerateKeywords = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context }) => {
      await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
         categoryId: context.category.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         name: context.category.name,
         description: context.category.description,
      });
      return { success: true };
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .use(requireEmptyCategoryTree, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (context.category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser excluídas.",
         );

      const result = await fromPromise(
         context.db
            .delete(categories)
            .where(eq(categories.id, input.id))
            .then(() => undefined),
         () => WebAppError.internal("Falha ao excluir categoria."),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });

export const archive = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .use(withCategoryDescendants, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (context.category.isDefault)
         throw WebAppError.conflict(
            "Categorias padrão não podem ser arquivadas.",
         );

      const allIds = [input.id, ...context.descendantCategoryIds];
      const result = await fromPromise(
         (async () => {
            await context.db
               .update(categories)
               .set({ isArchived: true, updatedAt: dayjs().toDate() })
               .where(inArray(categories.id, allIds));
            return context.db.query.categories.findFirst({
               where: (f, { eq }) => eq(f.id, input.id),
            });
         })(),
         () => WebAppError.internal("Falha ao arquivar categoria."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao arquivar categoria: update vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const unarchive = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .update(categories)
            .set({ isArchived: false, updatedAt: dayjs().toDate() })
            .where(eq(categories.id, input.id))
            .returning()
            .then((rows) => rows[0]),
         () => WebAppError.internal("Falha ao reativar categoria."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao reativar categoria: update vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });
