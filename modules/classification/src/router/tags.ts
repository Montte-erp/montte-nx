import dayjs from "dayjs";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { user as userTable } from "@core/database/schemas/auth";
import { tags } from "@core/database/schemas/tags";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { createTagSchema, updateTagSchema } from "../contracts/tags";
import { enqueueDeriveKeywordsWorkflow } from "../workflows/derive-keywords-workflow";
import { requireTag } from "./middlewares";

const idSchema = z.object({ id: z.string().uuid() });

export const create = protectedProcedure
   .input(createTagSchema)
   .handler(async ({ context, input }) => {
      const userRecord = await context.db.query.user.findFirst({
         where: eq(userTable.id, context.userId),
         columns: { stripeCustomerId: true },
      });

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(tags)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar centro de custo."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao criar centro de custo: insert vazio.",
         );
      const tag = result.value;

      await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
         entity: "tag",
         tagId: tag.id,
         teamId: context.teamId,
         organizationId: context.organizationId,
         userId: context.userId,
         name: tag.name,
         description: tag.description ?? null,
         stripeCustomerId: userRecord?.stripeCustomerId ?? null,
      });

      return tag;
   });

export const getAll = protectedProcedure
   .input(
      z.object({
         search: z.string().optional(),
         includeArchived: z.boolean().optional(),
         page: z.number().int().positive().default(1),
         pageSize: z.number().int().positive().max(100).default(20),
      }),
   )
   .handler(async ({ context, input }) => {
      const search = input.search?.trim();
      const result = await fromPromise(
         (async () => {
            const conditions = [eq(tags.teamId, context.teamId)];
            if (!input.includeArchived)
               conditions.push(eq(tags.isArchived, false));
            if (search) {
               conditions.push(
                  sql`(
                     ${tags.name} ilike ${"%" + search + "%"}
                     or coalesce(${tags.description}, '') ilike ${"%" + search + "%"}
                  )`,
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
               .orderBy(asc(tags.name))
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
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar centro de custo: update vazio.",
         );
      const tag = result.value;

      const keywordsProvided = data.keywords !== undefined;
      if (
         !keywordsProvided &&
         (data.name !== undefined || data.description !== undefined)
      ) {
         const userRecord = await context.db.query.user.findFirst({
            where: eq(userTable.id, context.userId),
            columns: { stripeCustomerId: true },
         });
         await enqueueDeriveKeywordsWorkflow(context.workflowClient, {
            entity: "tag",
            tagId: tag.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            userId: context.userId,
            name: tag.name,
            description: tag.description ?? null,
            stripeCustomerId: userRecord?.stripeCustomerId ?? null,
         });
      }

      return tag;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { tag } = context;
      if (tag.isDefault)
         throw WebAppError.forbidden(
            "Centro de custo padrão não pode ser excluído.",
         );

      const hasTxResult = await fromPromise(
         context.db.query.transactions.findFirst({
            where: (f, { eq }) => eq(f.tagId, input.id),
            columns: { id: true },
         }),
         () => WebAppError.internal("Falha ao verificar lançamentos."),
      );
      if (hasTxResult.isErr()) throw hasTxResult.error;
      if (hasTxResult.value)
         throw WebAppError.conflict(
            "Centro de custo com lançamentos não pode ser excluído. Use arquivamento.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(tags).where(eq(tags.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir centro de custo."),
      );
      if (result.isErr()) throw result.error;
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
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao arquivar centro de custo: update vazio.",
         );
      return result.value;
   });

export const bulkArchive = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const existing = await fromPromise(
         context.db.query.tags.findMany({
            where: (f, { and, inArray, eq }) =>
               and(inArray(f.id, input.ids), eq(f.teamId, context.teamId)),
         }),
         () => WebAppError.internal("Falha ao verificar centros de custo."),
      );
      if (existing.isErr()) throw existing.error;
      if (existing.value.length !== input.ids.length)
         throw WebAppError.notFound(
            "Um ou mais centros de custo não foram encontrados.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .update(tags)
               .set({ isArchived: true, updatedAt: dayjs().toDate() })
               .where(inArray(tags.id, input.ids));
         }),
         () => WebAppError.internal("Falha ao arquivar centros de custo."),
      );
      if (result.isErr()) throw result.error;
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
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao reativar centro de custo: update vazio.",
         );
      return result.value;
   });

export const getStats = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db
         .select({
            active: sql<number>`count(*) filter (where not ${tags.isArchived})`,
            archived: sql<number>`count(*) filter (where ${tags.isArchived})`,
            totalKeywords: sql<number>`coalesce(sum(array_length(${tags.keywords}, 1)), 0)`,
         })
         .from(tags)
         .where(eq(tags.teamId, context.teamId))
         .then(([row]) => ({
            active: Number(row?.active ?? 0),
            archived: Number(row?.archived ?? 0),
            totalKeywords: Number(row?.totalKeywords ?? 0),
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
      const userRecord = await context.db.query.user.findFirst({
         where: eq(userTable.id, context.userId),
         columns: { stripeCustomerId: true },
      });

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
      const created = result.value;

      await Promise.all(
         created.map((tag) =>
            enqueueDeriveKeywordsWorkflow(context.workflowClient, {
               entity: "tag",
               tagId: tag.id,
               teamId: context.teamId,
               organizationId: context.organizationId,
               userId: context.userId,
               name: tag.name,
               description: tag.description ?? null,
               stripeCustomerId: userRecord?.stripeCustomerId ?? null,
            }),
         ),
      );

      return created;
   });

export const bulkRemove = protectedProcedure
   .input(z.object({ ids: z.array(z.string().uuid()).min(1) }))
   .handler(async ({ context, input }) => {
      const existing = await fromPromise(
         context.db.query.tags.findMany({
            where: (f, { and, inArray, eq }) =>
               and(inArray(f.id, input.ids), eq(f.teamId, context.teamId)),
         }),
         () => WebAppError.internal("Falha ao verificar centros de custo."),
      );
      if (existing.isErr()) throw existing.error;
      if (existing.value.length !== input.ids.length)
         throw WebAppError.notFound(
            "Um ou mais centros de custo não foram encontrados.",
         );
      if (existing.value.some((t) => t.isDefault))
         throw WebAppError.forbidden(
            "Centros de custo padrão não podem ser excluídos.",
         );

      const txCheck = await fromPromise(
         context.db.query.transactions.findFirst({
            where: (f, { inArray }) => inArray(f.tagId, input.ids),
            columns: { id: true },
         }),
         () => WebAppError.internal("Falha ao verificar lançamentos."),
      );
      if (txCheck.isErr()) throw txCheck.error;
      if (txCheck.value)
         throw WebAppError.conflict(
            "Centros de custo com lançamentos não podem ser excluídos. Use arquivamento.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(tags).where(inArray(tags.id, input.ids));
         }),
         () => WebAppError.internal("Falha ao excluir centros de custo."),
      );
      if (result.isErr()) throw result.error;
      return { deleted: input.ids.length };
   });
