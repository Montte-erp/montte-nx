import { describe, expect, it } from "vitest";
import { createMockPostHog } from "./helpers/create-mock-posthog";
import {
   captureSDKAuthorFetched,
   captureSDKContentListed,
   captureSDKContentFetched,
   captureSDKImageFetched,
   captureSDKAuthFailed,
   captureSDKError,
} from "../src/sdk/server";

function createClient() {
   return createMockPostHog();
}

describe("captureSDKAuthorFetched", () => {
   it("captures with organization group", () => {
      const client = createClient();
      captureSDKAuthorFetched(client, {
         userId: "u-1",
         organizationId: "org-1",
         agentId: "agent-1",
         found: true,
         latencyMs: 42,
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "u-1",
         event: "sdk_author_fetched",
         properties: { agentId: "agent-1", found: true, latencyMs: 42 },
         groups: { organization: "org-1" },
      });
   });

   it("omits groups without organizationId", () => {
      const client = createClient();
      captureSDKAuthorFetched(client, {
         userId: "u-1",
         agentId: "agent-1",
         found: false,
         latencyMs: 10,
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "u-1",
         event: "sdk_author_fetched",
         properties: { agentId: "agent-1", found: false, latencyMs: 10 },
         groups: undefined,
      });
   });
});

describe("captureSDKContentListed", () => {
   it("captures with all properties", () => {
      const client = createClient();
      captureSDKContentListed(client, {
         userId: "u-1",
         organizationId: "org-1",
         agentId: "agent-1",
         limit: 10,
         page: 1,
         status: ["published"],
         totalCount: 50,
         latencyMs: 100,
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "u-1",
         event: "sdk_content_listed",
         properties: {
            agentId: "agent-1",
            limit: 10,
            page: 1,
            status: ["published"],
            totalCount: 50,
            latencyMs: 100,
         },
         groups: { organization: "org-1" },
      });
   });
});

describe("captureSDKContentFetched", () => {
   it("captures with slug and found status", () => {
      const client = createClient();
      captureSDKContentFetched(client, {
         userId: "u-1",
         organizationId: "org-1",
         agentId: "agent-1",
         slug: "my-post",
         found: true,
         latencyMs: 25,
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "u-1",
         event: "sdk_content_fetched",
         properties: {
            agentId: "agent-1",
            slug: "my-post",
            found: true,
            latencyMs: 25,
         },
         groups: { organization: "org-1" },
      });
   });
});

describe("captureSDKImageFetched", () => {
   it("captures image fetch event", () => {
      const client = createClient();
      captureSDKImageFetched(client, {
         userId: "u-1",
         organizationId: "org-1",
         found: true,
         latencyMs: 200,
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "u-1",
         event: "sdk_image_fetched",
         properties: { found: true, latencyMs: 200 },
         groups: { organization: "org-1" },
      });
   });
});

describe("captureSDKAuthFailed", () => {
   it("uses organizationId as distinctId when available", () => {
      const client = createClient();
      captureSDKAuthFailed(client, {
         organizationId: "org-1",
         reason: "invalid_key",
         plan: "free",
         endpoint: "/api/content",
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "org-1",
         event: "sdk_auth_failed",
         properties: {
            reason: "invalid_key",
            plan: "free",
            endpoint: "/api/content",
         },
         groups: { organization: "org-1" },
      });
   });

   it("falls back to anonymous_sdk_user without organizationId", () => {
      const client = createClient();
      captureSDKAuthFailed(client, {
         reason: "missing_api_key",
         endpoint: "/api/content",
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "anonymous_sdk_user",
         event: "sdk_auth_failed",
         properties: {
            reason: "missing_api_key",
            plan: undefined,
            endpoint: "/api/content",
         },
         groups: undefined,
      });
   });
});

describe("captureSDKError", () => {
   it("uses userId as distinctId", () => {
      const client = createClient();
      captureSDKError(client, {
         userId: "u-1",
         organizationId: "org-1",
         endpoint: "/api/content",
         errorCode: "500",
         errorMessage: "Internal error",
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "u-1",
         event: "sdk_error",
         properties: {
            endpoint: "/api/content",
            errorCode: "500",
            errorMessage: "Internal error",
         },
         groups: { organization: "org-1" },
      });
   });

   it("falls back to organizationId then anonymous", () => {
      const client = createClient();
      captureSDKError(client, {
         organizationId: "org-1",
         endpoint: "/api/content",
         errorCode: "403",
         errorMessage: "Forbidden",
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "org-1",
         event: "sdk_error",
         properties: {
            endpoint: "/api/content",
            errorCode: "403",
            errorMessage: "Forbidden",
         },
         groups: { organization: "org-1" },
      });
   });

   it("falls back to anonymous_sdk_user with no ids", () => {
      const client = createClient();
      captureSDKError(client, {
         endpoint: "/api/content",
         errorCode: "500",
         errorMessage: "Crash",
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "anonymous_sdk_user",
         event: "sdk_error",
         properties: {
            endpoint: "/api/content",
            errorCode: "500",
            errorMessage: "Crash",
         },
         groups: undefined,
      });
   });
});
