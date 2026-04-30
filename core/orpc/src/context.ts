import type { AuthInstance } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog, Prompts } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";

export interface ORPCContext {
   headers: Headers;
   request: Request;
}

export interface ORPCContextWithAuth extends ORPCContext {
   auth: AuthInstance;
   db: DatabaseInstance;
   session: Awaited<ReturnType<AuthInstance["api"]["getSession"]>> | null;
   posthog: PostHog;
   posthogPrompts: Prompts;
   redis: Redis;
   workflowClient: DBOSClient;
}

export interface ORPCContextAuthenticated extends ORPCContextWithAuth {
   session: NonNullable<ORPCContextWithAuth["session"]>;
   userId: string;
}

export interface ORPCContextWithOrganization extends ORPCContextAuthenticated {
   organizationId: string;
   teamId: string;
}
