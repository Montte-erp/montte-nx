import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import type { DbosWorkerQueue } from "@core/dbos/worker";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { PostHog, Prompts } from "@core/posthog/server";
import { CLASSIFICATION_WORKFLOW_QUEUES } from "@modules/classification/workflows/constants";

export { registerWorkflowOnce } from "@core/dbos/factory";

export const classificationDataSource = new DrizzleDataSource<DatabaseInstance>(
   "classification",
   { connectionString: env.DATABASE_URL },
   schema,
);

type ClassificationWorkflowContext = {
   posthog: PostHog | null;
   prompts: Prompts | null;
};

const store = createStore<ClassificationWorkflowContext>({
   posthog: null,
   prompts: null,
});

export function initClassificationWorkflowContext(deps: {
   posthog: PostHog;
   prompts: Prompts;
}) {
   store.setState(() => ({
      posthog: deps.posthog,
      prompts: deps.prompts,
   }));
}

export function getClassificationPrompts(): Prompts {
   const { prompts } = store.state;
   if (!prompts)
      throw new Error("Classification workflow context not initialized");
   return prompts;
}

export function getClassificationPosthog(): PostHog {
   const { posthog } = store.state;
   if (!posthog)
      throw new Error("Classification workflow context not initialized");
   return posthog;
}

export function createClassificationQueues(options: {
   workerConcurrency: number;
}): DbosWorkerQueue[] {
   return Object.values(CLASSIFICATION_WORKFLOW_QUEUES).map((name) => ({
      name,
      options,
   }));
}
