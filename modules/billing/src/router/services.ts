import {
   and,
   count,
   countDistinct,
   desc,
   eq,
   inArray,
   sql,
   sum,
} from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { contacts } from "@core/database/schemas/contacts";
import {
   createServiceSchema,
   services,
   servicePrices,
   updateServiceSchema,
} from "@core/database/schemas/services";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import { requireService } from "@modules/billing/router/middlewares";

const idInputSchema = z.object({ id: z.string().uuid() });
const serviceIdInputSchema = z.object({ serviceId: z.string().uuid() });
const bulkIdsInputSchema = z.object({
   ids: z.array(z.string().uuid()).min(1),
});
const bulkCreateServicesInputSchema = z.object({
   items: z.array(createServiceSchema).min(1),
});
const updateServiceInputSchema = idInputSchema.merge(updateServiceSchema);
const listServicesInputSchema = z
   .object({
      search: z.string().optional(),
      categoryId: z.string().uuid().optional(),
   })
   .optional();

export const getAll = protectedProcedure
   .input(listServicesInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.services.findMany({
            where: (f, { eq, and, or, ilike }) => {
               const conditions = [eq(f.teamId, context.teamId)];
               if (input?.search) {
                  const pattern = `%${input.search}%`;
                  const match = or(
                     ilike(f.name, pattern),
                     ilike(f.description, pattern),
                  );
                  if (match) conditions.push(match);
               }
               if (input?.categoryId)
                  conditions.push(eq(f.categoryId, input.categoryId));
               return and(...conditions);
            },
            with: { category: true, tag: true },
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
         () => WebAppError.internal("Falha ao listar serviços."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getAllStats = protectedProcedure.handler(async ({ context }) => {
   const teamId = context.teamId;

   const priceCountsResult = await fromPromise(
      context.db
         .select({
            serviceId: servicePrices.serviceId,
            priceCount: count(),
         })
         .from(servicePrices)
         .where(
            and(
               eq(servicePrices.teamId, teamId),
               eq(servicePrices.isActive, true),
            ),
         )
         .groupBy(servicePrices.serviceId),
      () => WebAppError.internal("Falha ao agregar preços."),
   );
   if (priceCountsResult.isErr()) throw priceCountsResult.error;

   const subStatsResult = await fromPromise(
      context.db
         .select({
            serviceId: servicePrices.serviceId,
            subscriberCount: countDistinct(subscriptionItems.subscriptionId),
            mrr: sum(
               sql<string>`
  CASE ${servicePrices.interval}
    WHEN 'monthly' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric
    WHEN 'annual' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric / 12
    WHEN 'semestral' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric / 6
    WHEN 'weekly' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric * 52 / 12
    WHEN 'daily' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric * 30
    WHEN 'shift' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric * 90
    WHEN 'hourly' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric * 730
    ELSE 0::numeric
  END
`,
            ),
         })
         .from(subscriptionItems)
         .innerJoin(
            servicePrices,
            eq(subscriptionItems.priceId, servicePrices.id),
         )
         .innerJoin(
            contactSubscriptions,
            eq(subscriptionItems.subscriptionId, contactSubscriptions.id),
         )
         .where(
            and(
               eq(subscriptionItems.teamId, teamId),
               eq(contactSubscriptions.status, "active"),
            ),
         )
         .groupBy(servicePrices.serviceId),
      () => WebAppError.internal("Falha ao agregar assinantes."),
   );
   if (subStatsResult.isErr()) throw subStatsResult.error;

   const stats = new Map<
      string,
      { priceCount: number; subscriberCount: number; mrr: string }
   >();
   for (const row of priceCountsResult.value) {
      stats.set(row.serviceId, {
         priceCount: row.priceCount,
         subscriberCount: 0,
         mrr: "0",
      });
   }
   for (const row of subStatsResult.value) {
      const cur = stats.get(row.serviceId) ?? {
         priceCount: 0,
         subscriberCount: 0,
         mrr: "0",
      };
      cur.subscriberCount = row.subscriberCount;
      cur.mrr = row.mrr ?? "0";
      stats.set(row.serviceId, cur);
   }
   return Array.from(stats.entries()).map(([serviceId, v]) => ({
      serviceId,
      ...v,
   }));
});

export const getById = protectedProcedure
   .input(idInputSchema)
   .use(requireService, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.services.findFirst({
            where: (f, { eq }) => eq(f.id, input.id),
            with: { category: true, tag: true },
         }),
         () => WebAppError.internal("Falha ao buscar serviço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value) throw WebAppError.notFound("Serviço não encontrado.");
      return result.value;
   });

export const create = protectedProcedure
   .input(createServiceSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(services)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar serviço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar serviço: insert vazio.");
      return result.value;
   });

export const bulkCreate = protectedProcedure
   .input(bulkCreateServicesInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) =>
            tx
               .insert(services)
               .values(
                  input.items.map((item) => ({
                     ...item,
                     teamId: context.teamId,
                  })),
               )
               .returning(),
         ),
         () => WebAppError.internal("Falha ao importar serviços."),
      );
      if (result.isErr()) throw result.error;
      if (result.value.length === 0)
         throw WebAppError.internal("Falha ao importar os serviços.");
      return result.value;
   });

export const update = protectedProcedure
   .input(updateServiceInputSchema)
   .use(requireService, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(services)
               .set(data)
               .where(eq(services.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar serviço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar serviço: update vazio.",
         );
      return result.value;
   });

export const remove = protectedProcedure
   .input(idInputSchema)
   .use(requireService, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(services).where(eq(services.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir serviço."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const bulkRemove = protectedProcedure
   .input(bulkIdsInputSchema)
   .handler(async ({ context, input }) => {
      const ownedResult = await fromPromise(
         context.db
            .select({ id: services.id })
            .from(services)
            .where(
               and(
                  inArray(services.id, input.ids),
                  eq(services.teamId, context.teamId),
               ),
            ),
         () => WebAppError.internal("Falha ao excluir serviços."),
      );
      if (ownedResult.isErr()) throw ownedResult.error;
      const ownedIds = ownedResult.value.map((r) => r.id);
      if (ownedIds.length === 0)
         return { deleted: 0, failed: input.ids.length };

      const settled = await Promise.allSettled(
         ownedIds.map((id) =>
            context.db.transaction(async (tx) => {
               await tx.delete(services).where(eq(services.id, id));
            }),
         ),
      );
      const deleted = settled.filter((r) => r.status === "fulfilled").length;
      const failed = input.ids.length - deleted;
      return { deleted, failed };
   });

export const exportAll = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.services.findMany({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
         with: { category: true, tag: true },
         orderBy: (f, { asc }) => [asc(f.name)],
      }),
      () => WebAppError.internal("Falha ao listar serviços."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const getSubscribers = protectedProcedure
   .input(serviceIdInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db
            .select({
               itemId: subscriptionItems.id,
               subscriptionId: contactSubscriptions.id,
               contactId: contacts.id,
               contactName: contacts.name,
               status: contactSubscriptions.status,
               startDate: contactSubscriptions.startDate,
               priceId: servicePrices.id,
               priceName: servicePrices.name,
               interval: servicePrices.interval,
               quantity: subscriptionItems.quantity,
               basePrice: servicePrices.basePrice,
               negotiatedPrice: subscriptionItems.negotiatedPrice,
            })
            .from(subscriptionItems)
            .innerJoin(
               servicePrices,
               eq(subscriptionItems.priceId, servicePrices.id),
            )
            .innerJoin(
               contactSubscriptions,
               eq(subscriptionItems.subscriptionId, contactSubscriptions.id),
            )
            .innerJoin(
               contacts,
               eq(contactSubscriptions.contactId, contacts.id),
            )
            .where(
               and(
                  eq(servicePrices.serviceId, input.serviceId),
                  eq(servicePrices.teamId, context.teamId),
               ),
            )
            .orderBy(desc(contactSubscriptions.startDate)),
         () => WebAppError.internal("Falha ao listar assinantes."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });
