import type { AuthInstance } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import type { S3Client } from "@core/files/client";
import type { PostHog, Prompts } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import type { WorkflowClient } from "@core/dbos/client";

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
   workflowClient: WorkflowClient;
   s3Client: S3Client;
}

export interface ORPCContextAuthenticated extends ORPCContextWithAuth {
   session: NonNullable<ORPCContextWithAuth["session"]>;
   userId: string;
}

export interface ORPCContextWithOrganization extends ORPCContextAuthenticated {
   organizationId: string;
   teamId: string;
}
