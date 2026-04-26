import "./classification-workflow";
import "./derive-keywords-workflow";
import "./backfill-keywords-workflow";
import { DBOS } from "@dbos-inc/dbos-sdk";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";
import type { HyprPayClient } from "@core/hyprpay/client";
import {
   createClassificationQueues,
   initClassificationWorkflowContext,
} from "./context";
import { backfillKeywordsWorkflow } from "./backfill-keywords-workflow";

export async function setupClassificationWorkflows(deps: {
   redis: Redis;
   posthog: PostHog;
   hyprpayClient: HyprPayClient;
   workerConcurrency: number;
}) {
   await DrizzleDataSource.initializeDBOSSchema({
      connectionString: env.DATABASE_URL,
   });
   initClassificationWorkflowContext({
      redis: deps.redis,
      posthog: deps.posthog,
      hyprpayClient: deps.hyprpayClient,
   });
   const queues = createClassificationQueues({
      workerConcurrency: deps.workerConcurrency,
   });
   return { queues, applySchedules: scheduleBackfill };
}

async function scheduleBackfill() {
   await DBOS.applySchedules([
      {
         scheduleName: "classification-backfill-keywords",
         workflowFn: backfillKeywordsWorkflow,
         schedule: "0 3 * * *",
      },
   ]);
}
