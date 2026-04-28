import { DBOS } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { and, eq, sql } from "drizzle-orm";
import dayjs from "dayjs";
import { WorkflowError } from "@core/dbos/errors";
import { benefitGrants } from "@core/database/schemas/benefit-grants";
import type { SubscriptionStatus } from "@core/database/schemas/subscriptions";
import { billingSseEvents } from "../sse";
import { BILLING_QUEUES } from "../constants";
import { billingDataSource, getBillingRedis, createEnqueuer } from "./context";

export type BenefitLifecycleInput = {
   teamId: string;
   organizationId: string;
   subscriptionId: string;
   serviceId: string;
   newStatus: SubscriptionStatus;
   previousStatus?: SubscriptionStatus;
};

const GRANT_STATUSES: SubscriptionStatus[] = ["active", "trialing"];
const REVOKE_STATUSES: SubscriptionStatus[] = ["cancelled", "completed"];

async function benefitLifecycleWorkflowFn(input: BenefitLifecycleInput) {
   const ctx = `[benefit-lifecycle] sub=${input.subscriptionId} team=${input.teamId}`;
   DBOS.logger.info(`${ctx} started newStatus=${input.newStatus}`);

   const benefitsResult = await fromPromise(
      billingDataSource.runTransaction(
         async () => {
            const tx = billingDataSource.client;
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
   );
   if (benefitsResult.isErr()) throw benefitsResult.error;
   const benefits = benefitsResult.value;

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
      const revokeResult = await fromPromise(
         billingDataSource.runTransaction(
            async () => {
               const tx = billingDataSource.client;
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
      );
      if (revokeResult.isErr()) throw revokeResult.error;

      const publishResult = await fromPromise(
         DBOS.runStep(
            async () => {
               const publish = await billingSseEvents.publish(
                  getBillingRedis(),
                  { kind: "team", id: input.teamId },
                  {
                     type: "billing.benefit_revoked",
                     payload: {
                        subscriptionId: input.subscriptionId,
                        benefitIds,
                     },
                  },
               );
               if (publish.isErr()) throw publish.error;
            },
            { name: "publishBenefitRevoked" },
         ),
         (e) =>
            WorkflowError.internal(
               "Falha ao publicar notificação de revogação.",
               { cause: e },
            ),
      );
      if (publishResult.isErr()) throw publishResult.error;

      DBOS.logger.info(`${ctx} benefits revoked`);
   }

   if (shouldGrant) {
      const grantResult = await fromPromise(
         billingDataSource.runTransaction(
            async () => {
               const tx = billingDataSource.client;
               await tx
                  .insert(benefitGrants)
                  .values(
                     benefits.map((b) => ({
                        teamId: input.teamId,
                        subscriptionId: input.subscriptionId,
                        benefitId: b.id,
                        status: "active" as const,
                        unitCostAtGrant: b.unitCost,
                        creditAmountAtGrant: b.creditAmount,
                     })),
                  )
                  .onConflictDoUpdate({
                     target: [
                        benefitGrants.subscriptionId,
                        benefitGrants.benefitId,
                     ],
                     set: {
                        status: "active",
                        revokedAt: null,
                        unitCostAtGrant: sql`excluded.unit_cost_at_grant`,
                        creditAmountAtGrant: sql`excluded.credit_amount_at_grant`,
                     },
                  });
            },
            { name: "grantBenefits" },
         ),
         (e) =>
            WorkflowError.database("Falha ao conceder benefícios.", {
               cause: e,
            }),
      );
      if (grantResult.isErr()) throw grantResult.error;

      const publishResult = await fromPromise(
         DBOS.runStep(
            async () => {
               const publish = await billingSseEvents.publish(
                  getBillingRedis(),
                  { kind: "team", id: input.teamId },
                  {
                     type: "billing.benefit_granted",
                     payload: {
                        subscriptionId: input.subscriptionId,
                        benefitIds,
                     },
                  },
               );
               if (publish.isErr()) throw publish.error;
            },
            { name: "publishBenefitGranted" },
         ),
         (e) =>
            WorkflowError.internal(
               "Falha ao publicar notificação de concessão.",
               { cause: e },
            ),
      );
      if (publishResult.isErr()) throw publishResult.error;

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
