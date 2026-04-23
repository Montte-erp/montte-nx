import { DBOS } from "@dbos-inc/dbos-sdk";
import dayjs from "dayjs";
import {
   of,
   add,
   subtract,
   multiply,
   percentage,
   zero,
   greaterThan,
   toMajorUnitsString,
} from "@f-o-t/money";
import { createEnqueuer, QUEUES } from "@packages/workflows/workflow-factory";
import { getSubscription } from "@modules/billing/db/subscriptions";
import { createInvoice } from "@modules/billing/db/invoices";
import { listGrantsBySubscription } from "@modules/billing/db/benefit-grants";
import { summarizeUsageByMeter } from "@modules/billing/db/usage-events";
import { listSubscriptionItems } from "@modules/billing/db/subscription-items";
import { listServicePricesByIds } from "@modules/services/db/services";
import { listBenefitsByIds } from "@modules/services/db/benefits";
import {
   getCoupon,
   countCouponRedemptionsBySubscription,
} from "@modules/services/db/coupons";
import type { Coupon } from "@core/database/schemas/coupons";
import type { InvoiceLineItem } from "@core/database/schemas/invoices";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "@packages/workflows/context";

export type PeriodEndInvoiceInput = {
   teamId: string;
   subscriptionId: string;
   periodStart: string;
   periodEnd: string;
   operatorEmail: string;
   contactEmail?: string;
   contactName?: string;
   emailFrom?: string;
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

         const items = await listSubscriptionItems(
            db,
            input.subscriptionId,
         ).match(
            (v) => v,
            (e) => {
               throw e;
            },
         );

         const priceIds = items.map((i) => i.priceId);
         const prices = await listServicePricesByIds(db, priceIds).match(
            (v) => v,
            (e) => {
               throw e;
            },
         );

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
         const activeBenefits = await listBenefitsByIds(db, benefitIds).match(
            (v) => v,
            (e) => {
               throw e;
            },
         );

         let coupon: Coupon | null = null;
         let redemptionCount = 0;

         if (sub.couponId) {
            coupon = await getCoupon(db, sub.couponId).match(
               (v) => v,
               (e) => {
                  throw e;
               },
            );

            if (coupon) {
               redemptionCount = await countCouponRedemptionsBySubscription(
                  db,
                  coupon.id,
                  input.subscriptionId,
               ).match(
                  (v) => v,
                  (e) => {
                     throw e;
                  },
               );
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
                  ? of(item.negotiatedPrice, "BRL")
                  : of(price.basePrice, "BRL");

            let quantity = item.quantity;

            if (price.type === "metered" && price.meterId) {
               const usageTotal = Number(usageMap.get(price.meterId) ?? "0");
               const creditBenefit = activeBenefits.find(
                  (b) => b.type === "credits" && b.meterId === price.meterId,
               );
               const creditAmount = creditBenefit?.creditAmount ?? 0;
               quantity = Math.max(0, usageTotal - creditAmount);
            }

            let subtotalForItem = multiply(unitPrice, quantity);

            if (price.priceCap != null) {
               const cap = of(price.priceCap, "BRL");
               if (greaterThan(subtotalForItem, cap)) {
                  subtotalForItem = cap;
               }
            }

            lineItems.push({
               description: price.name,
               meterId: price.meterId ?? null,
               quantity: quantity.toFixed(2),
               unitPrice: toMajorUnitsString(unitPrice),
               subtotal: toMajorUnitsString(subtotalForItem),
            });
         }

         const subtotalMoney = lineItems.reduce(
            (sum, li) => add(sum, of(li.subtotal, "BRL")),
            zero("BRL"),
         );

         let discountMoney = zero("BRL");
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
               discountMoney =
                  coupon.type === "percent"
                     ? percentage(subtotalMoney, Number(coupon.amount))
                     : of(coupon.amount, "BRL");

               couponSnapshot = {
                  code: coupon.code,
                  type: coupon.type,
                  amount: coupon.amount,
                  duration: coupon.duration,
               };
            }
         }

         const rawTotal = subtract(subtotalMoney, discountMoney);
         const totalMoney = greaterThan(rawTotal, zero("BRL"))
            ? rawTotal
            : zero("BRL");

         return {
            lineItems,
            subtotal: toMajorUnitsString(subtotalMoney),
            discountAmount: toMajorUnitsString(discountMoney),
            total: toMajorUnitsString(totalMoney),
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
            currency: "BRL",
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
               currency: "BRL",
            },
         } satisfies JobNotification),
      { name: "publishNotification" },
   );

   await DBOS.runStep(
      () =>
         resendClient.emails.send({
            from: input.emailFrom ?? "Montte <suporte@mail.montte.co>",
            to: input.operatorEmail,
            subject: `Fatura gerada — ${dayjs(input.periodEnd).format("MM/YYYY")}`,
            text: `Fatura ${invoice.id} gerada para o período ${dayjs(input.periodStart).format("DD/MM/YYYY")} a ${dayjs(input.periodEnd).format("DD/MM/YYYY")}.\nTotal: R$ ${computation.total}`,
         }),
      { name: "sendOperatorEmail" },
   );

   const { contactEmail, contactName } = input;
   if (contactEmail) {
      await DBOS.runStep(
         () =>
            resendClient.emails.send({
               from: input.emailFrom ?? "Montte <suporte@mail.montte.co>",
               to: contactEmail,
               subject: `Sua fatura — ${dayjs(input.periodEnd).format("MM/YYYY")}`,
               text: `Olá${contactName ? `, ${contactName}` : ""}!\n\nSua fatura para o período ${dayjs(input.periodStart).format("DD/MM/YYYY")} a ${dayjs(input.periodEnd).format("DD/MM/YYYY")} foi gerada.\nTotal: R$ ${computation.total}`,
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
