import { DBOS } from "@dbos-inc/dbos-sdk";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { fromPromise } from "neverthrow";
import { and, eq } from "drizzle-orm";
import dayjs from "dayjs";
import type { DatabaseInstance } from "@core/database/client";
import { WorkflowError } from "@core/dbos/errors";
import { benefitGrants } from "@core/database/schemas/benefit-grants";
import type { SubscriptionStatus } from "@core/database/schemas/subscriptions";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";
import type { JobNotification } from "@packages/notifications/schema";
import { BILLING_QUEUES } from "../constants";
import {
   billingDataSource,
   getBillingPublisher,
   createEnqueuer,
} from "./context";

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
   const publisher = getBillingPublisher();
   const ctx = `[benefit-lifecycle] sub=${input.subscriptionId} team=${input.teamId}`;
   DBOS.logger.info(`${ctx} started newStatus=${input.newStatus}`);

   const benefits = await fromPromise(
      billingDataSource.runTransaction(
         async () => {
            const tx = DrizzleDataSource.client as DatabaseInstance;
            const rows = await tx.query.serviceBenefits.findMany({
               where: (f, { eq: eqFn }) => eqFn(f.serviceId, input.serviceId),
               with: { benefit: true },
            });
            return rows.map((r) => r.benefit);
         },
         { name: "fetchBenefits" },
      ),
      (e) =>
         WorkflowError.database("Falha ao buscar benefícios do serviço.", {
            cause: e,
         }),
   ).match(
      (rows) => rows,
      (e) => {
         throw e;
      },
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
      await fromPromise(
         billingDataSource.runTransaction(
            async () => {
               const tx = DrizzleDataSource.client as DatabaseInstance;
               await tx
                  .update(benefitGrants)
                  .set({ status: "revoked", revokedAt: dayjs().toDate() })
                  .where(
                     and(
                        eq(benefitGrants.subscriptionId, input.subscriptionId),
                        eq(benefitGrants.status, "active"),
                     ),
                  );
            },
            { name: "revokeBenefits" },
         ),
         (e) =>
            WorkflowError.database("Falha ao revogar benefícios.", {
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
            () =>
               publisher.publish("job.notification", {
                  jobId: crypto.randomUUID(),
                  timestamp: dayjs().toISOString(),
                  type: NOTIFICATION_TYPES.BILLING_BENEFIT_REVOKED,
                  status: "completed",
                  message: `Benefícios revogados para assinatura ${input.subscriptionId}.`,
                  teamId: input.teamId,
                  payload: { subscriptionId: input.subscriptionId, benefitIds },
               } satisfies JobNotification),
            { name: "publishRevoked" },
         ),
         (e) =>
            WorkflowError.internal(
               "Falha ao publicar notificação de revogação.",
               { cause: e },
            ),
      ).match(
         () => {},
         (e) => {
            throw e;
         },
      );

      DBOS.logger.info(`${ctx} benefits revoked`);
   }

   if (shouldGrant) {
      await fromPromise(
         billingDataSource.runTransaction(
            async () => {
               const tx = DrizzleDataSource.client as DatabaseInstance;
               await tx
                  .insert(benefitGrants)
                  .values(
                     benefitIds.map((benefitId) => ({
                        teamId: input.teamId,
                        subscriptionId: input.subscriptionId,
                        benefitId,
                        status: "active" as const,
                     })),
                  )
                  .onConflictDoUpdate({
                     target: [
                        benefitGrants.subscriptionId,
                        benefitGrants.benefitId,
                     ],
                     set: { status: "active", revokedAt: null },
                  });
            },
            { name: "grantBenefits" },
         ),
         (e) =>
            WorkflowError.database("Falha ao conceder benefícios.", {
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
            () =>
               publisher.publish("job.notification", {
                  jobId: crypto.randomUUID(),
                  timestamp: dayjs().toISOString(),
                  type: NOTIFICATION_TYPES.BILLING_BENEFIT_GRANTED,
                  status: "completed",
                  message: `Benefícios concedidos para assinatura ${input.subscriptionId}.`,
                  teamId: input.teamId,
                  payload: { subscriptionId: input.subscriptionId, benefitIds },
               } satisfies JobNotification),
            { name: "publishGranted" },
         ),
         (e) =>
            WorkflowError.internal(
               "Falha ao publicar notificação de concessão.",
               { cause: e },
            ),
      ).match(
         () => {},
         (e) => {
            throw e;
         },
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
      BILLING_QUEUES.benefitLifecycle,
      (i) => `benefit-lifecycle-${i.subscriptionId}-${i.newStatus}`,
   );
