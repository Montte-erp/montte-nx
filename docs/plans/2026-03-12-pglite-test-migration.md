# PGlite + Better Auth Test Utils Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mock-based oRPC router tests with integration tests using PGlite (in-memory Postgres) and Better Auth's `testUtils()` plugin for real database operations and real auth sessions.

**Architecture:** Create a test-specific Better Auth factory that accepts a PGlite-backed Drizzle instance (no env dependencies). Build a shared test harness (`setupIntegrationTest`) that boots PGlite, pushes schema, creates a test auth instance with `testUtils()`, and provides helpers to create users/orgs/teams/sessions. Router tests call handlers via `call()` with a context built from real auth sessions and a real database. Only external services (arcjet, posthog, stripe, minio) remain mocked.

**Tech Stack:** PGlite (`@electric-sql/pglite`), Better Auth (`better-auth/plugins` testUtils), Drizzle ORM, Vitest, oRPC `call()`

---

## Phase 0: Infrastructure

### Task 1: Create test auth factory

A factory function that creates a Better Auth instance using a given Drizzle database, with no env imports. Includes `testUtils()` plugin. Lives in the test helpers directory so it's never imported in production.

**Files:**
- Create: `apps/web/__tests__/helpers/create-test-auth.ts`

**Step 1: Write the factory**

```typescript
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { organization } from "better-auth/plugins";
import { testUtils } from "better-auth/plugins";
import type { DatabaseInstance } from "@core/database/client";
import { z } from "zod";

export function createTestAuth(db: DatabaseInstance) {
   return betterAuth({
      baseURL: "http://localhost:3000",
      secret: "test-secret-at-least-32-characters-long!!",

      database: drizzleAdapter(db, { provider: "pg" }),

      advanced: {
         database: { generateId: "uuid" },
      },

      emailAndPassword: {
         enabled: true,
         requireEmailVerification: false,
      },

      session: {
         storeSessionInDatabase: true,
      },

      user: {
         additionalFields: {
            telemetryConsent: {
               defaultValue: false,
               input: true,
               required: true,
               type: "boolean",
            },
         },
      },

      plugins: [
         organization({
            schema: {
               organization: {
                  additionalFields: {
                     context: { defaultValue: "personal", input: true, required: false, type: "string" },
                     description: { defaultValue: "", input: true, required: false, type: "string" },
                     onboardingCompleted: { defaultValue: false, input: true, required: false, type: "boolean" },
                  },
               },
               team: {
                  additionalFields: {
                     slug: { input: true, required: true, type: "string" },
                     description: { defaultValue: "", input: true, required: false, type: "string" },
                     allowedDomains: {
                        type: "string[]",
                        input: true,
                        required: false,
                        validator: {
                           input: z.array(z.string().regex(/^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/)),
                        },
                     },
                     onboardingCompleted: { defaultValue: false, input: true, required: false, type: "boolean" },
                     onboardingProducts: {
                        defaultValue: null, input: true, required: false, type: "json",
                        validator: { input: z.array(z.enum(["content", "forms", "analytics"])).nullable() },
                     },
                     onboardingTasks: {
                        defaultValue: null, input: true, required: false, type: "json",
                        validator: { input: z.record(z.string(), z.boolean()).nullable() },
                     },
                     accountType: {
                        defaultValue: "personal", input: true, required: false, type: "string",
                        validator: { input: z.enum(["personal", "business"]).nullable().optional() },
                     },
                  },
               },
            },
            teams: {
               allowRemovingAllTeams: false,
               defaultTeam: { enabled: false },
               enabled: true,
               maximumMembersPerTeam: 50,
               maximumTeams: 10,
            },
         }),

         testUtils(),
      ],
   });
}

export type TestAuth = ReturnType<typeof createTestAuth>;
```

**Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit __tests__/helpers/create-test-auth.ts`

If `testUtils` import fails, check `better-auth` version and correct the import path (may be `better-auth/test-utils` or `better-auth/plugins/test-utils`). Consult https://better-auth.com/docs/plugins/test-utils for the exact import.

**Step 3: Commit**

```bash
git add apps/web/__tests__/helpers/create-test-auth.ts
git commit -m "test: add Better Auth test factory with testUtils plugin"
```

---

### Task 2: Create integration test harness

A single `setupIntegrationTest()` function that boots PGlite, pushes the full schema, creates a test auth instance, and provides helpers. This replaces `createTestContext()` for integration tests.

**Files:**
- Create: `apps/web/__tests__/helpers/setup-integration-test.ts`
- Modify: `apps/web/__tests__/helpers/mock-factories.ts` (add more factories as needed)

**Step 1: Write the harness**

```typescript
import { PGlite } from "@electric-sql/pglite";
import type { DatabaseInstance } from "@core/database/client";
import * as schema from "@core/database/schema";
import { relations } from "@core/database/relations";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api-postgres";
import { vi } from "vitest";
import { createTestAuth, type TestAuth } from "./create-test-auth";
import type { ORPCContextWithAuth } from "@/integrations/orpc/server";

export interface IntegrationTestContext {
   db: DatabaseInstance;
   auth: TestAuth;
   testHelpers: Awaited<ReturnType<TestAuth["$context"]>>["test"];
   cleanup: () => Promise<void>;
   createAuthenticatedContext: (options?: {
      organizationId?: string;
      teamId?: string;
   }) => Promise<ORPCContextWithAuth>;
}

let sharedClient: PGlite | null = null;
let sharedDb: DatabaseInstance | null = null;
let sharedAuth: TestAuth | null = null;

export async function setupIntegrationTest(): Promise<IntegrationTestContext> {
   if (!sharedClient) {
      sharedClient = new PGlite();
      sharedDb = drizzle({
         client: sharedClient,
         schema,
         relations,
      }) as unknown as DatabaseInstance;

      const { apply } = await pushSchema(schema, sharedDb as any, "snake_case");
      await apply();

      sharedAuth = createTestAuth(sharedDb);
   }

   const db = sharedDb!;
   const auth = sharedAuth!;
   const ctx = await auth.$context;
   const testHelpers = ctx.test;

   const createAuthenticatedContext = async (options?: {
      organizationId?: string;
      teamId?: string;
   }): Promise<ORPCContextWithAuth> => {
      const user = await testHelpers.createUser({
         email: `test-${crypto.randomUUID()}@test.com`,
         name: "Test User",
         password: "test-password-123",
         data: { telemetryConsent: true },
      });

      const session = await testHelpers.createSession(user.id);

      const headers = new Headers({
         Authorization: `Bearer ${session.token}`,
         cookie: `better-auth.session_token=${session.token}`,
      });

      return {
         auth: auth as any,
         db,
         headers,
         request: new Request("http://localhost", { headers }),
         session: {
            user: { id: user.id, email: user.email, name: user.name, telemetryConsent: true },
            session: {
               ...session,
               activeOrganizationId: options?.organizationId ?? null,
               activeTeamId: options?.teamId ?? null,
            },
         },
         posthog: {
            capture: vi.fn(),
            identify: vi.fn(),
            groupIdentify: vi.fn(),
            shutdown: vi.fn(),
         },
         stripeClient: undefined,
      } as unknown as ORPCContextWithAuth;
   };

   return {
      db,
      auth,
      testHelpers,
      cleanup: async () => {
         // Tables are cleaned between tests via truncation
      },
      createAuthenticatedContext,
   };
}

export async function cleanupIntegrationTest() {
   if (sharedClient) {
      await sharedClient.close();
      sharedClient = null;
      sharedDb = null;
      sharedAuth = null;
   }
}
```

**Important notes for the implementer:**
- The `testHelpers` API shape depends on the Better Auth version. Check the actual return type of `ctx.test` after the auth instance is created. It may expose `createUser`, `createSession`, `login`, `getAuthHeaders`, `saveUser`, etc.
- If `testHelpers.createUser` doesn't exist, use `auth.api.signUpEmail` with the request/response pattern instead, then `testHelpers.login({ userId })` to get headers.
- The `session.token` field name may vary — check what `testHelpers.createSession` or `testHelpers.login` actually returns.

**Step 2: Write a smoke test to verify the harness works**

Create `apps/web/__tests__/helpers/setup-integration-test.test.ts`:

```typescript
import { afterAll, describe, expect, it } from "vitest";
import { cleanupIntegrationTest, setupIntegrationTest } from "./setup-integration-test";

vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: { capture: vi.fn(), identify: vi.fn(), groupIdentify: vi.fn(), shutdown: vi.fn() },
}));

afterAll(async () => {
   await cleanupIntegrationTest();
});

describe("setupIntegrationTest", () => {
   it("creates a working database with schema", async () => {
      const { db } = await setupIntegrationTest();
      const result = await db.query.bankAccounts.findMany();
      expect(result).toEqual([]);
   });

   it("creates an authenticated context", async () => {
      const { createAuthenticatedContext } = await setupIntegrationTest();
      const ctx = await createAuthenticatedContext();
      expect(ctx.session.user.id).toBeDefined();
      expect(ctx.db).toBeDefined();
   });
});
```

**Step 3: Run the smoke test**

Run: `cd apps/web && npx vitest run __tests__/helpers/setup-integration-test.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add apps/web/__tests__/helpers/setup-integration-test.ts apps/web/__tests__/helpers/setup-integration-test.test.ts
git commit -m "test: add PGlite integration test harness with Better Auth testUtils"
```

---

### Task 3: Install `@electric-sql/pglite` as devDependency in apps/web

The PGlite package is currently only in `core/database`. Apps/web tests need it too.

**Step 1: Install**

```bash
cd apps/web && bun add -d @electric-sql/pglite
```

**Step 2: Verify it resolves**

```bash
cd apps/web && bun run -e "import('@electric-sql/pglite').then(m => console.log('OK', Object.keys(m)))"
```

**Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore: add @electric-sql/pglite devDependency to apps/web"
```

---

## Phase 1: Migrate one router as proof-of-concept

### Task 4: Rewrite bank-accounts test as integration test

Convert the existing mock-based `bank-accounts.test.ts` to use real PGlite database operations. This is the reference router — once this works, all other routers follow the same pattern.

**Files:**
- Modify: `apps/web/__tests__/integrations/orpc/router/bank-accounts.test.ts`

**Step 1: Rewrite the test**

The key changes:
1. Remove `vi.mock("@core/database/repositories/bank-accounts-repository")`
2. Remove `vi.mock("@core/database/client")`
3. Keep `vi.mock("@core/arcjet/protect")` and `vi.mock("@core/posthog/server")` (external services)
4. Use `setupIntegrationTest()` instead of `createTestContext()`
5. Insert real data into PGlite before each test
6. Assertions check real database state

```typescript
import { call } from "@orpc/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
   cleanupIntegrationTest,
   setupIntegrationTest,
   type IntegrationTestContext,
} from "../../../helpers/setup-integration-test";

vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(),
   captureServerEvent: vi.fn(),
   identifyUser: vi.fn(),
   setGroup: vi.fn(),
   posthog: { capture: vi.fn(), identify: vi.fn(), groupIdentify: vi.fn(), shutdown: vi.fn() },
}));

import * as bankAccountsRouter from "@/integrations/orpc/router/bank-accounts";
import { bankAccounts } from "@core/database/schemas/bank-accounts";
import { eq } from "drizzle-orm";

let ctx: IntegrationTestContext;
let teamId: string;

beforeAll(async () => {
   ctx = await setupIntegrationTest();
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   // Clean bank_accounts table between tests
   await ctx.db.delete(bankAccounts);

   // Create a fresh team for each test
   // (use auth API or direct insert depending on what testHelpers provides)
   teamId = "a0000000-0000-4000-8000-000000000001";
   // Insert a team record if needed for FK constraints
});

describe("create", () => {
   it("creates a bank account in the database", async () => {
      const context = await ctx.createAuthenticatedContext({ teamId });

      const result = await call(
         bankAccountsRouter.create,
         {
            name: "Nubank",
            type: "checking",
            color: "#6366f1",
            bankCode: "260",
            initialBalance: "1000.00",
         },
         { context },
      );

      expect(result.name).toBe("Nubank");
      expect(result.type).toBe("checking");
      expect(result.teamId).toBe(teamId);

      // Verify it's actually in the database
      const [dbRecord] = await ctx.db
         .select()
         .from(bankAccounts)
         .where(eq(bankAccounts.id, result.id));
      expect(dbRecord).toBeDefined();
      expect(dbRecord.name).toBe("Nubank");
   });
});

describe("getAll", () => {
   it("lists accounts with computed balances", async () => {
      const context = await ctx.createAuthenticatedContext({ teamId });

      // Create an account first
      await call(
         bankAccountsRouter.create,
         { name: "Conta 1", type: "checking", color: "#000", initialBalance: "500.00" },
         { context },
      );

      const result = await call(bankAccountsRouter.getAll, undefined, { context });

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Conta 1");
      expect(result[0].currentBalance).toBeDefined();
   });
});

describe("getById", () => {
   it("returns account with balance", async () => {
      const context = await ctx.createAuthenticatedContext({ teamId });
      const created = await call(
         bankAccountsRouter.create,
         { name: "Nubank", type: "checking", color: "#6366f1", initialBalance: "1000.00" },
         { context },
      );

      const result = await call(
         bankAccountsRouter.getById,
         { id: created.id },
         { context },
      );

      expect(result.name).toBe("Nubank");
      expect(result.currentBalance).toBe("1000.00");
   });

   it("throws NOT_FOUND for wrong team", async () => {
      const context1 = await ctx.createAuthenticatedContext({ teamId });
      const created = await call(
         bankAccountsRouter.create,
         { name: "Nubank", type: "checking", color: "#6366f1", initialBalance: "1000.00" },
         { context: context1 },
      );

      const otherTeamId = "b0000000-0000-4000-8000-000000000002";
      const context2 = await ctx.createAuthenticatedContext({ teamId: otherTeamId });

      await expect(
         call(bankAccountsRouter.getById, { id: created.id }, { context: context2 }),
      ).rejects.toThrow();
   });
});

describe("update", () => {
   it("updates account fields", async () => {
      const context = await ctx.createAuthenticatedContext({ teamId });
      const created = await call(
         bankAccountsRouter.create,
         { name: "Nubank", type: "checking", color: "#6366f1", initialBalance: "1000.00" },
         { context },
      );

      const updated = await call(
         bankAccountsRouter.update,
         { id: created.id, name: "Nubank PJ" },
         { context },
      );

      expect(updated.name).toBe("Nubank PJ");
   });
});

describe("remove", () => {
   it("deletes account with no transactions", async () => {
      const context = await ctx.createAuthenticatedContext({ teamId });
      const created = await call(
         bankAccountsRouter.create,
         { name: "Nubank", type: "checking", color: "#6366f1", initialBalance: "1000.00" },
         { context },
      );

      const result = await call(
         bankAccountsRouter.remove,
         { id: created.id },
         { context },
      );

      expect(result).toEqual({ success: true });

      // Verify it's gone from DB
      const remaining = await ctx.db
         .select()
         .from(bankAccounts)
         .where(eq(bankAccounts.id, created.id));
      expect(remaining).toHaveLength(0);
   });
});
```

**Step 2: Run the test**

Run: `cd apps/web && npx vitest run __tests__/integrations/orpc/router/bank-accounts.test.ts`
Expected: All tests PASS

**Troubleshooting:**
- If `@core/database/client` import fails (env validation), you need to mock ONLY the `db` singleton export, not the whole module: `vi.mock("@core/database/client", () => ({ db: {} }))`. But since repositories import `db` from `@core/database/client` directly, you may need to use `vi.mock` to redirect `db` to the PGlite instance. Check how repositories import `db` — if they use `import { db } from "@core/database/client"` at the top level, you must mock it to return the PGlite db:

```typescript
// At the top of the test file, BEFORE other imports
const { db: testDb } = await setupIntegrationTest();
vi.mock("@core/database/client", () => ({ db: testDb }));
```

This is the critical part — repositories use the `db` singleton, so the mock must point to PGlite.

- If Better Auth tables don't exist, ensure `pushSchema` includes the auth schema (it should, since `schema.ts` exports all schemas including auth).

**Step 3: Commit**

```bash
git add apps/web/__tests__/integrations/orpc/router/bank-accounts.test.ts
git commit -m "test: migrate bank-accounts router to PGlite integration tests"
```

---

### Task 5: Handle the `db` singleton problem

Repositories import `db` from `@core/database/client` at module level. For integration tests, this must point to PGlite. There are two approaches:

**Option A (recommended): Mock the db singleton to return PGlite instance**

Every integration test file needs this at the top (before other imports):

```typescript
import { vi } from "vitest";

// Must be before any repository imports
vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } = await import("../../../helpers/setup-integration-test");
   const db = await setupIntegrationDb();
   return { db, createDb: () => db };
});
```

This requires refactoring `setupIntegrationTest` to export a `setupIntegrationDb()` that returns just the db instance (cached).

**Option B: Pass db as parameter to repositories**

This would require changing all repository function signatures to accept `db` as a parameter. Some repositories already do this (e.g., `getOrganizationMembers(db, orgId)`), but most use the imported singleton. This is a much larger refactor and not recommended for this task.

**Go with Option A.** Update `setup-integration-test.ts` to export a standalone `setupIntegrationDb()`:

```typescript
let cachedDb: DatabaseInstance | null = null;

export async function setupIntegrationDb(): Promise<DatabaseInstance> {
   if (cachedDb) return cachedDb;

   const client = new PGlite();
   cachedDb = drizzle({ client, schema, relations }) as unknown as DatabaseInstance;

   const { apply } = await pushSchema(schema, cachedDb as any, "snake_case");
   await apply();

   return cachedDb;
}
```

**Step 1: Update the harness**

Add `setupIntegrationDb()` to `setup-integration-test.ts`.

**Step 2: Create a shared mock file**

Create `apps/web/__tests__/helpers/integration-mocks.ts`:

```typescript
import { vi } from "vitest";

export function mockExternalServices() {
   vi.mock("@core/arcjet/protect", () => ({
      protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
      isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
   }));

   vi.mock("@core/posthog/server", () => ({
      captureError: vi.fn(),
      captureServerEvent: vi.fn(),
      identifyUser: vi.fn(),
      setGroup: vi.fn(),
      posthog: { capture: vi.fn(), identify: vi.fn(), groupIdentify: vi.fn(), shutdown: vi.fn() },
   }));

   vi.mock("@core/files/client", () => ({
      generatePresignedPutUrl: vi.fn().mockResolvedValue("https://mock-presigned-url.com"),
   }));
}
```

**Note:** `vi.mock()` calls are hoisted by Vitest, so they'll execute before imports regardless of where `mockExternalServices()` is called. However, wrapping them in a function may prevent hoisting. If that happens, keep `vi.mock()` calls at the top level of each test file instead.

**Step 3: Commit**

```bash
git add apps/web/__tests__/helpers/setup-integration-test.ts apps/web/__tests__/helpers/integration-mocks.ts
git commit -m "test: add db singleton mock strategy and external service mocks"
```

---

## Phase 2: Migrate remaining data routers

Once bank-accounts works, migrate these routers one at a time. Each follows the same pattern:

1. Remove repository mocks
2. Mock `@core/database/client` to point to PGlite
3. Keep external service mocks (arcjet, posthog)
4. Insert real test data, assert real database state
5. Use `createAuthenticatedContext()` with a `teamId`

### Task 6: Migrate categories test
### Task 7: Migrate credit-cards test
### Task 8: Migrate tags test
### Task 9: Migrate contacts test
### Task 10: Migrate budget-goals test
### Task 11: Migrate bills test
### Task 12: Migrate transactions test
### Task 13: Migrate services test
### Task 14: Migrate services-bills test
### Task 15: Migrate inventory test
### Task 16: Migrate dashboards test (uses orgId + teamId)
### Task 17: Migrate insights test (uses orgId + teamId)
### Task 18: Migrate analytics test
### Task 19: Migrate webhooks test (uses auth.api — mock or use testUtils)

Each task follows the same template as Task 4. The implementer should:
1. Read the current test file
2. Read the router file to understand what data it needs
3. Read the repository to understand what tables are touched
4. Rewrite the test using real DB operations
5. Run and verify

---

## Phase 3: Migrate auth-heavy routers

These routers call `auth.api.*` methods. With testUtils, we can create real users and sessions, so `auth.api.getSession()`, `auth.api.listSessions()`, etc. will work against the PGlite database.

### Task 20: Migrate session test

The session router calls `auth.api.getSession`, `auth.api.listSessions`, `auth.api.revokeSession`, etc. With testUtils, these will work against real data.

**Key:** The `context.auth` must be the real test auth instance (not a mock). The `context.headers` must contain valid session cookies from `testHelpers.login()` or `testHelpers.getAuthHeaders()`.

```typescript
// Example pattern for auth-heavy tests
const { auth, testHelpers, db } = await setupIntegrationTest();

// Create user via testHelpers
const user = await testHelpers.createUser({ email: "test@test.com", password: "password123" });

// Get real auth headers
const { headers } = await testHelpers.login({ userId: user.id });

// Build context with real auth
const context = {
   auth,
   db,
   headers,
   request: new Request("http://localhost", { headers }),
   session: await auth.api.getSession({ headers }),
   // ...
};

// Call the router procedure
const result = await call(sessionRouter.getSession, undefined, { context });
```

### Task 21: Migrate account test
### Task 22: Migrate organization test
### Task 23: Migrate team test
### Task 24: Migrate onboarding test

---

## Phase 4: Migrate remaining routers

### Task 25: Migrate billing test (mock stripeClient)
### Task 26: Migrate agent test
### Task 27: Migrate chat test
### Task 28: Migrate search test
### Task 29: Migrate early-access test
### Task 30: Migrate feedback test

---

## Phase 5: Cleanup

### Task 31: Remove unused mock-only helpers

Once all tests are migrated, check if `createTestContext()`, `createUnauthenticatedContext()`, and `createNoOrgContext()` are still used. If not, remove them from `create-test-context.ts`.

### Task 32: Run full test suite

```bash
cd apps/web && npx vitest run
```

All tests must pass. Check for:
- Flaky tests (PGlite state leaking between tests)
- Slow tests (PGlite boot time — should be <1s shared)
- Missing table cleanup in `beforeEach`

### Task 33: Commit and finalize

```bash
git add -A
git commit -m "test: complete migration to PGlite integration tests"
```

---

## Key Patterns Reference

### Test file template (data routers)

```typescript
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupIntegrationTest, setupIntegrationTest, type IntegrationTestContext } from "../../../helpers/setup-integration-test";

vi.mock("@core/database/client", async () => {
   const { setupIntegrationDb } = await import("../../../helpers/setup-integration-test");
   return { db: await setupIntegrationDb() };
});
vi.mock("@core/arcjet/protect", () => ({
   protectWithRateLimit: vi.fn().mockResolvedValue({ isDenied: () => false }),
   isArcjetRateLimitDecision: vi.fn().mockReturnValue(false),
}));
vi.mock("@core/posthog/server", () => ({
   captureError: vi.fn(), captureServerEvent: vi.fn(),
   identifyUser: vi.fn(), setGroup: vi.fn(),
   posthog: { capture: vi.fn(), identify: vi.fn(), groupIdentify: vi.fn(), shutdown: vi.fn() },
}));

import * as myRouter from "@/integrations/orpc/router/my-router";
import { myTable } from "@core/database/schemas/my-table";

let ctx: IntegrationTestContext;

beforeAll(async () => {
   ctx = await setupIntegrationTest();
});

afterAll(async () => {
   await cleanupIntegrationTest();
});

beforeEach(async () => {
   await ctx.db.delete(myTable);
});

describe("create", () => {
   it("creates a record", async () => {
      const context = await ctx.createAuthenticatedContext({
         teamId: "a0000000-0000-4000-8000-000000000001",
      });
      const result = await call(myRouter.create, { name: "Test" }, { context });
      expect(result.name).toBe("Test");
   });
});
```

### Test file template (auth routers)

```typescript
// Same mocks as above, plus:
// - context.auth = real test auth instance
// - context.headers = real session headers from testHelpers
// - No need to mock auth.api methods — they work against PGlite
```

### What to mock vs what's real

| Layer | Mock? | Why |
|-------|-------|-----|
| `@core/database/client` (db) | Redirect to PGlite | Repositories import db singleton |
| `@core/arcjet/protect` | Mock | Imports env vars at module level |
| `@core/posthog/server` | Mock | External service + env vars |
| `@core/files/client` | Mock | MinIO connection |
| `@core/stripe` | Mock | External service |
| Repositories | **REAL** | Execute against PGlite |
| Better Auth (auth.api.*) | **REAL** | Uses PGlite via drizzleAdapter |
| Router handlers | **REAL** | Called via `call()` |
