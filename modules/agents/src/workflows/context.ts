import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { PostHog, Prompts } from "@core/posthog/server";
import { AGENT_QUEUES } from "../constants";

export { createEnqueuer, registerWorkflowOnce } from "@core/dbos/factory";

export const agentsDataSource = new DrizzleDataSource<DatabaseInstance>(
   "agents",
   { connectionString: env.DATABASE_URL },
   schema,
);

type AgentsWorkflowContext = {
   posthog: PostHog | null;
   prompts: Prompts | null;
};

const store = createStore<AgentsWorkflowContext>({
   posthog: null,
   prompts: null,
});

export function initAgentsWorkflowContext(deps: {
   posthog: PostHog;
   prompts: Prompts;
}) {
   store.setState(() => ({
      posthog: deps.posthog,
      prompts: deps.prompts,
   }));
}

export function getAgentsPosthog(): PostHog {
   const { posthog } = store.state;
   if (!posthog) throw new Error("Agents workflow context not initialized");
   return posthog;
}

export function getAgentsPrompts(): Prompts {
   const { prompts } = store.state;
   if (!prompts) throw new Error("Agents workflow context not initialized");
   return prompts;
}

export function createAgentsQueues(options: { workerConcurrency: number }) {
   return Object.values(AGENT_QUEUES).map(
      (name) => new WorkflowQueue(`workflow:${name}`, options),
   );
}
