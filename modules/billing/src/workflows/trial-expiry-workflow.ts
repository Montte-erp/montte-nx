import { DBOS } from "@dbos-inc/dbos-sdk";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { fromPromise } from "neverthrow";
import { eq } from "drizzle-orm";
import dayjs from "dayjs";
import type { DatabaseInstance } from "@core/database/client";
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

export type TrialExpiryInput = {
   teamId: string;
   subscriptionId: string;
   trialEndsAt: string;
   contactEmail?: string;
   contactName?: string;
   emailFrom?: string;
};

async function trialExpiryWorkflowFn(input: TrialExpiryInput) {
   const publisher = getBillingPublisher();
   const ctx = `[trial-expiry] sub=${input.subscriptionId} team=${input.teamId}`;
   DBOS.logger.info(`${ctx} started trialEndsAt=${input.trialEndsAt}`);

   const msUntilWarning = dayjs(input.trialEndsAt)
      .subtract(3, "day")
      .diff(dayjs());
   if (msUntilWarning > 0) await DBOS.sleepms(msUntilWarning);

   await fromPromise(
      DBOS.runStep(
         async () => {
            const resendClient = getBillingResendClient();
            const { contactEmail, contactName } = input;

            await publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: new Date().toISOString(),
               type: NOTIFICATION_TYPES.BILLING_TRIAL_EXPIRING,
               status: "started",
               message: `Período de teste expira em 3 dias para assinatura ${input.subscriptionId}.`,
               teamId: input.teamId,
               payload: { subscriptionId: input.subscriptionId, daysLeft: 3 },
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
   ).match(
      () => {},
      (e) => {
         throw e;
      },
   );

   const msUntilExpiry = dayjs(input.trialEndsAt).diff(dayjs());
   if (msUntilExpiry > 0) await DBOS.sleepms(msUntilExpiry);

   const subscription = await fromPromise(
      billingDataSource.runTransaction(
         async () => {
            const tx = DrizzleDataSource.client as DatabaseInstance;
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
   ).match(
      (sub) => sub,
      (e) => {
         throw e;
      },
   );

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

   await fromPromise(
      billingDataSource.runTransaction(
         async () => {
            const tx = DrizzleDataSource.client as DatabaseInstance;
            await tx
               .update(contactSubscriptions)
               .set({ status: "active" })
               .where(eq(contactSubscriptions.id, input.subscriptionId));
         },
         { name: "activateSubscription" },
      ),
      (e) =>
         WorkflowError.database("Falha ao ativar assinatura.", { cause: e }),
   ).match(
      () => {},
      (e) => {
         throw e;
      },
   );

   await fromPromise(
      DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: new Date().toISOString(),
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
   ).match(
      () => {},
      (e) => {
         throw e;
      },
   );

   await fromPromise(
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
   ).match(
      () => {},
      (e) => {
         throw e;
      },
   );

   DBOS.logger.info(`${ctx} completed — subscription activated`);
}

export const trialExpiryWorkflow = DBOS.registerWorkflow(trialExpiryWorkflowFn);

export const enqueueTrialExpiryWorkflow = createEnqueuer<TrialExpiryInput>(
   trialExpiryWorkflowFn.name,
   BILLING_QUEUES.trialExpiry,
   (i) => `trial-expiry-${i.subscriptionId}`,
);
