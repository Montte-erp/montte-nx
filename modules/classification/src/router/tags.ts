import { Result } from "better-result";
import dayjs from "dayjs";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import {
   createTagSchema,
   tags,
   updateTagSchema,
} from "@core/database/schemas/tags";
import { protectedProcedure } from "@core/orpc/server";
import {
   ClassificationRouterError,
   classificationRouterErrors,
   requireTag,
} from "@modules/classification/router/middlewares";
import type { ORPCContextWithOrganization } from "@core/orpc/context";

const idSchema = z.object({ id: z.string().uuid() });
const idsSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

const ensureRow = <T>(row: T | undefined, msg: string) =>
   row
      ? Result.ok(row)
      : Result.err(
           new ClassificationRouterError({
              error: classificationRouterErrors.INTERNAL(),
              message: msg,
           }),
        );

export const create = protectedProcedure
   .input(createTagSchema)
   .handler(async ({ context, input }) => {
      const created = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .insert(tags)
                  .values({ ...input, teamId: context.teamId })
                  .returning();
               return row;
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao criar centro de custo.",
            }),
      });
      if (Result.isError(created)) throw created.error;
      const result = ensureRow(
         created.value,
         "Falha ao criar centro de custo: insert vazio.",
      );
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

const getAllInputSchema = z.object({
   search: z.string().optional(),
   includeArchived: z.boolean().optional(),
   page: z.number().int().positive().default(1),
   pageSize: z.number().int().positive().max(100).default(20),
   sorting: z
      .array(
         z.object({
            id: z.enum([
               "createdAt",
               "description",
               "dreOrder",
               "isDefault",
               "name",
            ]),
            desc: z.boolean(),
         }),
      )
      .max(3, "Use no máximo 3 critérios de ordenação.")
      .optional(),
});

function buildTagOrderBy(
   sorting: z.infer<typeof getAllInputSchema>["sorting"],
) {
   if (!sorting?.length)
      return [asc(tags.dreOrder), asc(tags.name), asc(tags.createdAt)];
   const orderBy: SQL[] = [];

   for (const sort of sorting) {
      const direction = sort.desc ? desc : asc;

      switch (sort.id) {
         case "createdAt":
            orderBy.push(direction(tags.createdAt));
            break;
         case "description":
            orderBy.push(direction(tags.description));
            break;
         case "dreOrder":
            orderBy.push(direction(tags.dreOrder));
            break;
         case "isDefault":
            orderBy.push(direction(tags.isDefault));
            break;
         case "name":
            orderBy.push(direction(tags.name));
            break;
      }
   }

   return [
      ...orderBy,
      asc(tags.dreOrder),
      asc(tags.name),
      desc(tags.createdAt),
   ];
}

export const getAll = protectedProcedure
   .input(getAllInputSchema)
   .handler(async ({ context, input }) => {
      const search = input.search?.trim();
      const result = await Result.tryPromise({
         try: async () => {
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
               .orderBy(...buildTagOrderBy(input.sorting))
               .limit(input.pageSize)
               .offset((input.page - 1) * input.pageSize);
            return { data, total: countResult?.total ?? 0 };
         },
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao listar centros de custo.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const update = protectedProcedure
   .input(idSchema.merge(updateTagSchema))
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const updated = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(tags)
                  .set({ ...data, updatedAt: dayjs().toDate() })
                  .where(eq(tags.id, id))
                  .returning();
               return row;
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao atualizar centro de custo.",
            }),
      });
      if (Result.isError(updated)) throw updated.error;
      const result = ensureRow(
         updated.value,
         "Falha ao atualizar centro de custo: update vazio.",
      );
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const remove = protectedProcedure
   .input(idSchema)
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      if (context.tag.isDefault) {
         throw new ClassificationRouterError({
            error: classificationRouterErrors.FORBIDDEN(),
            message: "Centro de custo padrão não pode ser excluído.",
         });
      }

      const hasTx = await Result.tryPromise({
         try: () =>
            context.db.query.transactions.findFirst({
               where: (f, { eq }) => eq(f.tagId, input.id),
               columns: { id: true },
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao verificar lançamentos.",
            }),
      });
      if (Result.isError(hasTx)) throw hasTx.error;
      if (hasTx.value) {
         throw new ClassificationRouterError({
            error: classificationRouterErrors.CONFLICT(),
            message:
               "Centro de custo com lançamentos não pode ser excluído. Use arquivamento.",
         });
      }

      const removed = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               await tx.delete(tags).where(eq(tags.id, input.id));
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao excluir centro de custo.",
            }),
      });
      if (Result.isError(removed)) throw removed.error;
      return { success: true };
   });

export const archive = protectedProcedure
   .input(idSchema)
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      const archived = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(tags)
                  .set({ isArchived: true, updatedAt: dayjs().toDate() })
                  .where(eq(tags.id, input.id))
                  .returning();
               return row;
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao arquivar centro de custo.",
            }),
      });
      if (Result.isError(archived)) throw archived.error;
      const result = ensureRow(
         archived.value,
         "Falha ao arquivar centro de custo: update vazio.",
      );
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const bulkArchive = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const existing = await loadOwnedTags(context, input.ids);
      if (Result.isError(existing)) throw existing.error;

      const archived = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               await tx
                  .update(tags)
                  .set({ isArchived: true, updatedAt: dayjs().toDate() })
                  .where(inArray(tags.id, input.ids));
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao arquivar centros de custo.",
            }),
      });
      if (Result.isError(archived)) throw archived.error;
      return { archived: existing.value.length };
   });

export const unarchive = protectedProcedure
   .input(idSchema)
   .use(requireTag, (input) => input.id)
   .handler(async ({ context, input }) => {
      const unarchived = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               const [row] = await tx
                  .update(tags)
                  .set({ isArchived: false, updatedAt: dayjs().toDate() })
                  .where(eq(tags.id, input.id))
                  .returning();
               return row;
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao reativar centro de custo.",
            }),
      });
      if (Result.isError(unarchived)) throw unarchived.error;
      const result = ensureRow(
         unarchived.value,
         "Falha ao reativar centro de custo: update vazio.",
      );
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const getStats = protectedProcedure.handler(async ({ context }) => {
   const result = await Result.tryPromise({
      try: () =>
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
      catch: () =>
         new ClassificationRouterError({
            error: classificationRouterErrors.INTERNAL(),
            message: "Falha ao buscar estatísticas de centros de custo.",
         }),
   });
   if (Result.isError(result)) throw result.error;
   return result.value;
});

export const bulkCreate = protectedProcedure
   .input(z.object({ items: z.array(createTagSchema).min(1) }))
   .handler(async ({ context, input }) => {
      const result = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) =>
               tx
                  .insert(tags)
                  .values(
                     input.items.map((d) => ({
                        ...d,
                        teamId: context.teamId,
                     })),
                  )
                  .returning(),
            ),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao importar centros de custo.",
            }),
      });
      if (Result.isError(result)) throw result.error;
      return result.value;
   });

export const bulkRemove = protectedProcedure
   .input(idsSchema)
   .handler(async ({ context, input }) => {
      const existing = await loadOwnedTags(context, input.ids);
      if (Result.isError(existing)) throw existing.error;
      if (existing.value.some((t) => t.isDefault)) {
         throw new ClassificationRouterError({
            error: classificationRouterErrors.FORBIDDEN(),
            message: "Centros de custo padrão não podem ser excluídos.",
         });
      }

      const hasTx = await Result.tryPromise({
         try: () =>
            context.db.query.transactions.findFirst({
               where: (f, { inArray }) => inArray(f.tagId, input.ids),
               columns: { id: true },
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao verificar lançamentos.",
            }),
      });
      if (Result.isError(hasTx)) throw hasTx.error;
      if (hasTx.value) {
         throw new ClassificationRouterError({
            error: classificationRouterErrors.CONFLICT(),
            message:
               "Centros de custo com lançamentos não podem ser excluídos. Use arquivamento.",
         });
      }

      const removed = await Result.tryPromise({
         try: () =>
            context.db.transaction(async (tx) => {
               await tx.delete(tags).where(inArray(tags.id, input.ids));
            }),
         catch: () =>
            new ClassificationRouterError({
               error: classificationRouterErrors.INTERNAL(),
               message: "Falha ao excluir centros de custo.",
            }),
      });
      if (Result.isError(removed)) throw removed.error;
      return { deleted: input.ids.length };
   });

async function loadOwnedTags(
   context: ORPCContextWithOrganization,
   ids: string[],
) {
   const existing = await Result.tryPromise({
      try: () =>
         context.db.query.tags.findMany({
            where: (f, { and, inArray, eq }) =>
               and(inArray(f.id, ids), eq(f.teamId, context.teamId)),
         }),
      catch: () =>
         new ClassificationRouterError({
            error: classificationRouterErrors.INTERNAL(),
            message: "Falha ao verificar centros de custo.",
         }),
   });
   if (Result.isError(existing)) return existing;
   if (existing.value.length === ids.length) return Result.ok(existing.value);
   return Result.err(
      new ClassificationRouterError({
         error: classificationRouterErrors.NOT_FOUND(),
         message: "Um ou mais centros de custo não foram encontrados.",
      }),
   );
}
