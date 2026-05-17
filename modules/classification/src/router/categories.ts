import dayjs from "dayjs";
import { and, asc, desc, eq, ilike, inArray, isNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { errAsync, fromPromise, okAsync } from "neverthrow";
import { z } from "zod";
import {
   categories,
   type CategoryType,
   categorySchema,
   createCategorySchema,
   updateCategorySchema,
} from "@core/database/schemas/categories";
import { WebAppError } from "@core/logging/errors";
import type { ORPCContextWithOrganization } from "@core/orpc/context";
import { protectedProcedure } from "@core/orpc/server";
import {
   requireCategory,
   requireEmptyCategoryTree,
   requireKeywordsUnique,
   requireResolvedCategoryUpdateParent,
   requireResolvedCategoryParent,
   withCategoryDescendants,
} from "@modules/classification/router/middlewares";
import { enqueueCategoryKeywordsDerivation } from "@modules/classification/router/enqueue-keywords";

const idSchema = z.object({ id: z.string().uuid() });
const subcategoryInputSchema = categorySchema.pick({ name: true });
type CategoryUniqueCandidate = {
   parentId: string | null;
   type: CategoryType;
   name: string;
   excludeIds: string[];
};

const ensureRow = <T>(row: T | undefined, msg: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(msg));

async function checkCategoryUniqueConflict(
   db: ORPCContextWithOrganization["db"],
   candidate: CategoryUniqueCandidate,
   teamId: string,
) {
   const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
         and(
            eq(categories.teamId, teamId),
            sql`${categories.parentId} IS NOT DISTINCT FROM ${candidate.parentId}`,
            eq(categories.type, candidate.type),
            eq(categories.name, candidate.name),
            sql`${categories.id} NOT IN (${sql.join(
               candidate.excludeIds.map((excludeId) => sql`${excludeId}`),
               sql`,`,
            )})`,
         ),
      )
      .limit(1);
   return row !== undefined;
}

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
                  icon: data.parentId ? null : data.icon,
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

      await enqueueCategoryKeywordsDerivation(context, result.value);
      return result.value;
   });

const getAllInput = z
   .object({
      type: z.enum(["income", "expense", "transfer"]).optional(),
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
   type: z.enum(["income", "expense", "transfer"]).optional(),
   includeArchived: z.boolean().optional(),
   search: z.string().optional(),
   page: z.number().int().min(1).default(1),
   pageSize: z.number().int().min(1).max(100).default(20),
   sorting: z
      .array(
         z.object({
            id: z.enum(["isDefault", "name", "type"]),
            desc: z.boolean(),
         }),
      )
      .max(3, "Use no máximo 3 critérios de ordenação.")
      .optional(),
});

function buildCategoryOrderBy(
   sorting: z.infer<typeof getPaginatedInput>["sorting"],
) {
   if (!sorting?.length)
      return [asc(categories.name), desc(categories.createdAt)];
   const orderBy: SQL[] = [];

   for (const sort of sorting) {
      const direction = sort.desc ? desc : asc;

      switch (sort.id) {
         case "isDefault":
            orderBy.push(direction(categories.isDefault));
            break;
         case "name":
            orderBy.push(direction(categories.name));
            break;
         case "type":
            orderBy.push(direction(categories.type));
            break;
      }
   }

   return [...orderBy, asc(categories.name), desc(categories.createdAt)];
}

export const getPaginated = protectedProcedure
   .input(getPaginatedInput)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         (async () => {
            const rootFilter: SQL[] = [
               eq(categories.teamId, context.teamId),
               isNull(categories.parentId),
            ];
            if (input.type) rootFilter.push(eq(categories.type, input.type));
            if (!input.includeArchived)
               rootFilter.push(eq(categories.isArchived, false));

            const trimmed = input.search?.trim();
            const pattern = trimmed
               ? `%${trimmed.replace(/[\\%_]/g, "\\$&")}%`
               : null;

            if (pattern) {
               const searchFilter: SQL[] = [
                  eq(categories.teamId, context.teamId),
                  ilike(categories.name, pattern),
               ];
               if (input.type)
                  searchFilter.push(eq(categories.type, input.type));
               if (!input.includeArchived)
                  searchFilter.push(eq(categories.isArchived, false));

               const countRows = await context.db
                  .select({ count: sql<number>`count(*)::int` })
                  .from(categories)
                  .where(and(...searchFilter));
               const total = countRows[0]?.count ?? 0;
               if (total === 0) return { data: [], total: 0 };

               const offset = Math.max(0, (input.page - 1) * input.pageSize);
               const data = await context.db
                  .select()
                  .from(categories)
                  .where(and(...searchFilter))
                  .orderBy(...buildCategoryOrderBy(input.sorting))
                  .limit(input.pageSize)
                  .offset(offset);

               return { data, total };
            }

            const countRows = await context.db
               .select({ count: sql<number>`count(*)::int` })
               .from(categories)
               .where(and(...rootFilter));
            const total = countRows[0]?.count ?? 0;
            if (total === 0) return { data: [], total: 0 };

            const offset = Math.max(0, (input.page - 1) * input.pageSize);
            const rootRows = await context.db
               .select()
               .from(categories)
               .where(and(...rootFilter))
               .orderBy(...buildCategoryOrderBy(input.sorting))
               .limit(input.pageSize)
               .offset(offset);

            const rootIds = rootRows.map((r) => r.id);
            const childRows = rootIds.length
               ? await context.db
                    .select()
                    .from(categories)
                    .where(
                       and(
                          eq(categories.teamId, context.teamId),
                          inArray(categories.parentId, rootIds),
                          input.includeArchived
                             ? undefined
                             : eq(categories.isArchived, false),
                       ),
                    )
                    .orderBy(asc(categories.name))
               : [];

            return { data: [...rootRows, ...childRows], total };
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
   .use(requireResolvedCategoryUpdateParent, (input) => ({
      parentId: input.parentId,
   }))
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const { resolvedParent } = context;
      const nextParentId = resolvedParent.updateParent
         ? (data.parentId ?? null)
         : context.category.parentId;

      const conflictResult = await fromPromise(
         (async () => {
            const excludeIds = [id, ...resolvedParent.descendantCategoryIds];
            const candidates: CategoryUniqueCandidate[] = [
               {
                  parentId: resolvedParent.updateParent
                     ? (data.parentId ?? null)
                     : context.category.parentId,
                  type: resolvedParent.updateParent
                     ? resolvedParent.type
                     : context.category.type,
                  name: data.name ?? context.category.name,
                  excludeIds,
               },
            ];

            if (
               resolvedParent.updateParent &&
               resolvedParent.type !== context.category.type &&
               resolvedParent.descendantCategoryIds.length > 0
            ) {
               const descendantRows = await context.db
                  .select({
                     id: categories.id,
                     parentId: categories.parentId,
                     name: categories.name,
                  })
                  .from(categories)
                  .where(
                     inArray(
                        categories.id,
                        resolvedParent.descendantCategoryIds,
                     ),
                  );

               for (const descendant of descendantRows) {
                  candidates.push({
                     parentId: descendant.parentId,
                     type: resolvedParent.type,
                     name: descendant.name,
                     excludeIds,
                  });
               }
            }

            for (const candidate of candidates) {
               if (
                  await checkCategoryUniqueConflict(
                     context.db,
                     candidate,
                     context.teamId,
                  )
               ) {
                  return true;
               }
            }

            return false;
         })(),
         () => WebAppError.internal("Falha ao validar categoria duplicada."),
      );
      if (conflictResult.isErr()) throw conflictResult.error;
      if (conflictResult.value)
         throw WebAppError.conflict("Categoria já existe nesse nível.");

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const levelOffset = resolvedParent.updateParent
               ? resolvedParent.level - context.category.level
               : 0;
            const [row] = await tx
               .update(categories)
               .set({
                  ...data,
                  icon: nextParentId ? null : data.icon,
                  ...(resolvedParent.updateParent
                     ? {
                          level: resolvedParent.level,
                          type: resolvedParent.type,
                       }
                     : {}),
                  updatedAt: dayjs().toDate(),
               })
               .where(eq(categories.id, id))
               .returning();

            if (
               row &&
               resolvedParent.updateParent &&
               resolvedParent.descendantCategoryIds.length > 0
            ) {
               await tx
                  .update(categories)
                  .set({
                     level: sql`${categories.level} + ${levelOffset}`,
                     type: resolvedParent.type,
                     updatedAt: dayjs().toDate(),
                  })
                  .where(
                     inArray(
                        categories.id,
                        resolvedParent.descendantCategoryIds,
                     ),
                  );
            }

            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar categoria."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao atualizar categoria: update vazio."),
      );
      if (result.isErr()) throw result.error;

      if (data.keywords === undefined) {
         await enqueueCategoryKeywordsDerivation(context, result.value);
      }
      return result.value;
   });

export const regenerateKeywords = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .handler(async ({ context }) => {
      await enqueueCategoryKeywordsDerivation(context, context.category);
      return { success: true };
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireCategory, (input) => input.id)
   .use(requireEmptyCategoryTree, (input) => input.id)
   .handler(async ({ context, input }) => {
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
