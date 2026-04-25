import dayjs from "dayjs";
import { and, asc, count, eq, sql, sum } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { meters } from "@core/database/schemas/meters";
import { services, servicePrices } from "@core/database/schemas/services";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { usageEvents } from "@core/database/schemas/usage-events";
import { WebAppError } from "@core/logging/errors";
import { getLogger } from "@core/logging/root";
import { protectedProcedure, billableProcedure } from "@core/orpc/server";
import { enqueueBenefitLifecycleWorkflow } from "../workflows/benefit-lifecycle-workflow";
import { enqueuePeriodEndInvoiceWorkflow } from "../workflows/period-end-invoice-workflow";
import { enqueueTrialExpiryWorkflow } from "../workflows/trial-expiry-workflow";
import {
   createServiceSchema,
   createSubscriptionItemSchema,
   createMeterSchema,
   createBenefitSchema,
   upsertUsageEventSchema,
   listServicesInputSchema,
   listSubscriptionsInputSchema,
   createSubscriptionWithItemsInputSchema,
   listExpiringSoonInputSchema,
   serviceBenefitLinkSchema,
   idInputSchema,
   serviceIdInputSchema,
   priceIdInputSchema,
   contactIdInputSchema,
   subscriptionIdInputSchema,
   bulkCreateServicesInputSchema,
   createPriceForServiceInputSchema,
   updateServiceInputSchema,
   updatePriceInputSchema,
   updateMeterInputSchema,
   updateBenefitInputSchema,
   updateSubscriptionItemInputSchema,
} from "../contracts/services";
import {
   requireBenefit,
   requireContact,
   requireMeter,
   requireService,
   requireServicePrice,
   requireSubscription,
   requireSubscriptionItem,
} from "./middlewares";

const logger = getLogger().child({ module: "billing/services" });
const MAX_ITEMS_PER_SUBSCRIPTION = 20;

// --- Services ---

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

// --- Prices ---

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
      if (input.type === "metered") {
         if (!input.meterId)
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         if (Number(input.basePrice) !== 0)
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
      }
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
      if (input.type === "metered") {
         if (input.meterId === null || input.meterId === undefined)
            throw WebAppError.badRequest(
               "meterId é obrigatório para preços do tipo 'metered'.",
            );
         if (input.basePrice !== undefined && Number(input.basePrice) !== 0)
            throw WebAppError.badRequest(
               "Preços do tipo 'metered' devem ter basePrice igual a '0'.",
            );
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

// --- Subscriptions ---

export const getAllSubscriptions = protectedProcedure
   .input(listSubscriptionsInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.contactSubscriptions.findMany({
            where: (f, { eq, and }) =>
               input?.status
                  ? and(
                       eq(f.teamId, context.teamId),
                       eq(f.status, input.status),
                    )
                  : eq(f.teamId, context.teamId),
         }),
         () => WebAppError.internal("Falha ao listar assinaturas."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getContactSubscriptions = protectedProcedure
   .input(contactIdInputSchema)
   .use(requireContact, (input) => input.contactId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.contactSubscriptions.findMany({
            where: (f, { eq }) => eq(f.contactId, input.contactId),
            orderBy: (f, { desc }) => [desc(f.createdAt)],
         }),
         () => WebAppError.internal("Falha ao listar assinaturas do contato."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const createSubscription = billableProcedure
   .input(createSubscriptionWithItemsInputSchema)
   .use(requireContact, (input) => input.contactId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const { items, trialEndsAt, ...subscriptionData } = input;
            const [row] = await tx
               .insert(contactSubscriptions)
               .values({
                  ...subscriptionData,
                  trialEndsAt: trialEndsAt ? dayjs(trialEndsAt).toDate() : null,
                  teamId: context.teamId,
                  cancelAtPeriodEnd: false,
               })
               .returning();
            if (!row) return undefined;

            if (items && items.length > 0) {
               await Promise.all(
                  items.map((item) =>
                     tx
                        .insert(subscriptionItems)
                        .values({
                           ...item,
                           subscriptionId: row.id,
                           teamId: context.teamId,
                        })
                        .returning(),
                  ),
               );
            }

            return row;
         }),
         () => WebAppError.internal("Falha ao criar assinatura."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar assinatura: insert vazio.");
      const sub = result.value;

      if (sub.status === "trialing" && sub.trialEndsAt) {
         enqueueTrialExpiryWorkflow(context.workflowClient, {
            teamId: sub.teamId,
            subscriptionId: sub.id,
            trialEndsAt: sub.trialEndsAt.toISOString(),
         }).catch((e) =>
            logger.error(
               { err: e, subscriptionId: sub.id },
               "Falha ao enfileirar workflow de trial",
            ),
         );
      } else if (input.items && input.items.length > 0) {
         const priceIds = input.items.map((i) => i.priceId);
         const prices = await context.db.query.servicePrices.findMany({
            where: (f, { inArray }) => inArray(f.id, priceIds),
         });
         const uniqueServiceIds = Array.from(
            new Set(prices.map((p) => p.serviceId)),
         );
         for (const serviceId of uniqueServiceIds) {
            enqueueBenefitLifecycleWorkflow(context.workflowClient, {
               teamId: sub.teamId,
               subscriptionId: sub.id,
               serviceId,
               newStatus: sub.status,
            }).catch((e) =>
               logger.error(
                  { err: e, subscriptionId: sub.id, serviceId },
                  "Falha ao enfileirar workflow de benefícios",
               ),
            );
         }

         const firstPrice = prices[0];
         if (firstPrice && firstPrice.interval !== "one_time") {
            const now = dayjs();
            const periodEnd =
               firstPrice.interval === "hourly"
                  ? now.add(1, "hour")
                  : firstPrice.interval === "monthly"
                    ? now.add(1, "month")
                    : firstPrice.interval === "annual"
                      ? now.add(1, "year")
                      : null;
            if (periodEnd) {
               const delaySeconds = Math.max(
                  0,
                  Math.floor(periodEnd.diff(now) / 1000),
               );
               const contact = await context.db.query.contacts.findFirst({
                  where: (f, { eq }) => eq(f.id, sub.contactId),
               });
               enqueuePeriodEndInvoiceWorkflow(
                  context.workflowClient,
                  {
                     teamId: sub.teamId,
                     subscriptionId: sub.id,
                     periodStart: now.toISOString(),
                     periodEnd: periodEnd.toISOString(),
                     contactEmail: contact?.email ?? undefined,
                     contactName: contact?.name ?? undefined,
                  },
                  { delaySeconds },
               ).catch((e) =>
                  logger.error(
                     { err: e, subscriptionId: sub.id },
                     "Falha ao enfileirar workflow de fatura",
                  ),
               );
            }
         }
      }

      return sub;
   });

export const cancelSubscription = protectedProcedure
   .input(idInputSchema)
   .use(requireSubscription, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { subscription } = context;

      if (!["active", "trialing", "incomplete"].includes(subscription.status))
         throw WebAppError.badRequest(
            "Apenas assinaturas ativas, em trial ou incompletas podem ser canceladas.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [updated] = await tx
               .update(contactSubscriptions)
               .set({ status: "cancelled", updatedAt: dayjs().toDate() })
               .where(eq(contactSubscriptions.id, input.id))
               .returning();
            return updated;
         }),
         () => WebAppError.internal("Falha ao cancelar assinatura."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao cancelar assinatura: update vazio.",
         );
      const cancelled = result.value;

      const items = await context.db.query.subscriptionItems.findMany({
         where: (f, { eq }) => eq(f.subscriptionId, cancelled.id),
         with: { price: true },
      });

      const uniqueServiceIds = Array.from(
         new Set(
            items
               .map((i) => i.price?.serviceId)
               .filter((s): s is string => Boolean(s)),
         ),
      );

      for (const serviceId of uniqueServiceIds) {
         enqueueBenefitLifecycleWorkflow(context.workflowClient, {
            teamId: cancelled.teamId,
            subscriptionId: cancelled.id,
            serviceId,
            newStatus: "cancelled",
            previousStatus: subscription.status,
         }).catch((e) =>
            logger.error(
               { err: e, subscriptionId: cancelled.id, serviceId },
               "Falha ao enfileirar workflow de benefícios",
            ),
         );
      }

      return cancelled;
   });

export const getExpiringSoon = protectedProcedure
   .input(listExpiringSoonInputSchema)
   .handler(async ({ context, input }) => {
      const now = dayjs().format("YYYY-MM-DD");
      const futureDate = dayjs().add(30, "day").format("YYYY-MM-DD");
      const result = await fromPromise(
         context.db.query.contactSubscriptions.findMany({
            where: (f, { eq, and, gte, lte }) =>
               and(
                  eq(f.teamId, context.teamId),
                  eq(f.status, input?.status ?? "active"),
                  gte(f.endDate, now),
                  lte(f.endDate, futureDate),
               ),
         }),
         () => WebAppError.internal("Falha ao listar assinaturas expirando."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

// --- Meters ---

export const createMeter = billableProcedure
   .input(createMeterSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(meters)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar medidor."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar medidor: insert vazio.");
      return result.value;
   });

export const getMeters = protectedProcedure.handler(async ({ context }) => {
   const result = await fromPromise(
      context.db.query.meters.findMany({
         where: (f, { eq }) => eq(f.teamId, context.teamId),
         orderBy: (f, { asc }) => [asc(f.name)],
      }),
      () => WebAppError.internal("Falha ao listar medidores."),
   );
   if (result.isErr()) throw result.error;
   return result.value;
});

export const getMeterById = protectedProcedure
   .input(idInputSchema)
   .use(requireMeter, (input) => input.id)
   .handler(({ context }) => context.meter);

export const updateMeterById = protectedProcedure
   .input(updateMeterInputSchema)
   .use(requireMeter, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(meters)
               .set(data)
               .where(eq(meters.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar medidor."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar medidor: update vazio.",
         );
      return result.value;
   });

export const removeMeter = protectedProcedure
   .input(idInputSchema)
   .use(requireMeter, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(meters).where(eq(meters.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir medidor."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

// --- Benefits ---

export const createBenefit = billableProcedure
   .input(createBenefitSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .insert(benefits)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao criar benefício."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao criar benefício: insert vazio.");
      return result.value;
   });

export const getBenefits = protectedProcedure.handler(async ({ context }) => {
   const rows = await context.db
      .select({
         id: benefits.id,
         teamId: benefits.teamId,
         name: benefits.name,
         type: benefits.type,
         meterId: benefits.meterId,
         creditAmount: benefits.creditAmount,
         description: benefits.description,
         isActive: benefits.isActive,
         createdAt: benefits.createdAt,
         updatedAt: benefits.updatedAt,
         usedInServices: count(serviceBenefits.serviceId),
      })
      .from(benefits)
      .leftJoin(serviceBenefits, eq(benefits.id, serviceBenefits.benefitId))
      .where(eq(benefits.teamId, context.teamId))
      .groupBy(benefits.id)
      .orderBy(asc(benefits.name));
   return rows;
});

export const getBenefitById = protectedProcedure
   .input(idInputSchema)
   .use(requireBenefit, (input) => input.id)
   .handler(({ context }) => context.benefit);

export const updateBenefitById = protectedProcedure
   .input(updateBenefitInputSchema)
   .use(requireBenefit, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(benefits)
               .set(data)
               .where(eq(benefits.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar benefício."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal(
            "Falha ao atualizar benefício: update vazio.",
         );
      return result.value;
   });

export const removeBenefit = protectedProcedure
   .input(idInputSchema)
   .use(requireBenefit, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx.delete(benefits).where(eq(benefits.id, input.id));
         }),
         () => WebAppError.internal("Falha ao excluir benefício."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const attachBenefit = protectedProcedure
   .input(serviceBenefitLinkSchema)
   .use(requireService, (input) => input.serviceId)
   .use(requireBenefit, (input) => input.benefitId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .insert(serviceBenefits)
               .values({
                  serviceId: input.serviceId,
                  benefitId: input.benefitId,
               })
               .onConflictDoNothing();
         }),
         () => WebAppError.internal("Falha ao associar benefício ao serviço."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const detachBenefit = protectedProcedure
   .input(serviceBenefitLinkSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(serviceBenefits)
               .where(
                  and(
                     eq(serviceBenefits.serviceId, input.serviceId),
                     eq(serviceBenefits.benefitId, input.benefitId),
                  ),
               );
         }),
         () => WebAppError.internal("Falha ao remover benefício do serviço."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const getServiceBenefits = protectedProcedure
   .input(serviceIdInputSchema)
   .use(requireService, (input) => input.serviceId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.serviceBenefits.findMany({
            where: (f, { eq }) => eq(f.serviceId, input.serviceId),
            with: { benefit: true },
         }),
         () => WebAppError.internal("Falha ao listar benefícios do serviço."),
      );
      if (result.isErr()) throw result.error;
      return result.value.map((r) => r.benefit);
   });

// --- Usage / metrics ---

export const ingestUsage = billableProcedure
   .input(upsertUsageEventSchema)
   .handler(async ({ context, input }) => {
      if (input.teamId !== context.teamId)
         throw WebAppError.forbidden(
            "Você não tem permissão para registrar uso neste time.",
         );

      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .insert(usageEvents)
               .values({
                  teamId: input.teamId,
                  meterId: input.meterId,
                  quantity: input.quantity,
                  idempotencyKey: input.idempotencyKey,
                  contactId: input.contactId,
                  properties: input.properties ?? {},
               })
               .onConflictDoNothing({
                  target: [usageEvents.teamId, usageEvents.idempotencyKey],
               });
         }),
         () => WebAppError.internal("Falha ao registrar evento de uso."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const getMrr = protectedProcedure.handler(async ({ context }) => {
   const rows = await context.db
      .select({
         total: sum(
            sql<string>`
  CASE ${servicePrices.interval}
    WHEN 'monthly' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric
    WHEN 'annual' THEN COALESCE(${subscriptionItems.negotiatedPrice}, ${servicePrices.basePrice})::numeric * ${subscriptionItems.quantity}::numeric / 12
    ELSE 0::numeric
  END
`,
         ),
      })
      .from(subscriptionItems)
      .innerJoin(servicePrices, eq(subscriptionItems.priceId, servicePrices.id))
      .innerJoin(
         contactSubscriptions,
         eq(subscriptionItems.subscriptionId, contactSubscriptions.id),
      )
      .where(
         and(
            eq(subscriptionItems.teamId, context.teamId),
            eq(contactSubscriptions.status, "active"),
         ),
      );
   return { mrr: rows[0]?.total ?? "0" };
});

export const getActiveCountByPrice = protectedProcedure
   .input(priceIdInputSchema)
   .handler(async ({ context, input }) => {
      const rows = await context.db
         .select({ count: count() })
         .from(subscriptionItems)
         .innerJoin(
            contactSubscriptions,
            eq(subscriptionItems.subscriptionId, contactSubscriptions.id),
         )
         .where(
            and(
               eq(subscriptionItems.priceId, input.priceId),
               eq(subscriptionItems.teamId, context.teamId),
               eq(contactSubscriptions.status, "active"),
            ),
         );
      return { count: rows[0]?.count ?? 0 };
   });

// --- Subscription items ---

export const addItem = protectedProcedure
   .input(createSubscriptionItemSchema)
   .use(requireSubscription, (input) => input.subscriptionId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const lock = await tx.execute(
               sql`SELECT id FROM crm.contact_subscriptions WHERE id = ${input.subscriptionId} AND team_id = ${context.teamId} FOR UPDATE`,
            );
            if (lock.rows.length === 0) return "notFound" as const;

            const [countRow] = await tx
               .select({ itemCount: count() })
               .from(subscriptionItems)
               .where(
                  eq(subscriptionItems.subscriptionId, input.subscriptionId),
               );
            if ((countRow?.itemCount ?? 0) >= MAX_ITEMS_PER_SUBSCRIPTION)
               return "limit" as const;

            const [row] = await tx
               .insert(subscriptionItems)
               .values({ ...input, teamId: context.teamId })
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao adicionar item."),
      );
      if (result.isErr()) throw result.error;
      if (result.value === "notFound")
         throw WebAppError.notFound("Assinatura não encontrada.");
      if (result.value === "limit")
         throw WebAppError.badRequest(
            `Limite de ${MAX_ITEMS_PER_SUBSCRIPTION} itens por assinatura atingido.`,
         );
      if (!result.value)
         throw WebAppError.internal("Falha ao adicionar item: insert vazio.");
      return result.value;
   });

export const updateItem = protectedProcedure
   .input(updateSubscriptionItemInputSchema)
   .use(requireSubscriptionItem, (input) => input.id)
   .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            const [row] = await tx
               .update(subscriptionItems)
               .set(data)
               .where(eq(subscriptionItems.id, id))
               .returning();
            return row;
         }),
         () => WebAppError.internal("Falha ao atualizar item."),
      );
      if (result.isErr()) throw result.error;
      if (!result.value)
         throw WebAppError.internal("Falha ao atualizar item: update vazio.");
      return result.value;
   });

export const removeItem = protectedProcedure
   .input(idInputSchema)
   .use(requireSubscriptionItem, (input) => input.id)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.transaction(async (tx) => {
            await tx
               .delete(subscriptionItems)
               .where(eq(subscriptionItems.id, input.id));
         }),
         () => WebAppError.internal("Falha ao remover item."),
      );
      if (result.isErr()) throw result.error;
      return { success: true as const };
   });

export const listItems = protectedProcedure
   .input(subscriptionIdInputSchema)
   .use(requireSubscription, (input) => input.subscriptionId)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.subscriptionItems.findMany({
            where: (f, { eq }) => eq(f.subscriptionId, input.subscriptionId),
            orderBy: (f, { asc }) => [asc(f.createdAt)],
         }),
         () => WebAppError.internal("Falha ao listar itens da assinatura."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });
