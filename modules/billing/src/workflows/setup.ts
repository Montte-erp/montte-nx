import "./trial-expiry-workflow";
import "./period-end-invoice-workflow";
import "./benefit-lifecycle-workflow";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { ResendClient } from "@core/transactional/utils";
import { createBillingQueues, initBillingWorkflowContext } from "./context";

export async function setupBillingWorkflows(deps: {
   redis: Redis;
   resendClient: ResendClient;
   workerConcurrency: number;
}) {
   await DrizzleDataSource.initializeDBOSSchema({
      connectionString: env.DATABASE_URL,
   });
   initBillingWorkflowContext(deps.redis, deps.resendClient);
   return createBillingQueues({ workerConcurrency: deps.workerConcurrency });
}
