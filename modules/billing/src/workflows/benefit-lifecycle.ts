import { DBOS } from "@dbos-inc/dbos-sdk";
import { createEnqueuer, QUEUES } from "@packages/workflows/workflow-factory";
import {
   grantBenefits,
   revokeBenefits,
} from "@modules/billing/db/benefit-grants";
import { listBenefitsByService } from "@modules/services/db/benefits";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import type { SubscriptionStatus } from "@core/database/schemas/subscriptions";
import { getDeps, getPublisher } from "@packages/workflows/context";

export type BenefitLifecycleInput = {
   teamId: string;
   subscriptionId: string;
   serviceId: string;
   newStatus: SubscriptionStatus;
   previousStatus?: SubscriptionStatus;
};

const GRANT_STATUSES: SubscriptionStatus[] = ["active", "trialing"];
const REVOKE_STATUSES: SubscriptionStatus[] = ["cancelled", "completed"];

async function benefitLifecycleWorkflowFn(input: BenefitLifecycleInput) {
   const { db } = getDeps();
   const publisher = getPublisher();
   const ctx = `[benefit-lifecycle] sub=${input.subscriptionId} team=${input.teamId}`;

   DBOS.logger.info(`${ctx} started newStatus=${input.newStatus}`);

   const benefits = await DBOS.runStep(
      () =>
         listBenefitsByService(db, input.serviceId).match(
            (v) => v,
            (e) => {
               throw e;
            },
         ),
      { name: "fetchBenefits" },
   );

   if (benefits.length === 0) {
      DBOS.logger.info(`${ctx} no benefits found — skipping`);
      return;
   }

   const benefitIds = benefits.map((b) => b.id);

   const isUpgrade =
      input.previousStatus !== undefined &&
      GRANT_STATUSES.includes(input.previousStatus) &&
      GRANT_STATUSES.includes(input.newStatus);

   const shouldRevoke = REVOKE_STATUSES.includes(input.newStatus) || isUpgrade;
   const shouldGrant = GRANT_STATUSES.includes(input.newStatus);

   if (shouldRevoke) {
      await DBOS.runStep(
         () =>
            revokeBenefits(db, input.subscriptionId).match(
               (v) => v,
               (e) => {
                  throw e;
               },
            ),
         { name: "revokeBenefits" },
      );

      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: new Date().toISOString(),
               type: NOTIFICATION_TYPES.BILLING_BENEFIT_REVOKED,
               status: "completed",
               message: `Benefícios revogados para assinatura ${input.subscriptionId}.`,
               teamId: input.teamId,
               payload: { subscriptionId: input.subscriptionId, benefitIds },
            } satisfies JobNotification),
         { name: "publishRevoked" },
      );

      DBOS.logger.info(`${ctx} benefits revoked`);
   }

   if (shouldGrant) {
      await DBOS.runStep(
         async () =>
            grantBenefits(
               db,
               input.teamId,
               input.subscriptionId,
               benefitIds,
            ).match(
               (v) => v,
               (e) => {
                  throw e;
               },
            ),
         { name: "grantBenefits" },
      );

      await DBOS.runStep(
         () =>
            publisher.publish("job.notification", {
               jobId: crypto.randomUUID(),
               timestamp: new Date().toISOString(),
               type: NOTIFICATION_TYPES.BILLING_BENEFIT_GRANTED,
               status: "completed",
               message: `Benefícios concedidos para assinatura ${input.subscriptionId}.`,
               teamId: input.teamId,
               payload: { subscriptionId: input.subscriptionId, benefitIds },
            } satisfies JobNotification),
         { name: "publishGranted" },
      );

      DBOS.logger.info(`${ctx} benefits granted`);
   }
}

export const benefitLifecycleWorkflow = DBOS.registerWorkflow(
   benefitLifecycleWorkflowFn,
);

export const enqueueBenefitLifecycleWorkflow =
   createEnqueuer<BenefitLifecycleInput>(
      benefitLifecycleWorkflowFn.name,
      QUEUES.benefitLifecycle,
      (i) => `benefit-lifecycle-${i.subscriptionId}-${i.newStatus}`,
   );
