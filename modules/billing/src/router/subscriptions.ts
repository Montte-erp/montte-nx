import dayjs from "dayjs";
import { and, count, eq, sql, sum } from "drizzle-orm";
import { fromPromise } from "neverthrow";
import { billingContract } from "@montte/hyprpay/contract";
import { implementerInternal } from "@orpc/server";
import { servicePrices } from "@core/database/schemas/services";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import { WebAppError } from "@core/logging/errors";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "@core/orpc/server";
import type {
   ORPCContext,
   ORPCContextWithOrganization,
} from "@core/orpc/server";
import { enqueueBenefitLifecycleWorkflow } from "../workflows/benefit-lifecycle-workflow";
import { enqueuePeriodEndInvoiceWorkflow } from "../workflows/period-end-invoice-workflow";
import { enqueueTrialExpiryWorkflow } from "../workflows/trial-expiry-workflow";
import {
   listSubscriptionsInputSchema,
   listExpiringSoonInputSchema,
   priceIdInputSchema,
   subscriptionIdInputSchema,
} from "../contracts/services";
import {
   requireContact,
   requireSubscription,
   requireSubscriptionItem,
} from "./middlewares";

const logger = getLogger().child({ module: "billing/subscriptions" });
const MAX_ITEMS_PER_SUBSCRIPTION = 20;

const def = protectedProcedure["~orpc"];
const impl = implementerInternal<
   typeof billingContract.services,
   ORPCContext,
   ORPCContextWithOrganization
>(billingContract.services, def.config, [...def.middlewares]);

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

export const getContactSubscriptions = impl.getContactSubscriptions
   .use(requireContact, (input) => ({ contactId: input.contactId }))
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

export const createSubscription = impl.createSubscription
   .use(requireContact, (input) => ({ contactId: input.contactId }))
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
            organizationId: context.organizationId,
            subscriptionId: sub.id,
            trialEndsAt: sub.trialEndsAt.toISOString(),
            contactEmail: context.contact.email ?? undefined,
            contactName: context.contact.name,
            contactExternalId: context.contact.externalId,
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
               organizationId: context.organizationId,
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
                     organizationId: context.organizationId,
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

export const cancelSubscription = impl.cancelSubscription
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
            organizationId: context.organizationId,
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

export const addItem = impl.addItem
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

export const updateItem = impl.updateItem
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

export const removeItem = impl.removeItem
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
