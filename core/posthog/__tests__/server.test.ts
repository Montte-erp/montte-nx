import { describe, expect, it } from "vitest";
import { createMockPostHog } from "./helpers/create-mock-posthog";
import {
   captureError,
   captureServerEvent,
   getAllFeatureFlags,
   getAllFeatureFlagsAndPayloads,
   getFeatureFlag,
   getFeatureFlagPayload,
   identifyUser,
   isFeatureEnabled,
   setGroup,
   shutdownPosthog,
} from "../src/server";

function createClient() {
   return createMockPostHog();
}

describe("identifyUser", () => {
   it("calls identify with userId and properties", () => {
      const client = createClient();
      identifyUser(client, "user-1", { email: "a@b.com", name: "A" });

      expect(client.identify).toHaveBeenCalledWith({
         distinctId: "user-1",
         properties: { email: "a@b.com", name: "A" },
      });
   });

   it("defaults to empty properties", () => {
      const client = createClient();
      identifyUser(client, "user-2");

      expect(client.identify).toHaveBeenCalledWith({
         distinctId: "user-2",
         properties: {},
      });
   });
});

describe("setGroup", () => {
   it("calls groupIdentify with organization type", () => {
      const client = createClient();
      setGroup(client, "org-1", { name: "Acme", slug: "acme" });

      expect(client.groupIdentify).toHaveBeenCalledWith({
         groupKey: "org-1",
         groupType: "organization",
         properties: { name: "Acme", slug: "acme" },
      });
   });

   it("defaults to empty properties", () => {
      const client = createClient();
      setGroup(client, "org-2");

      expect(client.groupIdentify).toHaveBeenCalledWith({
         groupKey: "org-2",
         groupType: "organization",
         properties: {},
      });
   });
});

describe("captureError", () => {
   it("captures orpc_error with organization group", () => {
      const client = createClient();
      captureError(client, {
         userId: "user-1",
         organizationId: "org-1",
         errorId: "err-1",
         path: "content.create",
         code: "BAD_REQUEST",
         message: "Invalid",
         input: { x: 1 },
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "user-1",
         event: "orpc_error",
         properties: {
            code: "BAD_REQUEST",
            errorId: "err-1",
            input: { x: 1 },
            message: "Invalid",
            path: "content.create",
         },
         groups: { organization: "org-1" },
      });
   });

   it("omits groups when no organizationId", () => {
      const client = createClient();
      captureError(client, {
         userId: "user-1",
         errorId: "err-2",
         path: "auth.login",
         code: "UNAUTHORIZED",
         message: "Denied",
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "user-1",
         event: "orpc_error",
         properties: {
            code: "UNAUTHORIZED",
            errorId: "err-2",
            input: undefined,
            message: "Denied",
            path: "auth.login",
         },
         groups: undefined,
      });
   });
});

describe("captureServerEvent", () => {
   it("captures event with all properties", () => {
      const client = createClient();
      const ts = new Date("2026-01-01");
      captureServerEvent(client, {
         userId: "user-1",
         event: "purchase",
         properties: { amount: 99 },
         groups: { organization: "org-1" },
         timestamp: ts,
      });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "user-1",
         event: "purchase",
         properties: { amount: 99 },
         groups: { organization: "org-1" },
         timestamp: ts,
      });
   });

   it("defaults properties to empty object", () => {
      const client = createClient();
      captureServerEvent(client, { userId: "user-1", event: "ping" });

      expect(client.capture).toHaveBeenCalledWith({
         distinctId: "user-1",
         event: "ping",
         properties: {},
         groups: undefined,
         timestamp: undefined,
      });
   });
});

describe("isFeatureEnabled", () => {
   it("returns true when enabled", async () => {
      const client = createClient();
      client.isFeatureEnabled.mockResolvedValue(true);

      const result = await isFeatureEnabled(client, "flag-1", {
         userId: "u-1",
      });
      expect(result).toBe(true);
   });

   it("returns false when disabled", async () => {
      const client = createClient();
      client.isFeatureEnabled.mockResolvedValue(false);

      const result = await isFeatureEnabled(client, "flag-2", {
         userId: "u-1",
      });
      expect(result).toBe(false);
   });

   it("returns false when undefined", async () => {
      const client = createClient();
      client.isFeatureEnabled.mockResolvedValue(undefined);

      const result = await isFeatureEnabled(client, "flag-3", {
         userId: "u-1",
      });
      expect(result).toBe(false);
   });

   it("passes user and group properties", async () => {
      const client = createClient();
      client.isFeatureEnabled.mockResolvedValue(true);

      await isFeatureEnabled(client, "flag-4", {
         userId: "u-1",
         userProperties: { plan: "pro" },
         groups: { organization: "org-1" },
         groupProperties: { organization: { tier: "enterprise" } },
      });

      expect(client.isFeatureEnabled).toHaveBeenCalledWith("flag-4", "u-1", {
         personProperties: { plan: "pro" },
         groups: { organization: "org-1" },
         groupProperties: { organization: { tier: "enterprise" } },
      });
   });
});

describe("getFeatureFlag", () => {
   it("returns string variant", async () => {
      const client = createClient();
      client.getFeatureFlag.mockResolvedValue("variant-a");

      const result = await getFeatureFlag(client, "ab-test", { userId: "u-1" });
      expect(result).toBe("variant-a");
   });

   it("returns boolean flag", async () => {
      const client = createClient();
      client.getFeatureFlag.mockResolvedValue(true);

      const result = await getFeatureFlag(client, "bool-flag", {
         userId: "u-1",
      });
      expect(result).toBe(true);
   });
});

describe("getFeatureFlagPayload", () => {
   it("returns payload", async () => {
      const client = createClient();
      const payload = { color: "blue" };
      client.getFeatureFlagPayload.mockResolvedValue(payload);

      const result = await getFeatureFlagPayload(client, "config", "u-1");
      expect(result).toEqual(payload);
   });

   it("passes matchValue", async () => {
      const client = createClient();
      client.getFeatureFlagPayload.mockResolvedValue({});

      await getFeatureFlagPayload(client, "ab", "u-1", "variant-b");

      expect(client.getFeatureFlagPayload).toHaveBeenCalledWith(
         "ab",
         "u-1",
         "variant-b",
      );
   });
});

describe("getAllFeatureFlags", () => {
   it("returns all flags", async () => {
      const client = createClient();
      const flags = { a: true, b: "v1" };
      client.getAllFlags.mockResolvedValue(flags);

      const result = await getAllFeatureFlags(client, { userId: "u-1" });
      expect(result).toEqual(flags);
   });
});

describe("getAllFeatureFlagsAndPayloads", () => {
   it("returns flags and payloads", async () => {
      const client = createClient();
      client.getAllFlagsAndPayloads.mockResolvedValue({
         featureFlags: { a: true },
         featureFlagPayloads: { a: { x: 1 } },
      });

      const result = await getAllFeatureFlagsAndPayloads(client, {
         userId: "u-1",
      });
      expect(result.featureFlags).toEqual({ a: true });
      expect(result.featureFlagPayloads).toEqual({ a: { x: 1 } });
   });

   it("defaults to empty objects when response is empty", async () => {
      const client = createClient();
      client.getAllFlagsAndPayloads.mockResolvedValue({});

      const result = await getAllFeatureFlagsAndPayloads(client, {
         userId: "u-1",
      });
      expect(result.featureFlags).toEqual({});
      expect(result.featureFlagPayloads).toEqual({});
   });
});

describe("shutdownPosthog", () => {
   it("calls shutdown", async () => {
      const client = createClient();
      await shutdownPosthog(client);
      expect(client.shutdown).toHaveBeenCalled();
   });
});
