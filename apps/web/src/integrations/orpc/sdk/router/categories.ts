import { z } from "zod";
import dayjs from "dayjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import type { DatabaseInstance } from "@core/database/client";
import { categories } from "@core/database/schemas/categories";
import { transactions } from "@core/database/schemas/transactions";
import {
   CreateCategorySchema,
   UpdateCategorySchema,
} from "@montte/cli/contract";
import { WebAppError } from "@core/logging/errors";
import { emitFinanceCategoryCreated } from "@packages/events/finance";
import { createBillableProcedure } from "../billable";
import { sdkProcedure } from "../server";

type DbOrTx =
   | DatabaseInstance
   | Parameters<Parameters<DatabaseInstance["transaction"]>[0]>[0];

function mapCategory(cat: {
   createdAt?: string | Date | null;
   updatedAt?: string | Date | null;
   [key: string]: unknown;
}) {
   return {
      ...cat,
      createdAt: dayjs(cat.createdAt).toISOString(),
      updatedAt: dayjs(cat.updatedAt).toISOString(),
   };
}

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

async function ensureCategoryOwnership(db: DbOrTx, id: string, teamId: string) {
   const category = await db.query.categories.findFirst({
      where: (f, { eq }) => eq(f.id, id),
   });
   if (!category || category.teamId !== teamId) {
      throw WebAppError.notFound("Categoria não encontrada.");
   }
   return category;
}

export const list = sdkProcedure
   .input(
      z.object({
         type: z.enum(["income", "expense"]).optional(),
         includeArchived: z.boolean().optional(),
      }),
   )
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const teamId = context.teamId;
      const result = await fromPromise(
         (async () => {
            const conditions: SQL[] = [eq(categories.teamId, teamId)];
            if (input.type) conditions.push(eq(categories.type, input.type));
            if (!input.includeArchived)
               conditions.push(eq(categories.isArchived, false));
            return context.db.query.categories.findMany({
               where: and(...conditions),
               orderBy: (f, { asc }) => [asc(f.name)],
            });
         })(),
         () => WebAppError.internal("Falha ao listar categorias."),
      );
      if (result.isErr()) throw result.error;
      return result.value.map(mapCategory);
   });

export const create = createBillableProcedure("finance.category_created")
   .input(CreateCategorySchema)
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const teamId = context.teamId;

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            let level = 1;
            let type = input.type;
            if (input.parentId) {
               const parentId = input.parentId;
               const parent = await tx.query.categories.findFirst({
                  where: (f, { eq }) => eq(f.id, parentId),
               });
               if (!parent)
                  throw WebAppError.notFound("Categoria pai não encontrada.");
               if (parent.level >= 3)
                  throw WebAppError.badRequest("Limite de 3 níveis atingido.");
               level = parent.level + 1;
               type = parent.type;
            }
            if (input.keywords?.length) {
               await validateKeywordsUniqueness(tx, teamId, input.keywords);
            }
            const [row] = await tx
               .insert(categories)
               .values({
                  ...input,
                  teamId,
                  level,
                  type,
                  participatesDre: false,
               })
               .returning();
            if (!row) throw WebAppError.internal("Falha ao criar categoria.");
            return row;
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao criar categoria.", {
                    cause: e,
                 }),
      );
      if (result.isErr()) throw result.error;
      const cat = result.value;
      context.scheduleEmit(() =>
         emitFinanceCategoryCreated(context.emit, context.emitCtx, {
            categoryId: cat.id,
         }),
      );
      return mapCategory(cat);
   });

export const update = sdkProcedure
   .input(z.object({ id: z.string().uuid() }).merge(UpdateCategorySchema))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const teamId = context.teamId;
      const { id, ...data } = input;

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const existing = await ensureCategoryOwnership(tx, id, teamId);
            if (existing.isDefault)
               throw WebAppError.conflict(
                  "Categorias padrão não podem ser editadas.",
               );
            if (data.keywords?.length) {
               await validateKeywordsUniqueness(tx, teamId, data.keywords, id);
            }
            const [updated] = await tx
               .update(categories)
               .set({ ...data, updatedAt: dayjs().toDate() })
               .where(eq(categories.id, id))
               .returning();
            if (!updated)
               throw WebAppError.notFound("Categoria não encontrada.");
            return updated;
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao atualizar categoria.", {
                    cause: e,
                 }),
      );
      if (result.isErr()) throw result.error;
      return mapCategory(result.value);
   });

export const remove = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const teamId = context.teamId;

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const existing = await ensureCategoryOwnership(
               tx,
               input.id,
               teamId,
            );
            if (existing.isDefault)
               throw WebAppError.conflict(
                  "Categorias padrão não podem ser excluídas.",
               );
            const hasTx = await categoryTreeHasTransactions(tx, input.id);
            if (hasTx)
               throw WebAppError.conflict(
                  "Categoria com lançamentos não pode ser excluída. Use arquivamento.",
               );
            await tx.delete(categories).where(eq(categories.id, input.id));
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao excluir categoria.", {
                    cause: e,
                 }),
      );
      if (result.isErr()) throw result.error;
      return { success: true };
   });

export const archive = sdkProcedure
   .input(z.object({ id: z.string().uuid() }))
   .handler(async ({ context, input }) => {
      if (!context.teamId) throw WebAppError.unauthorized("Team ID required");
      const teamId = context.teamId;

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const existing = await ensureCategoryOwnership(
               tx,
               input.id,
               teamId,
            );
            if (existing.isDefault)
               throw WebAppError.conflict(
                  "Categorias padrão não podem ser arquivadas.",
               );
            const descendantIds = await getDescendantIds(tx, input.id);
            const allIds = [input.id, ...descendantIds];
            await tx
               .update(categories)
               .set({ isArchived: true, updatedAt: dayjs().toDate() })
               .where(inArray(categories.id, allIds));
            const archived = await tx.query.categories.findFirst({
               where: (f, { eq }) => eq(f.id, input.id),
            });
            if (!archived)
               throw WebAppError.notFound("Categoria não encontrada.");
            return archived;
         }),
         (e) =>
            e instanceof WebAppError
               ? e
               : WebAppError.internal("Falha ao arquivar categoria.", {
                    cause: e,
                 }),
      );
      if (result.isErr()) throw result.error;
      return mapCategory(result.value);
   });
