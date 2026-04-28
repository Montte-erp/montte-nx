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
import type { DatabaseInstance } from "@core/database/client";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { contacts } from "@core/database/schemas/contacts";
import { services, servicePrices } from "@core/database/schemas/services";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { WebAppError } from "@core/logging/errors";
import { protectedProcedure } from "@core/orpc/server";
import {
   createServiceSchema,
   listServicesInputSchema,
   idInputSchema,
   serviceIdInputSchema,
   bulkCreateServicesInputSchema,
   bulkIdsInputSchema,
   createPriceForServiceInputSchema,
   updateServiceInputSchema,
   updatePriceInputSchema,
} from "../contracts/services";
import {
   computeEffectiveCost,
   formatCostBRL,
   isBelowFloor,
   moneyAtCostScale,
} from "../services/cost";
import { requireService, requireServicePrice } from "./middlewares";

async function loadCostInputs(
   db: DatabaseInstance,
   teamId: string,
   serviceId: string,
   meterId: string | null | undefined,
   priceType: "flat" | "per_unit" | "metered" | undefined,
) {
   const service = await db.query.services.findFirst({
      where: (f, { eq: e, and: a }) =>
         a(e(f.id, serviceId), e(f.teamId, teamId)),
      columns: { id: true, costPrice: true },
   });
   if (!service) throw WebAppError.notFound("Serviço não encontrado.");

   const attachedBenefits = await db
      .select({
         unitCost: benefits.unitCost,
         creditAmount: benefits.creditAmount,
      })
      .from(serviceBenefits)
      .innerJoin(benefits, eq(serviceBenefits.benefitId, benefits.id))
      .where(eq(serviceBenefits.serviceId, serviceId));

   let meter: { unitCost: string } | null = null;
   if (priceType === "metered" && meterId) {
      const m = await db.query.meters.findFirst({
         where: (f, { eq: e, and: a }) =>
            a(e(f.id, meterId), e(f.teamId, teamId)),
         columns: { unitCost: true },
      });
      if (m) meter = m;
   }

   return { service, attachedBenefits, meter };
}

async function assertFloor({
   db,
   teamId,
   serviceId,
   meterId,
   type,
   minPrice,
}: {
   db: DatabaseInstance;
   teamId: string;
   serviceId: string;
   meterId: string | null | undefined;
   type: "flat" | "per_unit" | "metered" | undefined;
   minPrice: string | null | undefined;
}) {
   if (!minPrice) return;
   const { service, attachedBenefits, meter } = await loadCostInputs(
      db,
      teamId,
      serviceId,
      meterId,
      type,
   );
   const effective = computeEffectiveCost({
      serviceCostPrice: service.costPrice,
      benefits: attachedBenefits.map((b) => ({
         unitCost: b.unitCost,
         creditAmount: b.creditAmount,
      })),
      price: type ? { type, meterId: meterId ?? null } : undefined,
      meter,
   });
   if (isBelowFloor(minPrice, effective)) {
      throw WebAppError.badRequest(
         `Piso ${formatCostBRL(moneyAtCostScale(minPrice))} está abaixo do custo efetivo ${formatCostBRL(effective)}.`,
      );
   }
}

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

export const getVariants = protectedProcedure
   .input(serviceIdInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.servicePrices.findMany({
            where: (f, { eq }) => eq(f.serviceId, input.serviceId),
            orderBy: (f, { asc }) => [asc(f.name)],
         }),
         () => WebAppError.internal("Falha ao listar preços."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const createVariant = protectedProcedure
   .input(createPriceForServiceInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const { serviceId, ...variantData } = input;
      if (input.type === "metered" && !input.meterId)
         throw WebAppError.badRequest(
            "meterId é obrigatório para preços do tipo 'metered'.",
         );
      if (input.type === "metered" && Number(input.basePrice) !== 0)
         throw WebAppError.badRequest(
            "basePrice deve ser 0 para preços do tipo 'metered'.",
         );
      await assertFloor({
         db: context.db,
         teamId: context.teamId,
         serviceId,
         meterId: input.meterId,
         type: input.type,
         minPrice: input.minPrice,
      });
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(servicePrices)
               .values({ ...variantData, teamId: context.teamId, serviceId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar preço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar preço: insert vazio.");
      return result.value;
   });

export const updateVariant = protectedProcedure
   .input(updatePriceInputSchema)
   .use(requireServicePrice, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      if (
         input.type === "metered" &&
         (input.meterId === null || input.meterId === undefined)
      )
         throw WebAppError.badRequest(
            "meterId é obrigatório para preços do tipo 'metered'.",
         );
      if (input.minPrice !== undefined && input.minPrice !== null) {
         await assertFloor({
            db: context.db,
            teamId: context.teamId,
            serviceId: context.servicePrice.serviceId,
            meterId: input.meterId ?? context.servicePrice.meterId,
            type: input.type ?? context.servicePrice.type,
            minPrice: input.minPrice,
         });
      }
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(servicePrices)
               .set(data)
               .where(eq(servicePrices.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar preço."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao atualizar preço: update vazio.");
      return result.value;
   });

export const removeVariant = protectedProcedure
   .input(idInputSchema)
   .use(requireServicePrice, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(servicePrices)
               .where(eq(servicePrices.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir preço."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });
