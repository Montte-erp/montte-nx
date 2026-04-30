import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { PostHog, Prompts } from "@core/posthog/server";
import { CLASSIFICATION_QUEUES } from "@modules/classification/constants";

export { createEnqueuer, registerWorkflowOnce } from "@core/dbos/factory";

export const classificationDataSource = new DrizzleDataSource<DatabaseInstance>(
   "classification",
   { connectionString: env.DATABASE_URL },
   schema,
);

type ClassificationWorkflowContext = {
   posthog: PostHog | null;
   redis: Redis | null;
   prompts: Prompts | null;
};

const store = createStore<ClassificationWorkflowContext>({
   posthog: null,
   redis: null,
   prompts: null,
});

export function initClassificationWorkflowContext(deps: {
   redis: Redis;
   posthog: PostHog;
   prompts: Prompts;
}) {
   store.setState(() => ({
      posthog: deps.posthog,
      redis: deps.redis,
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

export function getClassificationRedis(): Redis {
   const { redis } = store.state;
   if (!redis)
      throw new Error("Classification workflow context not initialized");
   return redis;
}

export function createClassificationQueues(options: {
   workerConcurrency: number;
}) {
   return Object.values(CLASSIFICATION_QUEUES).map(
      (name) => new WorkflowQueue(`workflow:${name}`, options),
   );
}
