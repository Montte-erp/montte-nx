import type { DatabaseInstance } from "@core/database/client";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";
import type { StripeClient } from "@core/stripe";
import { createJobPublisher } from "@packages/notifications/publisher";

export type WorkflowDeps = {
   db: DatabaseInstance;
   redis: Redis;
   posthog: PostHog;
   stripeClient: StripeClient;
};

let _deps: WorkflowDeps | null = null;
let _publisher: ReturnType<typeof createJobPublisher> | null = null;

export function initContext(deps: WorkflowDeps) {
   _deps = deps;
   _publisher = createJobPublisher(deps.redis);
}

export function getDeps(): WorkflowDeps {
   if (!_deps) throw new Error("Workflow context not initialized");
   return _deps;
}

export function getPublisher(): ReturnType<typeof createJobPublisher> {
   if (!_publisher) throw new Error("Workflow context not initialized");
   return _publisher;
}
