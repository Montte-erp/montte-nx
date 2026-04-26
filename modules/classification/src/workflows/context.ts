import { DrizzleDataSource } from "@dbos-inc/drizzle-datasource";
import { WorkflowQueue } from "@dbos-inc/dbos-sdk";
import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { env } from "@core/environment/worker";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";
import type { HyprPayClient } from "@core/hyprpay/client";
import { CLASSIFICATION_QUEUES } from "../constants";

export { createEnqueuer } from "@core/dbos/factory";

export const classificationDataSource = new DrizzleDataSource<DatabaseInstance>(
   "classification",
   { connectionString: env.DATABASE_URL },
   schema,
);

type ClassificationWorkflowContext = {
   posthog: PostHog | null;
   redis: Redis | null;
   hyprpayClient: HyprPayClient | null;
};

const store = createStore<ClassificationWorkflowContext>({
   posthog: null,
   redis: null,
   hyprpayClient: null,
});

export function initClassificationWorkflowContext(deps: {
   redis: Redis;
   posthog: PostHog;
   hyprpayClient: HyprPayClient;
}) {
   store.setState(() => ({
      posthog: deps.posthog,
      redis: deps.redis,
      hyprpayClient: deps.hyprpayClient,
   }));
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

export function getClassificationHyprpay(): HyprPayClient {
   const { hyprpayClient } = store.state;
   if (!hyprpayClient)
      throw new Error("Classification workflow context not initialized");
   return hyprpayClient;
}

export function createClassificationQueues(options: {
   workerConcurrency: number;
}) {
   return Object.values(CLASSIFICATION_QUEUES).map(
      (name) => new WorkflowQueue(`workflow:${name}`, options),
   );
}
