import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
import type { Prompts } from "@core/posthog/server";
import {
   createClassificationQueues,
   initClassificationWorkflowContext,
} from "@modules/classification/workflows/classification-workflow";

export async function setupClassificationWorkflows(deps: {
   prompts: Prompts;
   workerConcurrency: number;
}) {
   await DrizzleDataSource.initializeDBOSSchema({
      connectionString: env.DATABASE_URL,
   });
   initClassificationWorkflowContext(deps.prompts);
   const queues = createClassificationQueues({
      workerConcurrency: deps.workerConcurrency,
   });
   return { queues };
}
