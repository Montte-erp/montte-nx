import { beforeEach, describe, expect, it, vi } from "vitest";

const { posthogClientMock, posthogConstructorMock } = vi.hoisted(() => {
   const client = {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      isFeatureEnabled: vi
         .fn<() => Promise<boolean | undefined>>()
         .mockResolvedValue(false),
      getFeatureFlag: vi
         .fn<() => Promise<string | boolean | undefined>>()
         .mockResolvedValue(undefined),
      getFeatureFlagPayload: vi
         .fn<() => Promise<unknown>>()
         .mockResolvedValue(undefined),
      getAllFlags: vi
         .fn<() => Promise<Record<string, string | boolean>>>()
         .mockResolvedValue({}),
      getAllFlagsAndPayloads: vi
         .fn<
            () => Promise<{
               featureFlags?: Record<string, string | boolean>;
               featureFlagPayloads?: Record<string, unknown>;
            }>
         >()
         .mockResolvedValue({
            featureFlags: {},
            featureFlagPayloads: {},
         }),
   };

   return {
      posthogClientMock: client,
      posthogConstructorMock: vi.fn(),
   };
});

vi.mock("@core/environment/web/server", () => ({
   env: {
      POSTHOG_HOST: "https://app.posthog.com",
      POSTHOG_KEY: "phc_test_key",
   },
}));

vi.mock("posthog-node", () => ({
   PostHog: function MockPostHog(...args: unknown[]) {
      posthogConstructorMock(...args);
      return posthogClientMock;
   },
}));

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

beforeEach(() => {
   vi.clearAllMocks();
});

describe("posthog singleton", () => {
   it("creates the client with env configuration", async () => {
      const { posthog } = await import("../src/server");

      expect(posthog).toBe(posthogClientMock);
   });
});

describe("identifyUser", () => {
   it("calls identify with userId and properties", () => {
      identifyUser("user-1", { email: "a@b.com", name: "A" });

      expect(posthogClientMock.identify).toHaveBeenCalledWith({
         distinctId: "user-1",
         properties: { email: "a@b.com", name: "A" },
      });
   });

   it("defaults to empty properties", () => {
      identifyUser("user-2");

      expect(posthogClientMock.identify).toHaveBeenCalledWith({
         distinctId: "user-2",
         properties: {},
      });
   });
});

describe("setGroup", () => {
   it("calls groupIdentify with organization type", () => {
      setGroup("org-1", { name: "Acme", slug: "acme" });

      expect(posthogClientMock.groupIdentify).toHaveBeenCalledWith({
         groupKey: "org-1",
         groupType: "organization",
         properties: { name: "Acme", slug: "acme" },
      });
   });

   it("defaults to empty properties", () => {
      setGroup("org-2");

      expect(posthogClientMock.groupIdentify).toHaveBeenCalledWith({
         groupKey: "org-2",
         groupType: "organization",
         properties: {},
      });
   });
});

describe("captureError", () => {
   it("captures orpc_error with organization group", () => {
      captureError({
         userId: "user-1",
         organizationId: "org-1",
         errorId: "err-1",
         path: "content.create",
         code: "BAD_REQUEST",
         message: "Invalid",
         input: { x: 1 },
      });

      expect(posthogClientMock.capture).toHaveBeenCalledWith({
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
      captureError({
         userId: "user-1",
         errorId: "err-2",
         path: "auth.login",
         code: "UNAUTHORIZED",
         message: "Denied",
      });

      expect(posthogClientMock.capture).toHaveBeenCalledWith({
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
      const ts = new Date("2026-01-01");
      captureServerEvent({
         userId: "user-1",
         event: "purchase",
         properties: { amount: 99 },
         groups: { organization: "org-1" },
         timestamp: ts,
      });

      expect(posthogClientMock.capture).toHaveBeenCalledWith({
         distinctId: "user-1",
         event: "purchase",
         properties: { amount: 99 },
         groups: { organization: "org-1" },
         timestamp: ts,
      });
   });

   it("defaults properties to empty object", () => {
      captureServerEvent({ userId: "user-1", event: "ping" });

      expect(posthogClientMock.capture).toHaveBeenCalledWith({
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
      posthogClientMock.isFeatureEnabled.mockResolvedValue(true);

      const result = await isFeatureEnabled("flag-1", {
         userId: "u-1",
      });
      expect(result).toBe(true);
   });

   it("returns false when disabled", async () => {
      posthogClientMock.isFeatureEnabled.mockResolvedValue(false);

      const result = await isFeatureEnabled("flag-2", {
         userId: "u-1",
      });
      expect(result).toBe(false);
   });

   it("returns false when undefined", async () => {
      posthogClientMock.isFeatureEnabled.mockResolvedValue(undefined);

      const result = await isFeatureEnabled("flag-3", {
         userId: "u-1",
      });
      expect(result).toBe(false);
   });

   it("passes user and group properties", async () => {
      posthogClientMock.isFeatureEnabled.mockResolvedValue(true);

      await isFeatureEnabled("flag-4", {
         userId: "u-1",
         userProperties: { plan: "pro" },
         groups: { organization: "org-1" },
         groupProperties: { organization: { tier: "enterprise" } },
      });

      expect(posthogClientMock.isFeatureEnabled).toHaveBeenCalledWith(
         "flag-4",
         "u-1",
         {
            personProperties: { plan: "pro" },
            groups: { organization: "org-1" },
            groupProperties: { organization: { tier: "enterprise" } },
         },
      );
   });
});

describe("getFeatureFlag", () => {
   it("returns string variant", async () => {
      posthogClientMock.getFeatureFlag.mockResolvedValue("variant-a");

      const result = await getFeatureFlag("ab-test", { userId: "u-1" });
      expect(result).toBe("variant-a");
   });

   it("returns boolean flag", async () => {
      posthogClientMock.getFeatureFlag.mockResolvedValue(true);

      const result = await getFeatureFlag("bool-flag", {
         userId: "u-1",
      });
      expect(result).toBe(true);
   });
});

describe("getFeatureFlagPayload", () => {
   it("returns payload", async () => {
      const payload = { color: "blue" };
      posthogClientMock.getFeatureFlagPayload.mockResolvedValue(payload);

      const result = await getFeatureFlagPayload("config", "u-1");
      expect(result).toEqual(payload);
   });

   it("passes matchValue", async () => {
      posthogClientMock.getFeatureFlagPayload.mockResolvedValue({});

      await getFeatureFlagPayload("ab", "u-1", "variant-b");

      expect(posthogClientMock.getFeatureFlagPayload).toHaveBeenCalledWith(
         "ab",
         "u-1",
         "variant-b",
      );
   });
});

describe("getAllFeatureFlags", () => {
   it("returns all flags", async () => {
      const flags = { a: true, b: "v1" };
      posthogClientMock.getAllFlags.mockResolvedValue(flags);

      const result = await getAllFeatureFlags({ userId: "u-1" });
      expect(result).toEqual(flags);
   });
});

describe("getAllFeatureFlagsAndPayloads", () => {
   it("returns flags and payloads", async () => {
      posthogClientMock.getAllFlagsAndPayloads.mockResolvedValue({
         featureFlags: { a: true },
         featureFlagPayloads: { a: { x: 1 } },
      });

      const result = await getAllFeatureFlagsAndPayloads({ userId: "u-1" });
      expect(result.featureFlags).toEqual({ a: true });
      expect(result.featureFlagPayloads).toEqual({ a: { x: 1 } });
   });

   it("defaults to empty objects when response is empty", async () => {
      posthogClientMock.getAllFlagsAndPayloads.mockResolvedValue({});

      const result = await getAllFeatureFlagsAndPayloads({ userId: "u-1" });
      expect(result.featureFlags).toEqual({});
      expect(result.featureFlagPayloads).toEqual({});
   });
});

describe("shutdownPosthog", () => {
   it("calls shutdown", async () => {
      await shutdownPosthog();
      expect(posthogClientMock.shutdown).toHaveBeenCalled();
   });
});
