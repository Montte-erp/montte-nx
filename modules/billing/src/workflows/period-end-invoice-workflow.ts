import { DBOS } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { and, count, eq, gte, lte, sum } from "drizzle-orm";
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
import { WorkflowError } from "@core/dbos/errors";
import { sendBillingInvoiceGenerated } from "@core/transactional/client";
import { couponRedemptions } from "@core/database/schemas/coupons";
import type { Coupon } from "@core/database/schemas/coupons";
import { invoices } from "@core/database/schemas/invoices";
import type { InvoiceLineItem } from "@core/database/schemas/invoices";
import { usageEvents } from "@core/database/schemas/usage-events";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { BILLING_QUEUES } from "../constants";
import {
   billingDataSource,
   getBillingPublisher,
   getBillingResendClient,
   createEnqueuer,
} from "./context";

export type PeriodEndInvoiceInput = {
   teamId: string;
   subscriptionId: string;
   periodStart: string;
   periodEnd: string;
   contactEmail?: string;
   contactName?: string;
   emailFrom?: string;
};

async function periodEndInvoiceWorkflowFn(input: PeriodEndInvoiceInput) {
   const publisher = getBillingPublisher();
   const ctx = `[period-end-invoice] sub=${input.subscriptionId} team=${input.teamId}`;

   DBOS.logger.info(
      `${ctx} running period=${input.periodStart}/${input.periodEnd}`,
   );

   const statusResult = await fromPromise(
      billingDataSource.runTransaction(
         async () => {
            const tx = billingDataSource.client;
            return (
               (await tx.query.contactSubscriptions.findFirst({
                  where: (f, { eq: eqFn }) => eqFn(f.id, input.subscriptionId),
               })) ?? null
            );
         },
         { name: "checkSubscriptionStatus" },
      ),
      (e) =>
         WorkflowError.database("Falha ao verificar status da assinatura.", {
            cause: e,
         }),
   );
   if (statusResult.isErr()) throw statusResult.error;
   const subStatus = statusResult.value;
   if (!subStatus)
      throw WorkflowError.notFound(
         `Assinatura ${input.subscriptionId} não encontrada.`,
      );
   if (subStatus.status === "cancelled" || subStatus.status === "completed") {
      DBOS.logger.info(
         `${ctx} subscription not billable — status=${subStatus.status} — skipping invoice`,
      );
      return;
   }

   const invoiceDataResult = await fromPromise(
      billingDataSource.runTransaction(
         async () => {
            const tx = billingDataSource.client;

            const sub = await tx.query.contactSubscriptions.findFirst({
               where: (f, { eq: eqFn }) => eqFn(f.id, input.subscriptionId),
            });
            if (!sub)
               throw WorkflowError.notFound(
                  `Assinatura ${input.subscriptionId} não encontrada.`,
               );

            const items = await tx.query.subscriptionItems.findMany({
               where: (f, { eq: eqFn }) =>
                  eqFn(f.subscriptionId, input.subscriptionId),
               orderBy: (f, { asc }) => [asc(f.createdAt)],
            });

            const priceIds = items.map((i) => i.priceId);
            const prices =
               priceIds.length === 0
                  ? []
                  : await tx.query.servicePrices.findMany({
                       where: (f, { inArray: inArrayFn }) =>
                          inArrayFn(f.id, priceIds),
                    });

            const usageSummary =
               priceIds.length === 0
                  ? []
                  : await tx
                       .select({
                          meterId: usageEvents.meterId,
                          total: sum(usageEvents.quantity),
                       })
                       .from(usageEvents)
                       .where(
                          and(
                             eq(usageEvents.teamId, input.teamId),
                             gte(
                                usageEvents.timestamp,
                                dayjs(input.periodStart).toDate(),
                             ),
                             lte(
                                usageEvents.timestamp,
                                dayjs(input.periodEnd).toDate(),
                             ),
                          ),
                       )
                       .groupBy(usageEvents.meterId);

            const grants = await tx.query.benefitGrants.findMany({
               where: (f, { eq: eqFn }) =>
                  eqFn(f.subscriptionId, input.subscriptionId),
            });

            const activeGrants = grants.filter((g) => g.status === "active");
            const benefitIds = activeGrants.map((g) => g.benefitId);
            const activeBenefits =
               benefitIds.length === 0
                  ? []
                  : await tx.query.benefits.findMany({
                       where: (f, { inArray: inArrayFn }) =>
                          inArrayFn(f.id, benefitIds),
                    });

            let coupon: Coupon | null = null;
            let redemptionCount = 0;

            if (sub.couponId) {
               coupon =
                  (await tx.query.coupons.findFirst({
                     where: (f, { eq: eqFn }) => eqFn(f.id, sub.couponId!),
                  })) ?? null;

               if (coupon) {
                  const [row] = await tx
                     .select({ count: count() })
                     .from(couponRedemptions)
                     .where(
                        and(
                           eq(couponRedemptions.couponId, coupon.id),
                           eq(
                              couponRedemptions.subscriptionId,
                              input.subscriptionId,
                           ),
                        ),
                     );
                  redemptionCount = row?.count ?? 0;
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
      ),
      (e) =>
         e instanceof WorkflowError
            ? e
            : WorkflowError.database("Falha ao buscar dados da fatura.", {
                 cause: e,
              }),
   );
   if (invoiceDataResult.isErr()) throw invoiceDataResult.error;
   const invoiceData = invoiceDataResult.value;

   const computationResult = await fromPromise(
      DBOS.runStep(
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
               usageSummary.map((u) => [u.meterId, u.total ?? "0"]),
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
               (s, li) => add(s, of(li.subtotal, "BRL")),
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
                  applyDiscount =
                     redemptionCount < (coupon.durationMonths ?? 0);
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
      ),
      (e) =>
         WorkflowError.internal("Falha ao computar itens da fatura.", {
            cause: e,
         }),
   );
   if (computationResult.isErr()) throw computationResult.error;
   const computation = computationResult.value;

   const invoiceResult = await fromPromise(
      billingDataSource.runTransaction(
         async () => {
            const tx = billingDataSource.client;
            const [row] = await tx
               .insert(invoices)
               .values({
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
               })
               .returning();
            if (!row) throw WorkflowError.database("Falha ao criar fatura.");
            return row;
         },
         { name: "persistInvoice" },
      ),
      (e) =>
         e instanceof WorkflowError
            ? e
            : WorkflowError.database("Falha ao persistir fatura.", {
                 cause: e,
              }),
   );
   if (invoiceResult.isErr()) throw invoiceResult.error;
   const invoice = invoiceResult.value;

   const publishResult = await fromPromise(
      DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: dayjs().toISOString(),
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
      ),
      (e) =>
         WorkflowError.internal("Falha ao publicar notificação de fatura.", {
            cause: e,
         }),
   );
   if (publishResult.isErr()) throw publishResult.error;

   const emailResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const resendClient = getBillingResendClient();
            const { contactEmail, contactName } = input;

            if (contactEmail) {
               await sendBillingInvoiceGenerated(resendClient, {
                  contactEmail,
                  contactName,
                  invoiceId: invoice.id,
                  periodStart: dayjs(input.periodStart).format("DD/MM/YYYY"),
                  periodEnd: dayjs(input.periodEnd).format("DD/MM/YYYY"),
                  total: computation.total,
                  from: input.emailFrom,
               });
            }
         },
         { name: "sendEmails" },
      ),
      (e) =>
         WorkflowError.internal("Falha ao enviar e-mails de fatura.", {
            cause: e,
         }),
   );
   if (emailResult.isErr()) throw emailResult.error;

   const nextPeriodResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const firstPrice = invoiceData.prices[0];
            if (!firstPrice) return null;

            const nextPeriodStart = dayjs(input.periodEnd);
            const nextPeriodEnd = (() => {
               if (firstPrice.interval === "hourly")
                  return nextPeriodStart.add(1, "hour");
               if (firstPrice.interval === "monthly")
                  return nextPeriodStart.add(1, "month");
               if (firstPrice.interval === "annual")
                  return nextPeriodStart.add(1, "year");
               return null;
            })();
            if (!nextPeriodEnd) return null;

            return {
               periodStart: nextPeriodStart.toISOString(),
               periodEnd: nextPeriodEnd.toISOString(),
            };
         },
         { name: "computeNextPeriod" },
      ),
      (e) =>
         WorkflowError.internal("Falha ao computar próximo período.", {
            cause: e,
         }),
   );
   if (nextPeriodResult.isErr()) throw nextPeriodResult.error;
   const nextPeriod = nextPeriodResult.value;

   if (nextPeriod) {
      const nextInput: PeriodEndInvoiceInput = {
         ...input,
         periodStart: nextPeriod.periodStart,
         periodEnd: nextPeriod.periodEnd,
      };
      const delaySeconds = Math.max(
         0,
         Math.floor(dayjs(nextPeriod.periodEnd).diff(dayjs()) / 1000),
      );
      await DBOS.startWorkflow(periodEndInvoiceWorkflow, {
         workflowID: `period-invoice-${input.subscriptionId}-${dayjs(nextPeriod.periodEnd).format("YYYY-MM-DD")}`,
         queueName: `workflow:${BILLING_QUEUES.periodEndInvoice}`,
         enqueueOptions: { delaySeconds },
      })(nextInput);
      DBOS.logger.info(
         `${ctx} next period scheduled — periodEnd=${nextPeriod.periodEnd} delaySeconds=${delaySeconds}`,
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
      BILLING_QUEUES.periodEndInvoice,
      (i) => `period-invoice-${i.subscriptionId}-${i.periodEnd}`,
   );
