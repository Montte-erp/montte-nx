# PostHog Core — Vitest Migration & Test Coverage

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate `core/posthog` tests from `bun:test` to Vitest, fix stale tests, add full SDK function coverage, and use proper mocks instead of real PostHog instances.

**Architecture:** All functions accept a `PostHog` instance as first argument — perfect for dependency injection. Tests should use a mock object (not a real PostHog client) and verify the correct methods are called with correct args. No network calls needed.

**Tech Stack:** Vitest, `vi.fn()` mocks, `vite-tsconfig-paths`

---

### Task 1: Add Vitest Config

**Files:**
- Create: `core/posthog/vitest.config.ts`
- Create: `core/posthog/tsconfig.test.json`
- Modify: `core/posthog/package.json`

**Step 1: Create `vitest.config.ts`**

```typescript
import viteTsConfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
   plugins: [
      viteTsConfigPaths({
         projects: ["./tsconfig.test.json"],
      }),
   ],
   test: {
      include: ["./__tests__/**/*.test.ts"],
   },
});
```

**Step 2: Create `tsconfig.test.json`**

```json
{
   "extends": "@tooling/typescript/tsconfig.package.json",
   "include": ["src", "__tests__"]
}
```

**Step 3: Update `package.json` test script**

Change `"test": "bun test"` → `"test": "vitest run --passWithNoTests"`

**Step 4: Verify config works**

Run: `npx vitest run --passWithNoTests -c core/posthog/vitest.config.ts`
Expected: PASS (no tests found yet, passes with no tests)

**Step 5: Commit**

```bash
git add core/posthog/vitest.config.ts core/posthog/tsconfig.test.json core/posthog/package.json
git commit -m "chore(posthog): add vitest config"
```

---

### Task 2: Create Mock Helper

**Files:**
- Create: `core/posthog/__tests__/helpers/create-mock-posthog.ts`

**Step 1: Create the mock factory**

Every function in `server.ts` and `sdk/server.ts` takes a `PostHog` instance. Instead of creating real clients (which start background flush timers), create a typed mock object with `vi.fn()` stubs for each method used.

```typescript
import { vi } from "vitest";
import type { PostHog } from "posthog-node";

export function createMockPostHog() {
   return {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      isFeatureEnabled: vi.fn<() => Promise<boolean | undefined>>().mockResolvedValue(false),
      getFeatureFlag: vi.fn<() => Promise<string | boolean | undefined>>().mockResolvedValue(undefined),
      getFeatureFlagPayload: vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined),
      getAllFlags: vi.fn<() => Promise<Record<string, string | boolean>>>().mockResolvedValue({}),
      getAllFlagsAndPayloads: vi.fn<() => Promise<{ featureFlags: Record<string, string | boolean>; featureFlagPayloads: Record<string, unknown> }>>().mockResolvedValue({
         featureFlags: {},
         featureFlagPayloads: {},
      }),
   } as unknown as PostHog & {
      capture: ReturnType<typeof vi.fn>;
      identify: ReturnType<typeof vi.fn>;
      groupIdentify: ReturnType<typeof vi.fn>;
      shutdown: ReturnType<typeof vi.fn>;
      isFeatureEnabled: ReturnType<typeof vi.fn>;
      getFeatureFlag: ReturnType<typeof vi.fn>;
      getFeatureFlagPayload: ReturnType<typeof vi.fn>;
      getAllFlags: ReturnType<typeof vi.fn>;
      getAllFlagsAndPayloads: ReturnType<typeof vi.fn>;
   };
}
```

**Step 2: Commit**

```bash
git add core/posthog/__tests__/helpers/create-mock-posthog.ts
git commit -m "test(posthog): add mock PostHog factory"
```

---

### Task 3: Rewrite `server.test.ts` with Vitest + Mocks

**Files:**
- Rewrite: `core/posthog/__tests__/server.test.ts`

**Step 1: Write the full test file**

Key changes from the old tests:
- `bun:test` → `vitest`
- Real `PostHog` instances → `createMockPostHog()`
- Fix stale event name: test expected `"trpc_error"` but code emits `"orpc_error"`
- Fix `captureError` assertion for missing `organizationId` — code sets `groups: undefined` (key present but undefined)

```typescript
import { beforeEach, describe, expect, it } from "vitest";
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

      const result = await isFeatureEnabled(client, "flag-1", { userId: "u-1" });
      expect(result).toBe(true);
   });

   it("returns false when disabled", async () => {
      const client = createClient();
      client.isFeatureEnabled.mockResolvedValue(false);

      const result = await isFeatureEnabled(client, "flag-2", { userId: "u-1" });
      expect(result).toBe(false);
   });

   it("returns false when undefined", async () => {
      const client = createClient();
      client.isFeatureEnabled.mockResolvedValue(undefined);

      const result = await isFeatureEnabled(client, "flag-3", { userId: "u-1" });
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

      const result = await getFeatureFlag(client, "bool-flag", { userId: "u-1" });
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

      expect(client.getFeatureFlagPayload).toHaveBeenCalledWith("ab", "u-1", "variant-b");
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

      const result = await getAllFeatureFlagsAndPayloads(client, { userId: "u-1" });
      expect(result.featureFlags).toEqual({ a: true });
      expect(result.featureFlagPayloads).toEqual({ a: { x: 1 } });
   });

   it("defaults to empty objects when response is empty", async () => {
      const client = createClient();
      client.getAllFlagsAndPayloads.mockResolvedValue({});

      const result = await getAllFeatureFlagsAndPayloads(client, { userId: "u-1" });
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
```

**Step 2: Run tests**

Run: `npx vitest run -c core/posthog/vitest.config.ts __tests__/server.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add core/posthog/__tests__/server.test.ts
git commit -m "test(posthog): rewrite server tests with vitest and mocks"
```

---

### Task 4: Add SDK Server Tests

**Files:**
- Create: `core/posthog/__tests__/sdk-server.test.ts`

The SDK has 6 capture functions — all untested. Each follows the same pattern: destructure props, call `posthog.capture()` with event name, properties, and optional group.

**Step 1: Write the test file**

```typescript
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
         properties: { agentId: "agent-1", slug: "my-post", found: true, latencyMs: 25 },
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
         properties: { reason: "invalid_key", plan: "free", endpoint: "/api/content" },
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
         properties: { reason: "missing_api_key", plan: undefined, endpoint: "/api/content" },
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
         properties: { endpoint: "/api/content", errorCode: "500", errorMessage: "Internal error" },
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
         properties: { endpoint: "/api/content", errorCode: "403", errorMessage: "Forbidden" },
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
         properties: { endpoint: "/api/content", errorCode: "500", errorMessage: "Crash" },
         groups: undefined,
      });
   });
});
```

**Step 2: Run tests**

Run: `npx vitest run -c core/posthog/vitest.config.ts __tests__/sdk-server.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add core/posthog/__tests__/sdk-server.test.ts
git commit -m "test(posthog): add SDK server function tests"
```

---

### Task 5: Delete Dead Client Test & Clean Up

**Files:**
- Delete: `core/posthog/__tests__/client.test.ts`
- Modify: `core/posthog/src/sdk/server.ts` (remove comments)

**Step 1: Delete `client.test.ts`**

This test imports `../src/client` which doesn't exist. It's dead code from a removed client module.

```bash
rm core/posthog/__tests__/client.test.ts
```

**Step 2: Clean up section divider comments in `sdk/server.ts`**

Remove all `// ============` dividers and JSDoc comments from `sdk/server.ts` — per codebase convention, no comments in code.

**Step 3: Clean up section divider comments in `sdk/types.ts`**

Remove all `// ============` dividers and JSDoc comments from `sdk/types.ts`.

**Step 4: Run all posthog tests**

Run: `npx vitest run -c core/posthog/vitest.config.ts`
Expected: All PASS (server.test.ts + sdk-server.test.ts)

**Step 5: Commit**

```bash
git add -u core/posthog/
git commit -m "chore(posthog): remove dead client test and clean up comments"
```

---

### Task 6: Run Full Suite & Verify

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: No new errors

**Step 2: Run all tests**

Run: `bun run test`
Expected: All pass including new posthog tests

**Step 3: Run lint**

Run: `bun run check`
Expected: No new errors
