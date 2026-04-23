import { createStore } from "@tanstack/store";
import type { DatabaseInstance } from "@core/database/client";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";
import type { StripeClient } from "@core/stripe";
import type { ResendClient } from "@core/transactional/utils";
import { createJobPublisher } from "@packages/notifications/publisher";

export type WorkflowDeps = {
   db: DatabaseInstance;
   redis: Redis;
   posthog: PostHog;
   stripeClient: StripeClient;
   resendClient: ResendClient;
};

type WorkflowContext = {
   deps: WorkflowDeps | null;
   publisher: ReturnType<typeof createJobPublisher> | null;
};

const workflowStore = createStore<WorkflowContext>({
   deps: null,
   publisher: null,
});

export function initContext(deps: WorkflowDeps) {
   workflowStore.setState(() => ({
      deps,
      publisher: createJobPublisher(deps.redis),
   }));
}

export function getDeps(): WorkflowDeps {
   const { deps } = workflowStore.state;
   if (!deps) throw new Error("Workflow context not initialized");
   return deps;
}

export function getPublisher(): ReturnType<typeof createJobPublisher> {
   const { publisher } = workflowStore.state;
   if (!publisher) throw new Error("Workflow context not initialized");
   return publisher;
}
