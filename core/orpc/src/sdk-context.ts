import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";

export interface SDKBaseContext {
   db: DatabaseInstance;
   posthog: PostHog;
   request: Request;
   workflowClient: DBOSClient;
}

export interface SDKContext extends SDKBaseContext {
   organizationId: string;
   teamId?: string;
   plan: string;
   sdkMode: "static" | "ssr";
   remaining: number | null;
   userId?: string;
   apiKeyType: "public" | "private";
}

export interface SDKAuthData {
   organizationId: string;
   teamId: string | undefined;
   userId: string | undefined;
   plan: string;
   sdkMode: "static" | "ssr";
   remaining: number | null;
   apiKeyType: "public" | "private";
}

export type SDKAuthError =
   | { code: "MISSING_KEY" }
   | { code: "RATE_LIMITED" }
   | { code: "INVALID_KEY" }
   | { code: "NO_ORGANIZATION" };
