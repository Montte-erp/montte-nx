import dayjs from "dayjs";
import { and, count, eq, sql, sum } from "drizzle-orm";
import { errAsync, fromPromise, okAsync } from "neverthrow";
import { z } from "zod";
import { advanceByBillingInterval } from "@core/utils/date";
import { servicePrices } from "@core/database/schemas/services";
import {
   createSubscriptionItemSchema,
   subscriptionItems,
} from "@core/database/schemas/subscription-items";
import {
   contactSubscriptions,
   createSubscriptionSchema,
   subscriptionStatusEnum,
} from "@core/database/schemas/subscriptions";
import { WebAppError } from "@core/logging/errors";
import { getLogger } from "@core/logging/root";
import { protectedProcedure } from "@core/orpc/server";
import { enqueueBenefitLifecycleWorkflow } from "@modules/billing/workflows/benefit-lifecycle-workflow";
import { enqueuePeriodEndInvoiceWorkflow } from "@modules/billing/workflows/period-end-invoice-workflow";
import { enqueueTrialExpiryWorkflow } from "@modules/billing/workflows/trial-expiry-workflow";
import {
   requireContact,
   requireSubscription,
} from "@modules/billing/router/middlewares";

const logger = getLogger().child({ module: "billing/subscriptions" });

const subscriptionItemInputSchema = createSubscriptionItemSchema.omit({
   subscriptionId: true,
});

const createSubscriptionInputSchema = createSubscriptionSchema
   .extend({
      status: z.enum(["active", "trialing"]).default("active"),
      trialEndsAt: z.string().datetime().nullable().optional(),
      items: z.array(subscriptionItemInputSchema).optional(),
   })
   .superRefine((data, ctx) => {
      if (data.status === "trialing" && !data.trialEndsAt) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "trialEndsAt obrigatório para status 'trialing'.",
            path: ["trialEndsAt"],
         });
      }
   });

const listInputSchema = z
   .object({
      status: z.enum(subscriptionStatusEnum.enumValues).optional(),
   })
   .optional();

const expiringSoonInputSchema = z
   .object({
      status: z.enum(["active", "trialing"]).optional().default("active"),
   })
   .optional();

const idInputSchema = z.object({ id: z.string().uuid() });
const priceIdInputSchema = z.object({ priceId: z.string().uuid() });
const contactIdInputSchema = z.object({ contactId: z.string().uuid() });

const ensureRow = <T>(row: T | undefined, message: string) =>
   row ? okAsync(row) : errAsync(WebAppError.internal(message));

const fireAndLog = (
   promise: Promise<unknown>,
   context: Record<string, unknown>,
   message: string,
) => {
   promise.catch((e) => logger.error({ ...context, err: e }, message));
};

export const getAllSubscriptions = protectedProcedure
   .input(listInputSchema)
   .handler(async ({ context, input }) => {
      const result = await fromPromise(
         context.db.query.contactSubscriptions.findMany({
            where: (f, { eq, and: andFn }) =>
               andFn(
                  eq(f.teamId, context.teamId),
                  input?.status ? eq(f.status, input.status) : undefined,
               ),
         }),
         () => WebAppError.internal("Falha ao listar assinaturas."),
      );
      if (result.isErr()) throw result.error;
      return result.value;
   });

export const getContactSubscriptions = protectedProcedure
   .input(contactIdInputSchema)
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

export const createSubscription = protectedProcedure
   .input(createSubscriptionInputSchema)
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
      ).andThen((row) =>
         ensureRow(row, "Falha ao criar assinatura: insert vazio."),
      );
      if (result.isErr()) throw result.error;
      const sub = result.value;

      if (sub.status === "trialing" && sub.trialEndsAt) {
         fireAndLog(
            enqueueTrialExpiryWorkflow(context.workflowClient, {
               teamId: sub.teamId,
               organizationId: context.organizationId,
               subscriptionId: sub.id,
               trialEndsAt: sub.trialEndsAt.toISOString(),
               contactEmail: context.contact.email ?? undefined,
               contactName: context.contact.name,
               contactExternalId: context.contact.externalId,
            }),
            { subscriptionId: sub.id },
            "Falha ao enfileirar workflow de trial",
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
            fireAndLog(
               enqueueBenefitLifecycleWorkflow(context.workflowClient, {
                  teamId: sub.teamId,
                  organizationId: context.organizationId,
                  subscriptionId: sub.id,
                  serviceId,
                  newStatus: sub.status,
               }),
               { subscriptionId: sub.id, serviceId },
               "Falha ao enfileirar workflow de benefícios",
            );
         }

         const firstPrice = prices[0];
         if (firstPrice && firstPrice.interval !== "one_time") {
            const now = dayjs();
            const periodEnd = advanceByBillingInterval(
               now,
               firstPrice.interval,
            );
            if (periodEnd) {
               const delaySeconds = Math.max(
                  0,
                  Math.floor(periodEnd.diff(now) / 1000),
               );
               const contact = await context.db.query.contacts.findFirst({
                  where: (f, { eq }) => eq(f.id, sub.contactId),
               });
               fireAndLog(
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
                  ),
                  { subscriptionId: sub.id },
                  "Falha ao enfileirar workflow de fatura",
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
      ).andThen((row) =>
         ensureRow(row, "Falha ao cancelar assinatura: update vazio."),
      );
      if (result.isErr()) throw result.error;
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
         fireAndLog(
            enqueueBenefitLifecycleWorkflow(context.workflowClient, {
               teamId: cancelled.teamId,
               organizationId: context.organizationId,
               subscriptionId: cancelled.id,
               serviceId,
               newStatus: "cancelled",
               previousStatus: subscription.status,
            }),
            { subscriptionId: cancelled.id, serviceId },
            "Falha ao enfileirar workflow de benefícios",
         );
      }

      return cancelled;
   });

export const getExpiringSoon = protectedProcedure
   .input(expiringSoonInputSchema)
   .handler(async ({ context, input }) => {
      const now = dayjs().format("YYYY-MM-DD");
      const futureDate = dayjs().add(30, "day").format("YYYY-MM-DD");
      const result = await fromPromise(
         context.db.query.contactSubscriptions.findMany({
            where: (f, { eq, and: andFn, gte, lte }) =>
               andFn(
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

export const getMrr = protectedProcedure.handler(async ({ context }) => {
   const rows = await context.db
      .select({
         total: sum(
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
