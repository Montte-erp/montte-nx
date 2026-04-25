import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";
import type { StripeClient } from "@core/stripe";
import { createJobPublisher } from "@packages/notifications/publisher";
import { CLASSIFICATION_QUEUES } from "../constants";

export { createEnqueuer } from "@core/dbos/factory";

export const classificationDataSource = new DrizzleDataSource<DatabaseInstance>(
   "classification",
   { connectionString: env.DATABASE_URL },
   schema,
);

type ClassificationWorkflowContext = {
   publisher: ReturnType<typeof createJobPublisher> | null;
   posthog: PostHog | null;
   redis: Redis | null;
   stripeClient: StripeClient | null;
};

const store = createStore<ClassificationWorkflowContext>({
   publisher: null,
   posthog: null,
   redis: null,
   stripeClient: null,
});

export function initClassificationWorkflowContext(deps: {
   redis: Redis;
   posthog: PostHog;
   stripeClient: StripeClient | null;
}) {
   store.setState(() => ({
      publisher: createJobPublisher(deps.redis),
      posthog: deps.posthog,
      redis: deps.redis,
      stripeClient: deps.stripeClient,
   }));
}

export function getClassificationPublisher() {
   const { publisher } = store.state;
   if (!publisher)
      throw new Error("Classification workflow context not initialized");
   return publisher;
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

export function getClassificationStripe(): StripeClient | null {
   return store.state.stripeClient;
}

export function createClassificationQueues(options: {
   workerConcurrency: number;
}) {
   return Object.values(CLASSIFICATION_QUEUES).map(
      (name) => new WorkflowQueue(`workflow:${name}`, options),
   );
}
