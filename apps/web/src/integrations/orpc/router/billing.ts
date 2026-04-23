import dayjs from "dayjs";
import { fromPromise } from "neverthrow";
import { eventCatalog } from "@core/database/schemas/event-catalog";
import { WebAppError } from "@core/logging/errors";
import {
   EVENT_PRICES,
   FREE_TIER_LIMITS,
   STRIPE_METER_EVENTS,
} from "@core/stripe/constants";
import { getAllUsage } from "@packages/events/credits";
import { z } from "zod";

import { protectedProcedure } from "../server";

export const getInvoices = protectedProcedure
   .input(
      z
         .object({
            limit: z.number().min(1).max(100).optional().default(10),
         })
         .optional(),
   )
   .handler(async ({ context, input }) => {
      const { db, stripeClient, userId } = context;

      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });

      if (!userRecord?.stripeCustomerId) {
         return [];
      }

      const result = await fromPromise(
         stripeClient.invoices.list({
            customer: userRecord.stripeCustomerId,
            limit: input?.limit ?? 10,
         }),
         () => WebAppError.internal("Failed to fetch invoices"),
      );

      return result.match(
         (invoices) =>
            invoices.data.map((invoice) => ({
               id: invoice.id,
               number: invoice.number,
               amountPaid: invoice.amount_paid,
               amountDue: invoice.amount_due,
               currency: invoice.currency,
               status: invoice.status,
               created: invoice.created,
               periodStart: invoice.period_start,
               periodEnd: invoice.period_end,
               invoicePdf: invoice.invoice_pdf ?? null,
               hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
            })),
         (e) => {
            throw e;
         },
      );
   });

export const getUpcomingInvoice = protectedProcedure.handler(
   async ({ context }) => {
      const { db, stripeClient, userId } = context;

      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });

      if (!userRecord?.stripeCustomerId) {
         return null;
      }

      const result = await fromPromise(
         stripeClient.invoices.createPreview({
            customer: userRecord.stripeCustomerId,
         }),
         () => null,
      );

      return result.match(
         (upcoming) => ({
            amountDue: upcoming.amount_due,
            currency: upcoming.currency,
            periodStart: upcoming.period_start,
            periodEnd: upcoming.period_end,
            nextPaymentAttempt: upcoming.next_payment_attempt,
            lines: upcoming.lines.data.map((line) => ({
               description: line.description,
               amount: line.amount,
               quantity: line.quantity,
            })),
         }),
         () => null,
      );
   },
);

export const getPaymentStatus = protectedProcedure.handler(
   async ({ context }) => {
      const { db, stripeClient, userId } = context;

      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });

      if (!userRecord?.stripeCustomerId) {
         return { hasPaymentMethod: false };
      }

      const result = await fromPromise(
         stripeClient.paymentMethods.list({
            customer: userRecord.stripeCustomerId,
            type: "card",
            limit: 1,
         }),
         () => null,
      );

      return result.match(
         (paymentMethods) => ({
            hasPaymentMethod: paymentMethods.data.length > 0,
         }),
         () => ({ hasPaymentMethod: false }),
      );
   },
);

export const getMeterUsage = protectedProcedure.handler(async ({ context }) => {
   const { db, stripeClient, userId } = context;

   const userRecord = await db.query.user.findFirst({
      where: (fields, { eq }) => eq(fields.id, userId),
   });

   if (!userRecord?.stripeCustomerId) {
      return buildUsageFallback();
   }

   const now = Math.floor(Date.now() / 1000);
   const startOfMonth = Math.floor(dayjs().startOf("month").valueOf() / 1000);

   const metersResult = await fromPromise(
      stripeClient.billing.meters.list({ limit: 100 }),
      () => WebAppError.internal("Failed to fetch meter usage"),
   );

   if (metersResult.isErr()) throw metersResult.error;

   const meterByEventName = new Map(
      metersResult.value.data.map((m) => [m.event_name, m.id]),
   );

   const entries = Object.entries(STRIPE_METER_EVENTS);
   const concurrency = 5;
   const results: Array<{
      eventName: string;
      used: number;
      freeTierLimit: number;
      pricePerEvent: string;
   }> = [];

   for (let i = 0; i < entries.length; i += concurrency) {
      const batch = entries.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
         batch.map(async ([eventName, meterEventName]) => {
            const meterId = meterByEventName.get(meterEventName);
            if (!meterId) {
               return {
                  eventName,
                  used: 0,
                  freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
                  pricePerEvent: EVENT_PRICES[eventName] ?? "0",
               };
            }
            const summary =
               await stripeClient.billing.meters.listEventSummaries(meterId, {
                  customer: userRecord.stripeCustomerId!,
                  start_time: startOfMonth,
                  end_time: now,
                  value_grouping_window: "day",
                  limit: 31,
               });
            const used = summary.data.reduce(
               (sum, s) => sum + s.aggregated_value,
               0,
            );
            return {
               eventName,
               used,
               freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
               pricePerEvent: EVENT_PRICES[eventName] ?? "0",
            };
         }),
      );
      for (const [j, result] of batchResults.entries()) {
         const eventName = batch[j]![0];
         if (result.status === "rejected") {
            results.push({
               eventName,
               used: 0,
               freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
               pricePerEvent: EVENT_PRICES[eventName] ?? "0",
            });
         } else {
            results.push(result.value);
         }
      }
   }

   return results;
});

export const getEventCatalog = protectedProcedure.handler(
   async ({ context }) => {
      const { db } = context;
      const result = await fromPromise(
         db
            .select()
            .from(eventCatalog)
            .orderBy(eventCatalog.category, eventCatalog.displayName),
         () => WebAppError.internal("Failed to fetch event catalog"),
      );
      return result.match(
         (rows) => rows,
         (e) => {
            throw e;
         },
      );
   },
);

export const getUsageSummary = protectedProcedure.handler(
   async ({ context }) => {
      const { db, redis, organizationId, userId } = context;

      const userRecord = await db.query.user.findFirst({
         where: (fields, { eq }) => eq(fields.id, userId),
      });

      const stripeCustomerId = userRecord?.stripeCustomerId ?? null;

      const usageMap = await getAllUsage(organizationId, redis);

      return Object.entries(FREE_TIER_LIMITS).map(
         ([eventName, freeTierLimit]) => {
            const used = usageMap[eventName] ?? 0;
            return {
               eventName,
               used,
               freeTierLimit,
               pricePerEvent: EVENT_PRICES[eventName] ?? "0",
               overageEnabled: !!stripeCustomerId,
               withinFreeTier: used < freeTierLimit,
            };
         },
      );
   },
);

function buildUsageFallback() {
   return Object.keys(FREE_TIER_LIMITS).map((eventName) => ({
      eventName,
      used: 0,
      freeTierLimit: FREE_TIER_LIMITS[eventName] ?? 0,
      pricePerEvent: EVENT_PRICES[eventName] ?? "0",
   }));
}
