import { DBOS } from "@dbos-inc/dbos-sdk";
import dayjs from "dayjs";
import { createEnqueuer, QUEUES } from "../../workflow-factory";
import {
   getSubscription,
   updateSubscription,
} from "@core/database/repositories/subscriptions-repository";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { getDeps, getPublisher } from "../../context";

export type TrialExpiryInput = {
   teamId: string;
   subscriptionId: string;
   trialEndsAt: string;
   operatorEmail: string;
   contactEmail?: string;
   contactName?: string;
};

async function trialExpiryWorkflowFn(input: TrialExpiryInput) {
   const publisher = getPublisher();
   const ctx = `[trial-expiry] sub=${input.subscriptionId} team=${input.teamId}`;

   DBOS.logger.info(`${ctx} started trialEndsAt=${input.trialEndsAt}`);

   const msUntilWarning = dayjs(input.trialEndsAt)
      .subtract(3, "day")
      .diff(dayjs());

   if (msUntilWarning > 0) {
      await DBOS.sleepms(msUntilWarning);
   }

   await DBOS.runStep(
      async () => {
         const { resendClient } = getDeps();
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

         await resendClient.emails.send({
            from: "Montte <suporte@mail.montte.co>",
            to: input.operatorEmail,
            subject: "Período de teste expira em 3 dias",
            text: `O período de teste da assinatura ${input.subscriptionId} expira em 3 dias (${dayjs(input.trialEndsAt).format("DD/MM/YYYY")}).`,
         });

         if (contactEmail) {
            await resendClient.emails.send({
               from: "Montte <suporte@mail.montte.co>",
               to: contactEmail,
               subject: "Seu período de teste expira em 3 dias",
               text: `Olá${contactName ? `, ${contactName}` : ""}!\n\nSeu período de teste expira em 3 dias (${dayjs(input.trialEndsAt).format("DD/MM/YYYY")}). Após essa data, sua assinatura será ativada automaticamente.`,
            });
         }
      },
      { name: "sendPreExpiryWarning" },
   );

   const msUntilExpiry = dayjs(input.trialEndsAt).diff(dayjs());

   if (msUntilExpiry > 0) {
      await DBOS.sleepms(msUntilExpiry);
   }

   const subscription = await DBOS.runStep(
      async () => {
         const { db } = getDeps();
         return getSubscription(db, input.subscriptionId).match(
            (v) => v,
            (e) => {
               throw e;
            },
         );
      },
      { name: "checkSubscriptionStatus" },
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

   await DBOS.runStep(
      async () => {
         const { db } = getDeps();
         await updateSubscription(db, input.subscriptionId, {
            status: "active",
         }).match(
            (v) => v,
            (e) => {
               throw e;
            },
         );
      },
      { name: "activateSubscription" },
   );

   await DBOS.runStep(
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
   );

   await DBOS.runStep(
      async () => {
         const { resendClient } = getDeps();
         const { contactEmail, contactName } = input;

         await resendClient.emails.send({
            from: "Montte <suporte@mail.montte.co>",
            to: input.operatorEmail,
            subject: "Período de teste encerrado — assinatura ativa",
            text: `O período de teste da assinatura ${input.subscriptionId} foi encerrado. A assinatura está agora ativa.`,
         });

         if (contactEmail) {
            await resendClient.emails.send({
               from: "Montte <suporte@mail.montte.co>",
               to: contactEmail,
               subject: "Seu período de teste encerrou — assinatura ativa",
               text: `Olá${contactName ? `, ${contactName}` : ""}!\n\nSeu período de teste encerrou e sua assinatura está agora ativa.`,
            });
         }
      },
      { name: "sendExpiryEmails" },
   );

   DBOS.logger.info(`${ctx} completed — subscription activated`);
}

export const trialExpiryWorkflow = DBOS.registerWorkflow(trialExpiryWorkflowFn);

export const enqueueTrialExpiryWorkflow = createEnqueuer<TrialExpiryInput>(
   trialExpiryWorkflowFn.name,
   QUEUES.trialExpiry,
   (i) => `trial-expiry-${i.subscriptionId}`,
);
