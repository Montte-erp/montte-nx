import "./trial-expiry-workflow";
import "./period-end-invoice-workflow";
import "./benefit-lifecycle-workflow";
import type { Redis } from "@core/redis/connection";
import type { ResendClient } from "@core/transactional/utils";
import { createBillingQueues, initBillingWorkflowContext } from "./context";

export function setupBillingWorkflows(deps: {
   redis: Redis;
   resendClient: ResendClient;
   workerConcurrency: number;
}) {
   initBillingWorkflowContext(deps.redis, deps.resendClient);
   return createBillingQueues({ workerConcurrency: deps.workerConcurrency });
}
