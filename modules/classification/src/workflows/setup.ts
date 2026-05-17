import "@modules/classification/workflows/classification-workflow";
import "@modules/classification/workflows/derive-keywords-workflow";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
import type { PostHog, Prompts } from "@core/posthog/server";
import {
   createClassificationQueues,
   initClassificationWorkflowContext,
} from "@modules/classification/workflows/context";

export async function setupClassificationWorkflows(deps: {
   posthog: PostHog;
   prompts: Prompts;
   workerConcurrency: number;
}) {
   await DrizzleDataSource.initializeDBOSSchema({
      connectionString: env.DATABASE_URL,
   });
   initClassificationWorkflowContext({
      posthog: deps.posthog,
      prompts: deps.prompts,
   });
   const queues = createClassificationQueues({
      workerConcurrency: deps.workerConcurrency,
   });
   return { queues };
}
