import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { ResendClient } from "@core/transactional/utils";
import { createJobPublisher } from "@packages/notifications/publisher";
import { BILLING_QUEUES } from "../constants";

export { createEnqueuer } from "@core/dbos/factory";

export const billingDataSource = new DrizzleDataSource<DatabaseInstance>(
   "billing",
   { connectionString: env.DATABASE_URL },
   schema,
);

type BillingWorkflowContext = {
   publisher: ReturnType<typeof createJobPublisher> | null;
   resendClient: ResendClient | null;
};

const store = createStore<BillingWorkflowContext>({
   publisher: null,
   resendClient: null,
});

export function initBillingWorkflowContext(
   redis: Redis,
   resendClient: ResendClient,
) {
   store.setState(() => ({
      publisher: createJobPublisher(redis),
      resendClient,
   }));
}

export function getBillingPublisher() {
   const { publisher } = store.state;
   if (!publisher) throw new Error("Billing workflow context not initialized");
   return publisher;
}

export function getBillingResendClient(): ResendClient {
   const { resendClient } = store.state;
   if (!resendClient)
      throw new Error("Billing workflow context not initialized");
   return resendClient;
}

export function createBillingQueues(options: { workerConcurrency: number }) {
   return Object.values(BILLING_QUEUES).map(
      (name) => new WorkflowQueue(`workflow:${name}`, options),
   );
}
