import type { AuthInstance } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import type { createJobPublisher } from "@packages/notifications/publisher";
import type { HyprPayClient } from "@montte/hyprpay";
export interface ORPCContext {
   headers: Headers;
   request: Request;
}
export interface ORPCContextWithAuth extends ORPCContext {
   auth: AuthInstance;
   db: DatabaseInstance;
   session: Awaited<ReturnType<AuthInstance["api"]["getSession"]>> | null;
   posthog: PostHog;
   redis: Redis;
   workflowClient: DBOSClient;
   jobPublisher: ReturnType<typeof createJobPublisher>;
   hyprpayClient: HyprPayClient;
}
export interface ORPCContextAuthenticated extends ORPCContextWithAuth {
   session: NonNullable<ORPCContextWithAuth["session"]>;
   userId: string;
}
export interface ORPCContextWithOrganization extends ORPCContextAuthenticated {
   organizationId: string;
   teamId: string;
}
//# sourceMappingURL=context.d.ts.map
