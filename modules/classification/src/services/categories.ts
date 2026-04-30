import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { errAsync, fromPromise, okAsync, type ResultAsync } from "neverthrow";
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

export const ensureRow = <T>(row: T | undefined, msg: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(msg));

export const wrapTx = <T>(
   promise: Promise<T>,
   msg: string,
): ResultAsync<T, WebAppError> =>
   fromPromise(promise, (e) =>
      e instanceof WebAppError ? e : WebAppError.internal(msg, { cause: e }),
   );

export async function getDescendantIds(
   db: DbOrTx,
   categoryId: string,
): Promise<string[]> {
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
}

export async function categoryTreeHasTransactions(
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

export async function assertKeywordsUnique(
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

export async function insertCategoryRow(
   db: DbOrTx,
   teamId: string,
   data: CreateInput,
) {
   let level = 1;
   let type = data.type;
   const { parentId } = data;
   if (parentId) {
      const parent = await db.query.categories.findFirst({
         where: (f, { eq }) => eq(f.id, parentId),
      });
      if (!parent) throw WebAppError.notFound("Categoria pai não encontrada.");
      if (parent.level >= 3)
         throw WebAppError.badRequest("Limite de 3 níveis atingido.");
      level = parent.level + 1;
      type = parent.type;
   }
   if (data.keywords?.length) {
      await assertKeywordsUnique(db, teamId, data.keywords);
   }
   const [row] = await db
      .insert(categories)
      .values({ ...data, teamId, level, type })
      .returning();
   if (!row) throw WebAppError.internal("Falha ao criar categoria.");
   return row;
}

export async function loadOwnedCategories(
   db: DatabaseInstance,
   teamId: string,
   ids: string[],
) {
   return db.query.categories.findMany({
      where: (f, { and, inArray, eq }) =>
         and(inArray(f.id, ids), eq(f.teamId, teamId)),
   });
}

export async function expandWithDescendants(
   db: DatabaseInstance,
   ids: string[],
): Promise<string[]> {
   const descendants = (
      await Promise.all(ids.map((id) => getDescendantIds(db, id)))
   ).flat();
   return [...new Set([...ids, ...descendants])];
}

export async function enqueueKeywords(
   workflowClient: DBOSClient,
   category: { id: string; name: string; description: string | null },
   ctx: { teamId: string; organizationId: string; userId: string },
) {
   await enqueueDeriveKeywordsWorkflow(workflowClient, {
      categoryId: category.id,
      teamId: ctx.teamId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      name: category.name,
      description: category.description,
   });
}
