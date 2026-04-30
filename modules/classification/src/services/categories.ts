import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { and, eq, inArray, sql } from "drizzle-orm";
import { errAsync, fromPromise, okAsync, ResultAsync } from "neverthrow";
import type { z } from "zod";
import type { DatabaseInstance } from "@core/database/client";
import {
   categories,
   type createCategorySchema,
} from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import { WebAppError } from "@core/logging/errors";
import { enqueueDeriveKeywordsWorkflow } from "@modules/classification/workflows/derive-keywords-workflow";

export type DbOrTx =
   | DatabaseInstance
   | Parameters<Parameters<DatabaseInstance["transaction"]>[0]>[0];

type CreateInput = z.infer<typeof createCategorySchema>;

type CategoryRow = typeof categories.$inferSelect;

export const ensureRow = <T>(row: T | undefined, msg: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(msg));

const dbErr = (msg: string) => () => WebAppError.internal(msg);

export const tryDb = <T>(
   promise: Promise<T>,
   msg: string,
): ResultAsync<T, WebAppError> => fromPromise(promise, dbErr(msg));

export function loadCategoriesByIds(
   db: DatabaseInstance,
   teamId: string,
   ids: string[],
) {
   return tryDb(
      db.query.categories.findMany({
         where: (f, { and, inArray, eq }) =>
            and(inArray(f.id, ids), eq(f.teamId, teamId)),
      }),
      "Falha ao verificar categorias.",
   );
}

function fetchDescendantIds(db: DbOrTx, categoryId: string) {
   return tryDb(
      (async () => {
         const level2 = await db
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.parentId, categoryId));
         if (level2.length === 0) return [];
         const level2Ids = level2.map((r) => r.id);
         const level3 = await db
            .select({ id: categories.id })
            .from(categories)
            .where(inArray(categories.parentId, level2Ids));
         return [...level2Ids, ...level3.map((r) => r.id)];
      })(),
      "Falha ao verificar descendentes.",
   );
}

export const getDescendantIds = fetchDescendantIds;

export function expandWithDescendants(
   db: DatabaseInstance,
   ids: string[],
): ResultAsync<string[], WebAppError> {
   return ResultAsync.combine(ids.map((id) => fetchDescendantIds(db, id))).map(
      (lists) => [...new Set([...ids, ...lists.flat()])],
   );
}

export function categoryTreeHasTransactions(
   db: DbOrTx,
   categoryId: string,
): ResultAsync<boolean, WebAppError> {
   return fetchDescendantIds(db, categoryId).andThen((descendants) =>
      tryDb(
         db
            .select({ count: sql<number>`count(*)::int` })
            .from(transactions)
            .where(
               inArray(transactions.categoryId, [categoryId, ...descendants]),
            )
            .then((rows) => (rows[0]?.count ?? 0) > 0),
         "Falha ao verificar lançamentos.",
      ),
   );
}

export function anyTransactionsForCategoryIds(
   db: DatabaseInstance,
   ids: string[],
): ResultAsync<boolean, WebAppError> {
   return tryDb(
      db
         .select({ count: sql<number>`count(*)::int` })
         .from(transactions)
         .where(inArray(transactions.categoryId, ids))
         .then((rows) => (rows[0]?.count ?? 0) > 0),
      "Falha ao verificar lançamentos.",
   );
}

export function assertKeywordsUnique(
   db: DbOrTx,
   teamId: string,
   keywords: string[],
   excludeCategoryId?: string,
): ResultAsync<void, WebAppError> {
   const conds = [
      eq(categories.teamId, teamId),
      eq(categories.isArchived, false),
      sql`${categories.keywords} && ARRAY[${sql.join(
         keywords.map((k) => sql`${k}`),
         sql`,`,
      )}]::text[]`,
   ];
   if (excludeCategoryId)
      conds.push(sql`${categories.id} != ${excludeCategoryId}`);
   return tryDb(
      db
         .select({ count: sql<number>`count(*)::int` })
         .from(categories)
         .where(and(...conds))
         .then((rows) => rows[0]?.count ?? 0),
      "Falha ao validar palavras-chave.",
   ).andThen((count) =>
      count > 0
         ? errAsync(
              WebAppError.conflict(
                 "Palavras-chave já utilizadas em outra categoria ativa.",
              ),
           )
         : okAsync(undefined),
   );
}

type Resolved = { level: number; type: CreateInput["type"] };

export function resolveParent(
   db: DbOrTx,
   data: CreateInput,
): ResultAsync<Resolved, WebAppError> {
   const { parentId, type } = data;
   if (!parentId) return okAsync({ level: 1, type });
   return tryDb(
      db.query.categories.findFirst({
         where: (f, { eq }) => eq(f.id, parentId),
      }),
      "Falha ao verificar categoria pai.",
   ).andThen((parent) => {
      if (!parent)
         return errAsync(WebAppError.notFound("Categoria pai não encontrada."));
      if (parent.level >= 3)
         return errAsync(
            WebAppError.badRequest("Limite de 3 níveis atingido."),
         );
      return okAsync({ level: parent.level + 1, type: parent.type });
   });
}

export function insertResolvedCategory(
   db: DbOrTx,
   teamId: string,
   data: CreateInput,
   resolved: Resolved,
): ResultAsync<CategoryRow, WebAppError> {
   return tryDb(
      db
         .insert(categories)
         .values({
            ...data,
            teamId,
            level: resolved.level,
            type: resolved.type,
         })
         .returning()
         .then((rows) => rows[0]),
      "Falha ao criar categoria.",
   ).andThen((row) =>
      ensureRow(row, "Falha ao criar categoria: insert vazio."),
   );
}

export function createCategory(
   db: DbOrTx,
   teamId: string,
   data: CreateInput,
): ResultAsync<CategoryRow, WebAppError> {
   const validate = data.keywords?.length
      ? assertKeywordsUnique(db, teamId, data.keywords)
      : okAsync(undefined);
   return validate
      .andThen(() => resolveParent(db, data))
      .andThen((resolved) =>
         insertResolvedCategory(db, teamId, data, resolved),
      );
}

export function enqueueKeywords(
   workflowClient: DBOSClient,
   category: { id: string; name: string; description: string | null },
   ctx: { teamId: string; organizationId: string; userId: string },
) {
   return enqueueDeriveKeywordsWorkflow(workflowClient, {
      categoryId: category.id,
      teamId: ctx.teamId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      name: category.name,
      description: category.description,
   });
}
