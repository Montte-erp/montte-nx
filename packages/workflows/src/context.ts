import type { DatabaseInstance } from "@core/database/client";
import type { Redis } from "@core/redis/connection";
import type { PostHog } from "@core/posthog/server";
import type { ResendClient } from "@core/transactional/utils";

export type WorkflowDeps = {
   db: DatabaseInstance;
   redis: Redis;
   posthog: PostHog;
   resendClient: ResendClient;
};
