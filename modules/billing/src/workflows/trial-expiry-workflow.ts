import { DBOS } from "@dbos-inc/dbos-sdk";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { eq } from "drizzle-orm";
import dayjs from "dayjs";
import { WorkflowError } from "@core/dbos/errors";
import { contactSubscriptions } from "@core/database/schemas/subscriptions";
import {
   sendBillingTrialExpired,
   sendBillingTrialExpiryWarning,
} from "@core/transactional/client";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { BILLING_QUEUES } from "../constants";
import {
   billingDataSource,
   getBillingPublisher,
   getBillingResendClient,
   createEnqueuer,
} from "./context";
import {
   periodEndInvoiceWorkflow,
   type PeriodEndInvoiceInput,
} from "./period-end-invoice-workflow";

export type TrialExpiryInput = {
   teamId: string;
   subscriptionId: string;
   trialEndsAt: string;
   phase: "warning" | "expiry";
   contactEmail?: string;
   contactName?: string;
   emailFrom?: string;
};

async function trialExpiryWorkflowFn(input: TrialExpiryInput) {
   const publisher = getBillingPublisher();
   const ctx = `[trial-expiry:${input.phase}] sub=${input.subscriptionId} team=${input.teamId}`;
   DBOS.logger.info(`${ctx} running trialEndsAt=${input.trialEndsAt}`);

   if (input.phase === "warning") {
      const warningResult = await fromPromise(
         DBOS.runStep(
            async () => {
               const resendClient = getBillingResendClient();
               const { contactEmail, contactName } = input;

               await publisher.publish("job.notification", {
                  jobId: crypto.randomUUID(),
                  timestamp: dayjs().toISOString(),
                  type: NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING,
                  status: "started",
                  message: `Período de teste expira em 3 dias para assinatura ${input.subscriptionId}.`,
                  teamId: input.teamId,
                  payload: {
                     subscriptionId: input.subscriptionId,
                     daysLeft: 3,
                  },
               } satisfies JobNotification);

               if (contactEmail) {
                  await sendBillingTrialExpiryWarning(resendClient, {
                     contactEmail,
                     contactName,
                     trialEndsAt: dayjs(input.trialEndsAt).format("DD/MM/YYYY"),
                     from: input.emailFrom,
                  });
               }
            },
            { name: "sendPreExpiryWarning" },
         ),
         (e) =>
            WorkflowError.internal(
               "Falha ao enviar aviso de expiração de trial.",
               { cause: e },
            ),
      );
      if (warningResult.isErr()) throw warningResult.error;

      const delaySeconds = Math.max(
         0,
         Math.floor(dayjs(input.trialEndsAt).diff(dayjs()) / 1000),
      );
      await DBOS.startWorkflow(trialExpiryWorkflow, {
         workflowID: `trial-expiry-${input.subscriptionId}-expiry`,
         queueName: `workflow:${BILLING_QUEUES.trialExpiry}`,
         enqueueOptions: { delaySeconds },
      })({ ...input, phase: "expiry" });
      return;
   }

   const subscriptionResult = await fromPromise(
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
         WorkflowError.database("Falha ao buscar assinatura.", { cause: e }),
   );
   if (subscriptionResult.isErr()) throw subscriptionResult.error;
   const subscription = subscriptionResult.value;

   if (
      !subscription ||
      subscription.status === "cancelled" ||
      subscription.status === "completed"
   ) {
      DBOS.logger.info(
         `${ctx} subscription not active — status=${subscription?.status ?? "not found"} — skipping activation`,
      );
      return;
   }

   const activateResult = await fromPromise(
      billingDataSource.runTransaction(
         async () => {
            const tx = billingDataSource.client;
            await tx
               .update(contactSubscriptions)
               .set({ status: "active" })
               .where(eq(contactSubscriptions.id, input.subscriptionId));
         },
         { name: "activateSubscription" },
      ),
      (e) =>
         WorkflowError.database("Falha ao ativar assinatura.", { cause: e }),
   );
   if (activateResult.isErr()) throw activateResult.error;

   const publishResult = await fromPromise(
      DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: dayjs().toISOString(),
               type: NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING,
               status: "completed",
               message: `Período de teste encerrado — assinatura ${input.subscriptionId} ativada.`,
               teamId: input.teamId,
               payload: { subscriptionId: input.subscriptionId, daysLeft: 0 },
            } satisfies JobNotification),
         { name: "publishExpired" },
      ),
      (e) =>
         WorkflowError.internal("Falha ao publicar notificação de expiração.", {
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
               await sendBillingTrialExpired(resendClient, {
                  contactEmail,
                  contactName,
                  from: input.emailFrom,
               });
            }
         },
         { name: "sendExpiryEmails" },
      ),
      (e) =>
         WorkflowError.internal("Falha ao enviar e-mails de expiração.", {
            cause: e,
         }),
   );
   if (emailResult.isErr()) throw emailResult.error;

   const nextPeriodResult = await fromPromise(
      DBOS.runStep(
         async () => {
            const tx = billingDataSource.client;
            const items = await tx.query.subscriptionItems.findMany({
               where: (f, { eq: eqFn }) =>
                  eqFn(f.subscriptionId, input.subscriptionId),
               with: { price: true },
            });
            const firstPrice = items[0]?.price;
            if (!firstPrice || firstPrice.interval === "one_time") return null;

            const now = dayjs();
            const periodEnd =
               firstPrice.interval === "hourly"
                  ? now.add(1, "hour")
                  : firstPrice.interval === "monthly"
                    ? now.add(1, "month")
                    : firstPrice.interval === "annual"
                      ? now.add(1, "year")
                      : null;
            if (!periodEnd) return null;

            return {
               periodStart: now.toISOString(),
               periodEnd: periodEnd.toISOString(),
            };
         },
         { name: "computeFirstPeriod" },
      ),
      (e) =>
         WorkflowError.internal("Falha ao computar primeiro período.", {
            cause: e,
         }),
   );
   if (nextPeriodResult.isErr()) throw nextPeriodResult.error;
   const nextPeriod = nextPeriodResult.value;

   if (nextPeriod) {
      const invoiceInput: PeriodEndInvoiceInput = {
         teamId: input.teamId,
         subscriptionId: input.subscriptionId,
         periodStart: nextPeriod.periodStart,
         periodEnd: nextPeriod.periodEnd,
         contactEmail: input.contactEmail,
         contactName: input.contactName,
         emailFrom: input.emailFrom,
      };
      const delaySeconds = Math.max(
         0,
         Math.floor(dayjs(nextPeriod.periodEnd).diff(dayjs()) / 1000),
      );
      await DBOS.startWorkflow(periodEndInvoiceWorkflow, {
         workflowID: `period-invoice-${input.subscriptionId}-${dayjs(nextPeriod.periodEnd).format("YYYY-MM-DD")}`,
         queueName: `workflow:${BILLING_QUEUES.periodEndInvoice}`,
         enqueueOptions: { delaySeconds },
      })(invoiceInput);
   }

   DBOS.logger.info(`${ctx} completed — subscription activated`);
}

export const trialExpiryWorkflow = DBOS.registerWorkflow(trialExpiryWorkflowFn);

const enqueueTrialExpiryRaw = createEnqueuer<TrialExpiryInput>(
   trialExpiryWorkflowFn.name,
   BILLING_QUEUES.trialExpiry,
   (i) => `trial-expiry-${i.subscriptionId}-${i.phase}`,
);

export function enqueueTrialExpiryWorkflow(
   client: DBOSClient,
   input: Omit<TrialExpiryInput, "phase">,
) {
   const msUntilWarning = dayjs(input.trialEndsAt)
      .subtract(3, "day")
      .diff(dayjs());
   const delaySeconds = Math.max(0, Math.floor(msUntilWarning / 1000));
   return enqueueTrialExpiryRaw(
      client,
      { ...input, phase: "warning" },
      { delaySeconds },
   );
}
