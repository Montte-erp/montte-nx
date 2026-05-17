import "./generate-title-workflow";
import "./refresh-suggestions-workflow";
import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { env } from "@core/environment/worker";
import type { PostHog, Prompts } from "@core/posthog/server";
import { createAgentsQueues, initAgentsWorkflowContext } from "./context";

export async function setupAgentsWorkflows(deps: {
   posthog: PostHog;
   prompts: Prompts;
   workerConcurrency: number;
}) {
   await DrizzleDataSource.initializeDBOSSchema({
      connectionString: env.DATABASE_URL,
   });
   initAgentsWorkflowContext({
      posthog: deps.posthog,
      prompts: deps.prompts,
   });
   return createAgentsQueues({ workerConcurrency: deps.workerConcurrency });
}
