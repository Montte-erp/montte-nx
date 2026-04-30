import dayjs from "dayjs";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { errAsync, fromPromise, okAsync, safeTry } from "neverthrow";
import { z } from "zod";
import {
   createTagSchema,
   tags,
   updateTagSchema,
} from "@core/database/schemas/tags";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireTag } from "@modules/classification/router/middlewares";

const idSchema = z.object({ id: z.string().uuid() });
const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

const ensureRow = <T>(row: T | undefined, msg: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(msg));

export const create = protectedProcedure
   .input(createTagSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(tags)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar centro de custo."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao criar centro de custo: insert vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

const getAllInputSchema = z.object({
   search: z.string().optional(),
   includeArchived: z.boolean().optional(),
   page: z.number().int().positive().default(1),
   pageSize: z.number().int().positive().max(100).default(20),
});

export const getAll = protectedProcedure
   .input(getAllInputSchema)
   .handler(async ({ context, input }) => {
      const search = input.search?.trim();
      const result = await fromPromise(
         (async () => {
            const conditions = [eq(tags.teamId, context.teamId)];
            if (!input.includeArchived)
               conditions.push(eq(tags.isArchived, false));
            if (search) {
               const pattern = `%${search}%`;
               conditions.push(
                  sql`(${tags.name} ilike ${pattern} or coalesce(${tags.description}, '') ilike ${pattern})`,
               );
            }
            const whereClause = and(...conditions);
            const [countResult] = await context.db
               .select({ total: count() })
               .from(tags)
               .where(whereClause);
            const data = await context.db
               .select()
               .from(tags)
               .where(whereClause)
               .orderBy(asc(tags.dreOrder), asc(tags.name))
               .limit(input.pageSize)
               .offset((input.page - 1) * input.pageSize);
            return { data, total: countResult?.total ?? 0 };
         })(),
         () => WebAppError.internal("Falha ao listar centros de custo."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateTagSchema))
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(tags)
               .set({ ...data, updatedAt: dayjs().toDate() })
               .where(eq(tags.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar centro de custo."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao atualizar centro de custo: update vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (context.tag.isDefault)
         throw WebAppError.forbidden(
            "Centro de custo padrão não pode ser excluído.",
         );

      const flow = await safeTry(async function* () {
         const hasTx = yield* fromPromise(
            context.db.query.transactions.findFirst({
               where: (f, { eq }) => eq(f.tagId, input.id),
               columns: { id: true },
            }),
            () => WebAppError.internal("Falha ao verificar lançamentos."),
         );
         if (hasTx)
            yield* errAsync(
               WebAppError.conflict(
                  "Centro de custo com lançamentos não pode ser excluído. Use arquivamento.",
               ),
            );
         return fromPromise(
            context.db.transaction(async (tx) => {
               await tx.delete(tags).where(eq(tags.id, input.id));
            }),
            () => WebAppError.internal("Falha ao excluir centro de custo."),
         );
      });
      if (flow.isErr()) throw flow.error;
      return { success: true };
   });

export const archive = protectedProcedure
   .input(idSchema)
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(tags)
               .set({ isArchived: true, updatedAt: dayjs().toDate() })
               .where(eq(tags.id, input.id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao arquivar centro de custo."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao arquivar centro de custo: update vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const bulkArchive = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const flow = await safeTry(async function* () {
         const existing = yield* fromPromise(
            context.db.query.tags.findMany({
               where: (f, { and, inArray, eq }) =>
                  and(inArray(f.id, input.ids), eq(f.teamId, context.teamId)),
            }),
            () => WebAppError.internal("Falha ao verificar centros de custo."),
         );
         if (existing.length !== input.ids.length)
            yield* errAsync(
               WebAppError.notFound(
                  "Um ou mais centros de custo não foram encontrados.",
               ),
            );
         return fromPromise(
            context.db.transaction(async (tx) => {
               await tx
                  .update(tags)
                  .set({ isArchived: true, updatedAt: dayjs().toDate() })
                  .where(inArray(tags.id, input.ids));
            }),
            () => WebAppError.internal("Falha ao arquivar centros de custo."),
         );
      });
      if (flow.isErr()) throw flow.error;
      return { archived: input.ids.length };
   });

export const unarchive = protectedProcedure
   .input(idSchema)
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(tags)
               .set({ isArchived: false, updatedAt: dayjs().toDate() })
               .where(eq(tags.id, input.id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao reativar centro de custo."),
      ).andThen((row) =>
         ensureRow(row, "Falha ao reativar centro de custo: update vazio."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getStats = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db
         .select({
            active: sql<number>`count(*) filter (where not ${tags.isArchived})`,
            archived: sql<number>`count(*) filter (where ${tags.isArchived})`,
         })
         .from(tags)
         .where(eq(tags.teamId, context.teamId))
         .then(([row]) => ({
            active: Number(row?.active ?? 0),
            archived: Number(row?.archived ?? 0),
         })),
      () =>
         WebAppError.internal(
            "Falha ao buscar estatísticas de centros de custo.",
         ),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const bulkCreate = protectedProcedure
   .input(z.object({ items: z.array(createTagSchema).min(1) }))
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(tags)
               .values(
                  input.items.map((d) => ({ ...d, teamId: context.teamId })),
               )
               .returning(),
         ),
         () => WebAppError.internal("Falha ao importar centros de custo."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const bulkRemove = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const flow = await safeTry(async function* () {
         const existing = yield* fromPromise(
            context.db.query.tags.findMany({
               where: (f, { and, inArray, eq }) =>
                  and(inArray(f.id, input.ids), eq(f.teamId, context.teamId)),
            }),
            () => WebAppError.internal("Falha ao verificar centros de custo."),
         );
         if (existing.length !== input.ids.length)
            yield* errAsync(
               WebAppError.notFound(
                  "Um ou mais centros de custo não foram encontrados.",
               ),
            );
         if (existing.some((t) => t.isDefault))
            yield* errAsync(
               WebAppError.forbidden(
                  "Centros de custo padrão não podem ser excluídos.",
               ),
            );
         const hasTx = yield* fromPromise(
            context.db.query.transactions.findFirst({
               where: (f, { inArray }) => inArray(f.tagId, input.ids),
               columns: { id: true },
            }),
            () => WebAppError.internal("Falha ao verificar lançamentos."),
         );
         if (hasTx)
            yield* errAsync(
               WebAppError.conflict(
                  "Centros de custo com lançamentos não podem ser excluídos. Use arquivamento.",
               ),
            );
         return fromPromise(
            context.db.transaction(async (tx) => {
               await tx.delete(tags).where(inArray(tags.id, input.ids));
            }),
            () => WebAppError.internal("Falha ao excluir centros de custo."),
         );
      });
      if (flow.isErr()) throw flow.error;
      return { deleted: input.ids.length };
   });
