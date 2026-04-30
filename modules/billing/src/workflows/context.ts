import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { ResendClient } from "@core/transactional/utils";
import { BILLING_QUEUES } from "../constants";

export { createEnqueuer, registerWorkflowOnce } from "@core/dbos/factory";

export const billingDataSource = new DrizzleDataSource<DatabaseInstance>(
   "billing",
   { connectionString: env.DATABASE_URL },
   schema,
);

type IngestUsageInput = {
   eventName: string;
   quantity: string;
   idempotencyKey: string;
   externalId?: string;
   properties?: Record<string, unknown>;
};

type UsageIngestor = {
   services: {
      ingestUsage: (input: IngestUsageInput) => Promise<{ success: true }>;
   };
};

const noopUsageIngestor: UsageIngestor = {
   services: {
      ingestUsage: async () => ({ success: true }),
   },
};

type BillingWorkflowContext = {
   redis: Redis | null;
   resendClient: ResendClient | null;
};

const store = createStore<BillingWorkflowContext>({
   redis: null,
   resendClient: null,
});

export function initBillingWorkflowContext(
   redis: Redis,
   resendClient: ResendClient,
) {
   store.setState(() => ({
      redis,
      resendClient,
   }));
}

export function getBillingRedis(): Redis {
   const { redis } = store.state;
   if (!redis) throw new Error("Billing workflow context not initialized");
   return redis;
}

export function getBillingResendClient(): ResendClient {
   const { resendClient } = store.state;
   if (!resendClient)
      throw new Error("Billing workflow context not initialized");
   return resendClient;
}

export function getBillingHyprpay(): UsageIngestor {
   return noopUsageIngestor;
}

export function createBillingQueues(options: { workerConcurrency: number }) {
   return Object.values(BILLING_QUEUES).map(
      (name) => new WorkflowQueue(`workflow:${name}`, options),
   );
}
