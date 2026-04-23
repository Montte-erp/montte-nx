import { DBOS } from "@dbos-inc/dbos-sdk";
import dayjs from "dayjs";
import { count, eq, inArray } from "drizzle-orm";
import { createEnqueuer, QUEUES } from "../../workflow-factory";
import { getSubscription } from "@core/database/repositories/subscriptions-repository";
import { createInvoice } from "@core/database/repositories/invoices-repository";
import { listGrantsBySubscription } from "@core/database/repositories/benefit-grants-repository";
import { summarizeUsageByMeter } from "@core/database/repositories/usage-events-repository";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { servicePrices } from "@core/database/schemas/services";
import { benefits } from "@core/database/schemas/benefits";
import { coupons, couponRedemptions } from "@core/database/schemas/coupons";
import type { InvoiceLineItem } from "@core/database/schemas/invoices";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../../context";

export type PeriodEndInvoiceInput = {
   teamId: string;
   subscriptionId: string;
   periodStart: string;
   periodEnd: string;
   operatorEmail: string;
   contactEmail?: string;
   contactName?: string;
};

async function periodEndInvoiceWorkflowFn(input: PeriodEndInvoiceInput) {
   const { db, resendClient } = getDeps();
   const publisher = getPublisher();
   const ctx = `[period-end-invoice] sub=${input.subscriptionId} team=${input.teamId}`;

   DBOS.logger.info(
      `${ctx} started period=${input.periodStart}/${input.periodEnd}`,
   );

   const invoiceData = await DBOS.runStep(
      async () => {
         const sub = await getSubscription(db, input.subscriptionId).match(
            (v) => v,
            (e) => {
               throw e;
            },
         );
         if (!sub)
            throw new Error(
               `Assinatura ${input.subscriptionId} não encontrada.`,
            );

         const items = await db.query.subscriptionItems.findMany({
            where: (fields, { eq: eqFn }) =>
               eqFn(fields.subscriptionId, input.subscriptionId),
         });

         const priceIds = items.map((i) => i.priceId);
         const prices =
            priceIds.length > 0
               ? await db
                    .select()
                    .from(servicePrices)
                    .where(inArray(servicePrices.id, priceIds))
               : [];

         const usageSummary = await summarizeUsageByMeter(db, input.teamId, {
            from: dayjs(input.periodStart).toDate(),
            to: dayjs(input.periodEnd).toDate(),
         }).match(
            (v) => v,
            (e) => {
               throw e;
            },
         );

         const grants = await listGrantsBySubscription(
            db,
            input.subscriptionId,
         ).match(
            (v) => v,
            (e) => {
               throw e;
            },
         );

         const activeGrants = grants.filter((g) => g.status === "active");
         const benefitIds = activeGrants.map((g) => g.benefitId);
         const activeBenefits =
            benefitIds.length > 0
               ? await db
                    .select()
                    .from(benefits)
                    .where(inArray(benefits.id, benefitIds))
               : [];

         let coupon: typeof coupons.$inferSelect | null = null;
         let redemptionCount = 0;

         if (sub.couponId) {
            const [couponRow] = await db
               .select()
               .from(coupons)
               .where(eq(coupons.id, sub.couponId));
            coupon = couponRow ?? null;

            if (coupon) {
               const [countRow] = await db
                  .select({ count: count() })
                  .from(couponRedemptions)
                  .where(
                     eq(couponRedemptions.subscriptionId, input.subscriptionId),
                  );
               redemptionCount = countRow?.count ?? 0;
            }
         }

         return {
            sub,
            items,
            prices,
            usageSummary,
            activeBenefits,
            coupon,
            redemptionCount,
         };
      },
      { name: "gatherInvoiceData" },
   );

   const computation = await DBOS.runStep(
      async () => {
         const {
            items,
            prices,
            usageSummary,
            activeBenefits,
            coupon,
            redemptionCount,
         } = invoiceData;

         const priceMap = new Map(prices.map((p) => [p.id, p]));
         const usageMap = new Map(
            usageSummary.map((u) => [u.meterId, u.total]),
         );

         const lineItems: InvoiceLineItem[] = [];

         for (const item of items) {
            const price = priceMap.get(item.priceId);
            if (!price || !price.isActive) continue;

            const unitPrice =
               item.negotiatedPrice != null
                  ? Number(item.negotiatedPrice)
                  : Number(price.basePrice);

            let quantity = item.quantity;

            if (price.type === "metered" && price.meterId) {
               const usageTotal = Number(usageMap.get(price.meterId) ?? "0");
               const creditBenefit = activeBenefits.find(
                  (b) => b.type === "credits" && b.meterId === price.meterId,
               );
               const creditAmount = creditBenefit?.creditAmount ?? 0;
               quantity = Math.max(0, usageTotal - creditAmount);
            }

            let subtotal = quantity * unitPrice;

            if (price.priceCap != null) {
               subtotal = Math.min(subtotal, Number(price.priceCap));
            }

            lineItems.push({
               description: price.name,
               meterId: price.meterId ?? null,
               quantity: quantity.toFixed(2),
               unitPrice: unitPrice.toFixed(2),
               subtotal: subtotal.toFixed(2),
            });
         }

         const subtotalCents = lineItems.reduce(
            (sum, li) => sum + Number(li.subtotal),
            0,
         );

         let discountAmount = 0;
         let couponSnapshot: {
            code: string;
            type: string;
            amount: string;
            duration: string;
         } | null = null;

         if (coupon) {
            let applyDiscount = false;

            if (coupon.duration === "forever") {
               applyDiscount = true;
            } else if (coupon.duration === "once") {
               applyDiscount = redemptionCount === 0;
            } else if (coupon.duration === "repeating") {
               applyDiscount = redemptionCount < (coupon.durationMonths ?? 0);
            }

            if (applyDiscount) {
               discountAmount =
                  coupon.type === "percent"
                     ? subtotalCents * (Number(coupon.amount) / 100)
                     : Number(coupon.amount);

               couponSnapshot = {
                  code: coupon.code,
                  type: coupon.type,
                  amount: coupon.amount,
                  duration: coupon.duration,
               };
            }
         }

         const total = Math.max(0, subtotalCents - discountAmount);

         return {
            lineItems,
            subtotal: subtotalCents.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            total: total.toFixed(2),
            couponSnapshot,
         };
      },
      { name: "computeLineItems" },
   );

   const invoice = await DBOS.runStep(
      () =>
         createInvoice(db, {
            teamId: input.teamId,
            subscriptionId: input.subscriptionId,
            status: "open",
            periodStart: dayjs(input.periodStart).toDate(),
            periodEnd: dayjs(input.periodEnd).toDate(),
            subtotal: computation.subtotal,
            discountAmount: computation.discountAmount,
            total: computation.total,
            lineItems: computation.lineItems,
            couponSnapshot: computation.couponSnapshot,
         }).match(
            (v) => v,
            (e) => {
               throw e;
            },
         ),
      { name: "persistInvoice" },
   );

   await DBOS.runStep(
      () =>
         publisher.publish("job.notification", {
            jobId: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: NOTIFICATION_TYPES.BILLING_INVOICE_GENERATED,
            status: "completed",
            message: `Fatura gerada para assinatura ${input.subscriptionId}.`,
            teamId: input.teamId,
            payload: {
               invoiceId: invoice.id,
               subscriptionId: input.subscriptionId,
               total: computation.total,
            },
         } satisfies JobNotification),
      { name: "publishNotification" },
   );

   await DBOS.runStep(
      () =>
         resendClient.emails.send({
            from: "Montte <suporte@mail.montte.co>",
            to: input.operatorEmail,
            subject: `Fatura gerada — ${dayjs(input.periodEnd).format("MM/YYYY")}`,
            text: `Fatura ${invoice.id} gerada para o período ${dayjs(input.periodStart).format("DD/MM/YYYY")} a ${dayjs(input.periodEnd).format("DD/MM/YYYY")}.\nTotal: R$ ${computation.total}`,
         }),
      { name: "sendOperatorEmail" },
   );

   if (input.contactEmail) {
      await DBOS.runStep(
         () =>
            resendClient.emails.send({
               from: "Montte <suporte@mail.montte.co>",
               to: input.contactEmail!,
               subject: `Sua fatura — ${dayjs(input.periodEnd).format("MM/YYYY")}`,
               text: `Olá${input.contactName ? `, ${input.contactName}` : ""}!\n\nSua fatura para o período ${dayjs(input.periodStart).format("DD/MM/YYYY")} a ${dayjs(input.periodEnd).format("DD/MM/YYYY")} foi gerada.\nTotal: R$ ${computation.total}`,
            }),
         { name: "sendContactEmail" },
      );
   }

   DBOS.logger.info(
      `${ctx} completed — invoiceId=${invoice.id} total=${computation.total}`,
   );
}

export const periodEndInvoiceWorkflow = DBOS.registerWorkflow(
   periodEndInvoiceWorkflowFn,
);

export const enqueuePeriodEndInvoiceWorkflow =
   createEnqueuer<PeriodEndInvoiceInput>(
      periodEndInvoiceWorkflowFn.name,
      QUEUES.periodEndInvoice,
      (i) => `period-invoice-${i.subscriptionId}-${i.periodEnd}`,
   );
