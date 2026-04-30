import { DBOS } from "@dbos-inc/dbos-sdk";
import { fromPromise, okAsync, safeTry, type ResultAsync } from "neverthrow";
import { and, count, eq, gte, lte, sum } from "drizzle-orm";
import dayjs from "dayjs";
import {
   advanceByBillingInterval,
   type BillingInterval,
} from "@core/utils/date";
import { WorkflowError } from "@core/dbos/errors";
import { sendBillingInvoiceGenerated } from "@core/transactional/client";
import { TRANSACTIONAL_USAGE_EVENTS } from "@core/transactional/usage-events";
import { couponRedemptions } from "@core/database/schemas/coupons";
import type { Coupon } from "@core/database/schemas/coupons";
import { invoices, type Invoice } from "@core/database/schemas/invoices";
import { usageEvents } from "@core/database/schemas/usage-events";
import {
   buildInvoice,
   type InvoiceSourceData,
} from "../services/invoice-builder";
import type { InvoiceComputation } from "../services/pricing-engine";
import { billingSseEvents } from "../sse";
import { BILLING_QUEUES } from "../constants";
import {
   billingDataSource,
   getBillingHyprpay,
   getBillingRedis,
   getBillingResendClient,
   createEnqueuer,
   registerWorkflowOnce,
} from "./context";

export type PeriodEndInvoiceInput = {
   teamId: string;
   organizationId: string;
   subscriptionId: string;
   periodStart: string;
   periodEnd: string;
   contactEmail?: string;
   contactName?: string;
   emailFrom?: string;
};

type WorkflowResult<T> = ResultAsync<T, WorkflowError>;

function txStep<T>(
   name: string,
   message: string,
   run: () => Promise<T>,
): WorkflowResult<T> {
   return fromPromise(billingDataSource.runTransaction(run, { name }), (e) =>
      e instanceof WorkflowError
         ? e
         : WorkflowError.database(message, { cause: e }),
   );
}

function step<T>(
   name: string,
   message: string,
   run: () => Promise<T>,
): WorkflowResult<T> {
   return fromPromise(DBOS.runStep(run, { name }), (e) =>
      e instanceof WorkflowError
         ? e
         : WorkflowError.internal(message, { cause: e }),
   );
}

function fetchSubscription(subscriptionId: string) {
   return txStep(
      "checkSubscriptionStatus",
      "Falha ao verificar status da assinatura.",
      async () => {
         const sub =
            await billingDataSource.client.query.contactSubscriptions.findFirst(
               {
                  where: (f, { eq: eqFn }) => eqFn(f.id, subscriptionId),
               },
            );
         if (!sub)
            throw WorkflowError.notFound(
               `Assinatura ${subscriptionId} não encontrada.`,
            );
         return sub;
      },
   );
}

function gatherInvoiceData(
   input: PeriodEndInvoiceInput,
   sub: { couponId: string | null },
) {
   return txStep(
      "gatherInvoiceData",
      "Falha ao buscar dados da fatura.",
      async (): Promise<
         InvoiceSourceData & { firstInterval: BillingInterval | null }
      > => {
         const tx = billingDataSource.client;

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
         const benefitIds = grants
            .filter((g) => g.status === "active")
            .map((g) => g.benefitId);
         const activeBenefits =
            benefitIds.length === 0
               ? []
               : await tx.query.benefits.findMany({
                    where: (f, { inArray: inArrayFn }) =>
                       inArrayFn(f.id, benefitIds),
                 });

         const { coupon, redemptionCount } = await loadCouponState(
            tx,
            sub.couponId,
            input.subscriptionId,
         );

         return {
            items,
            prices,
            usageSummary,
            activeBenefits,
            coupon,
            redemptionCount,
            firstInterval: prices[0] ? prices[0].interval : null,
         };
      },
   );
}

async function loadCouponState(
   tx: typeof billingDataSource.client,
   couponId: string | null,
   subscriptionId: string,
): Promise<{ coupon: Coupon | null; redemptionCount: number }> {
   if (couponId === null) return { coupon: null, redemptionCount: 0 };
   const coupon =
      (await tx.query.coupons.findFirst({
         where: (f, { eq: eqFn }) => eqFn(f.id, couponId),
      })) ?? null;
   if (coupon === null) return { coupon: null, redemptionCount: 0 };
   const [row] = await tx
      .select({ count: count() })
      .from(couponRedemptions)
      .where(
         and(
            eq(couponRedemptions.couponId, coupon.id),
            eq(couponRedemptions.subscriptionId, subscriptionId),
         ),
      );
   return { coupon, redemptionCount: row?.count ?? 0 };
}

function computeStep(
   data: InvoiceSourceData,
): WorkflowResult<InvoiceComputation> {
   return step(
      "computeLineItems",
      "Falha ao computar itens da fatura.",
      async () => {
         const r = buildInvoice(data);
         if (r.isErr()) {
            throw WorkflowError.validation(r.error.message, { cause: r.error });
         }
         return r.value;
      },
   );
}

function persistInvoice(
   input: PeriodEndInvoiceInput,
   c: InvoiceComputation,
): WorkflowResult<Invoice> {
   return txStep("persistInvoice", "Falha ao persistir fatura.", async () => {
      const [row] = await billingDataSource.client
         .insert(invoices)
         .values({
            teamId: input.teamId,
            subscriptionId: input.subscriptionId,
            status: "open",
            periodStart: dayjs(input.periodStart).toDate(),
            periodEnd: dayjs(input.periodEnd).toDate(),
            subtotal: c.subtotal,
            discountAmount: c.discountAmount,
            total: c.total,
            lineItems: c.lineItems,
            couponSnapshot: c.couponSnapshot,
            currency: "BRL",
         })
         .returning();
      if (!row) throw WorkflowError.database("Falha ao criar fatura.");
      return row;
   });
}

function publishInvoiceEvent(
   input: PeriodEndInvoiceInput,
   invoice: Invoice,
   c: InvoiceComputation,
) {
   return step(
      "publishInvoiceGenerated",
      "Falha ao publicar notificação de fatura.",
      async () => {
         const r = await billingSseEvents.publish(
            getBillingRedis(),
            { kind: "team", id: input.teamId },
            {
               type: "billing.invoice_generated",
               payload: {
                  invoiceId: invoice.id,
                  subscriptionId: input.subscriptionId,
                  total: c.total,
                  currency: "BRL",
               },
            },
         );
         if (r.isErr()) throw r.error;
      },
   );
}

function sendInvoiceEmail(
   input: PeriodEndInvoiceInput,
   invoice: Invoice,
   c: InvoiceComputation,
) {
   return step("sendEmails", "Falha ao enviar e-mails de fatura.", async () => {
      if (!input.contactEmail) return;
      await sendBillingInvoiceGenerated(getBillingResendClient(), {
         contactEmail: input.contactEmail,
         contactName: input.contactName,
         invoiceId: invoice.id,
         periodStart: dayjs(input.periodStart).format("DD/MM/YYYY"),
         periodEnd: dayjs(input.periodEnd).format("DD/MM/YYYY"),
         total: c.total,
         from: input.emailFrom,
      });
      const ingest = await fromPromise(
         getBillingHyprpay().services.ingestUsage({
            eventName: TRANSACTIONAL_USAGE_EVENTS.emailSent,
            quantity: "1",
            idempotencyKey: `email-invoice-${invoice.id}`,
            properties: {
               kind: "billing.invoice_generated",
               invoiceId: invoice.id,
               subscriptionId: input.subscriptionId,
            },
         }),
         (e) => (e instanceof Error ? e : new Error(String(e))),
      );
      if (ingest.isErr()) {
         DBOS.logger.warn(
            `usage ingestion failed for email.sent — org=${input.organizationId} err=${ingest.error.message}`,
         );
      }
   });
}

function scheduleNextPeriod(
   input: PeriodEndInvoiceInput,
   firstInterval: BillingInterval | null,
): WorkflowResult<void> {
   if (firstInterval === null) return okAsync(undefined);
   return step(
      "scheduleNextPeriod",
      "Falha ao agendar próximo período.",
      async () => {
         const start = dayjs(input.periodEnd);
         const end = advanceByBillingInterval(start, firstInterval);
         if (!end) return;

         const nextInput: PeriodEndInvoiceInput = {
            ...input,
            periodStart: start.toISOString(),
            periodEnd: end.toISOString(),
         };
         const delaySeconds = Math.max(0, Math.floor(end.diff(dayjs()) / 1000));

         await DBOS.startWorkflow(periodEndInvoiceWorkflow, {
            workflowID: `period-invoice-${input.subscriptionId}-${end.format("YYYY-MM-DD")}`,
            queueName: `workflow:${BILLING_QUEUES.periodEndInvoice}`,
            enqueueOptions: { delaySeconds },
         })(nextInput);

         DBOS.logger.info(
            `[period-end-invoice] sub=${input.subscriptionId} next period scheduled — periodEnd=${end.toISOString()} delaySeconds=${delaySeconds}`,
         );
      },
   );
}

function isBillable(status: string): boolean {
   return status !== "cancelled" && status !== "completed";
}

async function periodEndInvoiceWorkflowFn(input: PeriodEndInvoiceInput) {
   const ctx = `[period-end-invoice] sub=${input.subscriptionId} team=${input.teamId}`;
   DBOS.logger.info(
      `${ctx} running period=${input.periodStart}/${input.periodEnd}`,
   );

   const result = await safeTry(async function* () {
      const sub = yield* fetchSubscription(input.subscriptionId).safeUnwrap();
      if (!isBillable(sub.status)) {
         DBOS.logger.info(
            `${ctx} not billable — status=${sub.status} — skipping`,
         );
         return okAsync(null);
      }

      const data = yield* gatherInvoiceData(input, sub).safeUnwrap();
      const computation = yield* computeStep(data).safeUnwrap();
      const invoice = yield* persistInvoice(input, computation).safeUnwrap();
      yield* publishInvoiceEvent(input, invoice, computation).safeUnwrap();
      yield* sendInvoiceEmail(input, invoice, computation).safeUnwrap();
      yield* scheduleNextPeriod(input, data.firstInterval).safeUnwrap();

      DBOS.logger.info(
         `${ctx} completed — invoiceId=${invoice.id} total=${computation.total}`,
      );
      return okAsync({ invoiceId: invoice.id });
   });

   if (result.isErr()) throw result.error;
}

export const periodEndInvoiceWorkflow = registerWorkflowOnce(
   periodEndInvoiceWorkflowFn,
);

export const enqueuePeriodEndInvoiceWorkflow =
   createEnqueuer<PeriodEndInvoiceInput>(
      periodEndInvoiceWorkflowFn.name,
      BILLING_QUEUES.periodEndInvoice,
      (i) => `period-invoice-${i.subscriptionId}-${i.periodEnd}`,
   );
