# modules/billing Router + Workflow Test Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete test suite for `modules/billing` that covers every oRPC router procedure (billing / coupons / services) and every DBOS workflow (benefit-lifecycle / trial-expiry / period-end-invoice), using PGlite for real database behaviour. The suite must catch bugs in the implementation so we can fix them.

**Architecture:** One test package colocated at `modules/billing/__tests__/` (mirrors `core/database/__tests__/` and `packages/events/__tests__/` conventions). Router tests call handlers via `call()` from `@orpc/server` against a PGlite-backed `DatabaseInstance`, seeding ownership rows with `drizzle-seed`. Workflow tests mock `@dbos-inc/dbos-sdk` + `@dbos-inc/drizzle-datasource` so registered workflows execute in-process against PGlite, while publisher / resend / email clients become `vi.fn()` spies.

**Tech Stack:** vitest, `@electric-sql/pglite`, `drizzle-kit/api` (`pushSchema`), `drizzle-seed`, `@orpc/server` (`call`), `@dbos-inc/dbos-sdk` (mocked), `neverthrow` (for inspecting errors), `dayjs`, `@f-o-t/money`.

---

## Preconditions

- Workspace: `montte-nx` monorepo, bun package manager, Nx orchestration.
- Source under test already implemented in `modules/billing/src/**` (branch `modules/billing`). Do not edit router/workflow source during Phase 1/2 — only during Phase 4 when tests reveal real bugs.
- Pattern reference: `core/database/__tests__/helpers/setup-test-db.ts` + `core/database/__tests__/repositories/*.test.ts`.
- Never create a `vitest.config.ts` at the root — each package owns its own, per existing convention.

## Scope

**In scope:**
- `modules/billing/src/router/billing.ts` — 3 procedures.
- `modules/billing/src/router/coupons.ts` — 6 procedures.
- `modules/billing/src/router/services.ts` — ~35 procedures.
- `modules/billing/src/workflows/benefit-lifecycle-workflow.ts`.
- `modules/billing/src/workflows/trial-expiry-workflow.ts`.
- `modules/billing/src/workflows/period-end-invoice-workflow.ts`.

**Out of scope:**
- Duplicate workflows under `packages/workflows/src/workflows/billing/*` (superseded by `modules/billing`; flag to owner separately).
- React components, hooks, `apps/web`.
- Real Better Auth flow — tests stub the session object directly since handlers only read `context.teamId` and `context.session.user.email`.

---

## Phase 0 — Bootstrap package test harness

### Task 0.1: Add vitest tooling to `modules/billing/package.json`

**Files:**
- Modify: `modules/billing/package.json`

**Step 1: Open the file and confirm the current state**

Run: `cat modules/billing/package.json`
Expected: `devDependencies` currently only contains `@tooling/typescript` and `typescript`. No `test` script in `scripts`.

**Step 2: Add the test script and required devDependencies**

Edit `scripts` to add:
```json
"test": "vitest run --passWithNoTests"
```
(Already present per inspection — keep it.)

Edit `devDependencies` to append (match the versions used by `core/database/package.json`):
```json
"@electric-sql/pglite": "^0.3.15",
"drizzle-kit": "catalog:database",
"drizzle-seed": "catalog:database",
"vitest": "catalog:testing"
```

**Step 3: Install**

Run: `bun install`
Expected: resolves cleanly, no version conflicts. `modules/billing/node_modules/.bin/vitest` exists afterwards (may be hoisted — `bun pm ls --filter @modules/billing` to confirm).

**Step 4: Commit**

```bash
git add modules/billing/package.json bun.lock
git commit -m "chore(billing): add vitest + pglite devDependencies for test harness"
```

---

### Task 0.2: Create `modules/billing/vitest.config.ts`

**Files:**
- Create: `modules/billing/vitest.config.ts`

**Step 1: Write the config**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
   resolve: {
      tsconfigPaths: true,
   },
   test: {
      include: ["./__tests__/**/*.test.ts"],
      hookTimeout: 30_000,
      env: {
         DATABASE_URL: "postgresql://test:test@localhost:5432/test",
         REDIS_URL: "redis://localhost:6379",
         NODE_ENV: "test",
         LOG_LEVEL: "silent",
      },
   },
});
```

Mirrors `packages/events/vitest.config.ts` + adds the `env` block `@core/environment/worker` needs so importing workflow/context code does not crash on Zod env parsing.

**Step 2: Verify vitest can load the config**

Run: `cd modules/billing && bunx vitest --config vitest.config.ts run --passWithNoTests`
Expected: `No test files found` — config loads, returns cleanly.

**Step 3: Commit**

```bash
git add modules/billing/vitest.config.ts
git commit -m "chore(billing): add vitest config"
```

---

### Task 0.3: Update `modules/billing/tsconfig.json` to include tests and extend path aliases

**Files:**
- Modify: `modules/billing/tsconfig.json`

**Step 1: Open current tsconfig**

Run: `cat modules/billing/tsconfig.json`
Expected: `include: ["src"]`, no `@f-o-t/*` alias, no `@packages/events` alias.

**Step 2: Extend `include` and add the aliases tests need**

Change `include` to `["src", "__tests__"]`. Add to `compilerOptions.paths`:
```json
"@f-o-t/money": ["../../libraries/money/src/index.ts"],
"@packages/events/*": ["../../packages/events/src/*"]
```
(Verify actual path to `@f-o-t/money` with `find libraries -name money -type d` first; skip if the module already resolves via bundler mode.)

**Step 3: Run typecheck to confirm no regression**

Run: `cd modules/billing && bun run typecheck`
Expected: exits 0.

**Step 4: Commit**

```bash
git add modules/billing/tsconfig.json
git commit -m "chore(billing): include __tests__ in tsconfig"
```

---

## Phase 1 — Shared test helpers (in `core/*`) + billing-local domain factories

**Design decision:** Test helpers that can serve any module live in the relevant core package under `src/testing/` and are exported via a `./testing/*` package.json subpath. Rationale:
- `tooling/typescript/core.json` excludes `**/__tests__/**` from compilation, so helpers in `__tests__/` cannot be exported via package.json.
- Placing helpers in `src/testing/` makes them compile into `dist/testing/*` alongside `dist/repositories/*`, `dist/schemas/*` — consistent with existing per-package subpath exports.
- First module to need them (billing) adds them; every subsequent module reuses via `@core/<pkg>/testing/<helper>`.

**Helper homes:**
| Helper | Home package | Import path |
|---|---|---|
| `setup-test-db` | `core/database` | `@core/database/testing/setup-test-db` |
| `factories` (generic: `seedTeam`, `seedUser`) | `core/database` | `@core/database/testing/factories` |
| `create-test-context` | `core/orpc` | `@core/orpc/testing/create-test-context` |
| `mock-dbos` | `core/dbos` | `@core/dbos/testing/mock-dbos` |
| billing-specific factories | `modules/billing` | relative `../helpers/billing-factories` |

**Dev dependencies required** (all use workspace catalog where possible):
- `core/database` already has `@electric-sql/pglite`, `drizzle-kit`, `drizzle-seed` — no change.
- `core/orpc` needs `vitest` (peerDependencies + devDependencies).
- `core/dbos` needs `vitest` (peerDependencies + devDependencies).

---

### Task 1.1: Add shared `setup-test-db` under `core/database/src/testing/`

**Files:**
- Move: `core/database/__tests__/helpers/setup-test-db.ts` → `core/database/src/testing/setup-test-db.ts` (update imports to relative).
- Modify: `core/database/package.json` — add `./testing/*` subpath to `exports`.
- Update: any existing test importers inside `core/database/__tests__/**` to use the relative `../../src/testing/setup-test-db` path (or via the new `@core/database/testing/*` alias if tsconfig resolves it inside the package).

**Step 1: Move and update `setup-test-db.ts`**

Source content stays identical except for imports. File now at `core/database/src/testing/setup-test-db.ts`:
```ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { pushSchema } from "drizzle-kit/api";
import * as schema from "../schema";
import type { DatabaseInstance } from "../client";

export async function setupTestDb() {
   const client = new PGlite();
   const db = drizzle({
      client,
      schema,
   }) as unknown as DatabaseInstance;

   const { apply } = await pushSchema(schema, db as any, [
      "finance",
      "crm",
      "inventory",
      "platform",
   ]);
   await apply();

   return {
      db,
      client,
      cleanup: async () => {
         await client.close();
      },
   };
}
```

Delete the old file `core/database/__tests__/helpers/setup-test-db.ts`. Update the 17 repository test files (`core/database/__tests__/repositories/*.test.ts`) to import from `../../src/testing/setup-test-db` instead of `../helpers/setup-test-db`.

**Step 2: Add `./testing/*` export subpath**

Edit `core/database/package.json`, `exports` block — append after the last entry:
```json
"./testing/*": {
   "types": "./dist/testing/*.d.ts",
   "default": "./dist/testing/*.js"
}
```

**Step 3: Re-run the existing repository tests to confirm no regression**

Run: `cd core/database && bunx vitest run`
Expected: suite still passes with updated import paths.

**Step 4: Commit**

```bash
git add core/database
git commit -m "refactor(database): move setup-test-db to src/testing for shared consumption"
```

---

### Task 1.2: Add shared generic factories under `core/database/src/testing/factories.ts`

**Files:**
- Create: `core/database/src/testing/factories.ts` — generic seeders for cross-cutting domain entities (team, user, organization).

**Step 1: Write factories**

```ts
import { seed } from "drizzle-seed";
import type { DatabaseInstance } from "../client";
import * as schema from "../schema";

function rand() {
   return Math.floor(Math.random() * 1_000_000);
}

export async function seedTeam(db: DatabaseInstance) {
   const organizationId = crypto.randomUUID();
   const teamId = crypto.randomUUID();
   await seed(
      db,
      { organization: schema.organization },
      { seed: rand() },
   ).refine((f) => ({
      organization: {
         count: 1,
         columns: { id: f.default({ defaultValue: organizationId }) },
      },
   }));
   await seed(db, { team: schema.team }, { seed: rand() }).refine((f) => ({
      team: {
         count: 1,
         columns: {
            id: f.default({ defaultValue: teamId }),
            organizationId: f.default({ defaultValue: organizationId }),
         },
      },
   }));
   return { organizationId, teamId };
}

export async function seedUser(db: DatabaseInstance) {
   const userId = crypto.randomUUID();
   await seed(db, { user: schema.user }, { seed: rand() }).refine((f) => ({
      user: {
         count: 1,
         columns: {
            id: f.default({ defaultValue: userId }),
            email: f.default({ defaultValue: `test-${userId}@example.com` }),
         },
      },
   }));
   return userId;
}
```

Domain-specific factories (contact, service, price, etc.) do NOT live here — they stay module-local to avoid core bloat.

**Step 2: Smoke-test**

Create: `core/database/__tests__/testing/factories.test.ts` — one assertion per factory verifying the inserted row exists and returned IDs match.

**Step 3: Commit**

```bash
git add core/database/src/testing/factories.ts core/database/__tests__/testing/factories.test.ts
git commit -m "feat(database): add shared testing factories (seedTeam, seedUser)"
```

---

### Task 1.3: Add shared `mock-dbos` under `core/dbos/src/testing/`

**Files:**
- Create: `core/dbos/src/testing/mock-dbos.ts`.
- Modify: `core/dbos/package.json` — add `vitest` to `devDependencies` + `peerDependencies`, add `./testing/*` subpath to `exports`.

**Step 1: Write the helper**

The exported helper must (a) register `vi.mock()` calls for `@dbos-inc/dbos-sdk`, `@dbos-inc/drizzle-datasource`, and (b) expose spies + a `setActiveDb` setter so consumers inject the PGlite instance per suite.

```ts
import { vi } from "vitest";
import type { DatabaseInstance } from "@core/database/client";

type DbosMocks = {
   runStepSpy: ReturnType<typeof vi.fn>;
   sleepSpy: ReturnType<typeof vi.fn>;
   infoSpy: ReturnType<typeof vi.fn>;
   setActiveDb: (db: DatabaseInstance) => void;
   getActiveDb: () => DatabaseInstance;
};

export function createDbosMocks(): DbosMocks {
   let activeDb: DatabaseInstance | null = null;
   return {
      runStepSpy: vi.fn(async (fn: () => unknown) => fn()),
      sleepSpy: vi.fn(async (_ms: number) => undefined),
      infoSpy: vi.fn(),
      setActiveDb: (db) => {
         activeDb = db;
      },
      getActiveDb: () => {
         if (!activeDb) throw new Error("Test DB not initialised in mock-dbos");
         return activeDb;
      },
   };
}

// oxlint-ignore no-explicit-any
export function dbosSdkMockFactory(mocks: DbosMocks) {
   return {
      DBOS: {
         logger: { info: mocks.infoSpy, warn: mocks.warnSpy, error: mocks.errorSpy },
         runStep: mocks.runStepSpy,
         sleepms: mocks.sleepSpy,
         registerWorkflow: <F extends (...args: any[]) => any>(fn: F) => fn,
      },
      WorkflowQueue: class WorkflowQueue {
         constructor(public name: string, public options?: unknown) {}
      },
   };
}

export function drizzleDataSourceMockFactory(mocks: DbosMocks) {
   class DrizzleDataSource {
      constructor(
         public name: string,
         public config: unknown,
         public schema: unknown,
      ) {}
      runTransaction<T>(fn: () => Promise<T>): Promise<T> {
         return fn();
      }
      static get client() {
         return mocks.getActiveDb();
      }
   }
   return { DrizzleDataSource };
}
```

**Note:** `vi.mock(path, factory)` only hoists above imports when it appears LITERALLY at module scope in the test file. Wrapping it in a helper hides it from vitest's AST transform. Consumers therefore keep the `vi.mock` calls at their own call-site and pass the exported factories:
```ts
import { vi } from "vitest";
import {
   createDbosMocks,
   dbosSdkMockFactory,
   drizzleDataSourceMockFactory,
} from "@core/dbos/testing/mock-dbos";

const mocks = vi.hoisted(() => createDbosMocks());
vi.mock("@dbos-inc/dbos-sdk", () => dbosSdkMockFactory(mocks));
vi.mock("@dbos-inc/drizzle-datasource", () => drizzleDataSourceMockFactory(mocks));

// then import the workflow under test
```

**Step 2: Update `core/dbos/package.json`**

- `devDependencies`: add `"vitest": "catalog:testing"`.
- `peerDependencies` (create block if missing): add `"vitest": "catalog:testing"` (marked peer because consuming packages provide their own vitest at the same version).
- `peerDependenciesMeta`: `{ "vitest": { "optional": true } }` so `core/dbos` doesn't warn when used in non-test contexts.
- `exports`: add `"./testing/*": { "types": "./dist/testing/*.d.ts", "default": "./dist/testing/*.js" }`.

**Step 3: Commit**

```bash
git add core/dbos
git commit -m "feat(dbos): add shared mock-dbos testing helper"
```

---

### Task 1.4: Add shared `create-test-context` under `core/orpc/src/testing/`

**Files:**
- Create: `core/orpc/src/testing/create-test-context.ts`.
- Modify: `core/orpc/package.json` — add `vitest` to `devDependencies` + `peerDependencies` (+Meta optional), add `./testing/*` subpath to `exports`.

**Step 1: Write the helper**

Matches the Task 1.3 contents from the pre-refactor plan, but lives here now and is generic (not billing-specific). The hyprpay client / workflow client are passed in by the consumer via overrides; the helper doesn't hard-code hyprpay because not every module uses it.

```ts
import { vi } from "vitest";
import type { DatabaseInstance } from "@core/database/client";

export function createPosthogMock() {
   return {
      capture: vi.fn(),
      identify: vi.fn(),
      groupIdentify: vi.fn(),
      shutdown: vi.fn(),
   };
}

export function createWorkflowClientMock() {
   return { enqueue: vi.fn().mockResolvedValue(undefined) };
}

export function createJobPublisherMock() {
   return { publish: vi.fn().mockResolvedValue(undefined) };
}

export type TestContextOverrides = {
   teamId?: string;
   organizationId?: string;
   userId?: string;
   userEmail?: string;
   // Additional per-module spies can be merged in via spread on the caller side
   extras?: Record<string, unknown>;
};

export function createTestContext(
   db: DatabaseInstance,
   overrides: TestContextOverrides = {},
) {
   const teamId = overrides.teamId ?? crypto.randomUUID();
   const organizationId = overrides.organizationId ?? crypto.randomUUID();
   const userId = overrides.userId ?? crypto.randomUUID();
   const userEmail = overrides.userEmail ?? `test-${userId}@example.com`;

   return {
      db,
      teamId,
      organizationId,
      userId,
      session: {
         user: { id: userId, email: userEmail, name: "Test" },
         session: {
            id: crypto.randomUUID(),
            activeOrganizationId: organizationId,
            activeTeamId: teamId,
         },
      },
      headers: new Headers(),
      request: new Request("http://localhost", { headers: new Headers() }),
      auth: {} as never,
      posthog: createPosthogMock(),
      redis: {} as never,
      workflowClient: createWorkflowClientMock(),
      jobPublisher: createJobPublisherMock(),
      ...overrides.extras,
   };
}
```

Billing test files use it with a hyprpay-mock merged in:
```ts
const hyprpayClient = { usage: { list: vi.fn() }, /* ... */ };
const ctx = createTestContext(db, { extras: { hyprpayClient } });
```

**Step 2: Update `core/orpc/package.json`**

Same vitest dev/peer wiring as Task 1.3, plus the `./testing/*` export subpath.

**Step 3: Commit**

```bash
git add core/orpc
git commit -m "feat(orpc): add shared createTestContext testing helper"
```

---

### Task 1.5: Billing-local domain factories

**Files:**
- Create: `modules/billing/__tests__/helpers/billing-factories.ts`

Generic `seedTeam` / `seedUser` live in `@core/database/testing/factories` (Task 1.2). This file holds domain-specific billing factories only.

**Step 1: Write factories**

```ts
import type { DatabaseInstance } from "@core/database/client";
import { contacts } from "@core/database/schemas/contacts";
import { services, servicePrices } from "@core/database/schemas/services";
import { meters } from "@core/database/schemas/meters";
import { benefits, serviceBenefits } from "@core/database/schemas/benefits";
import { coupons } from "@core/database/schemas/coupons";
import {
   contactSubscriptions,
   type SubscriptionStatus,
} from "@core/database/schemas/subscriptions";
import { subscriptionItems } from "@core/database/schemas/subscription-items";
import { usageEvents } from "@core/database/schemas/usage-events";
import dayjs from "dayjs";

export async function makeContact(
   db: DatabaseInstance,
   opts: { teamId: string; name?: string },
) {
   const [row] = await db
      .insert(contacts)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? `Contato ${crypto.randomUUID()}`,
         type: "cliente",
      })
      .returning();
   return row!;
}

export async function makeService(
   db: DatabaseInstance,
   opts: { teamId: string; name?: string },
) {
   const [row] = await db
      .insert(services)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? `Serviço ${crypto.randomUUID()}`,
      })
      .returning();
   return row!;
}

export async function makeMeter(
   db: DatabaseInstance,
   opts: { teamId: string; eventName?: string; name?: string },
) {
   const [row] = await db
      .insert(meters)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? "Medidor",
         eventName: opts.eventName ?? `event.${crypto.randomUUID()}`,
         aggregation: "sum",
      })
      .returning();
   return row!;
}

export async function makePrice(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      serviceId: string;
      type?: "flat" | "metered";
      basePrice?: string;
      interval?: "monthly" | "annual" | "one_time";
      meterId?: string | null;
      priceCap?: string | null;
      name?: string;
   },
) {
   const [row] = await db
      .insert(servicePrices)
      .values({
         teamId: opts.teamId,
         serviceId: opts.serviceId,
         name: opts.name ?? "Preço padrão",
         type: opts.type ?? "flat",
         basePrice: opts.basePrice ?? "100.00",
         interval: opts.interval ?? "monthly",
         meterId: opts.meterId ?? null,
         priceCap: opts.priceCap ?? null,
      })
      .returning();
   return row!;
}

export async function makeBenefit(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      type?: "feature" | "credits";
      meterId?: string | null;
      creditAmount?: number | null;
      name?: string;
   },
) {
   const [row] = await db
      .insert(benefits)
      .values({
         teamId: opts.teamId,
         name: opts.name ?? "Benefício",
         type: opts.type ?? "feature",
         meterId: opts.meterId ?? null,
         creditAmount: opts.creditAmount ?? null,
      })
      .returning();
   return row!;
}

export async function attachBenefit(
   db: DatabaseInstance,
   opts: { serviceId: string; benefitId: string },
) {
   await db.insert(serviceBenefits).values(opts);
}

export async function makeSubscription(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      contactId: string;
      status?: SubscriptionStatus;
      couponId?: string | null;
      trialEndsAt?: Date | null;
      startDate?: string;
      endDate?: string | null;
      source?: "manual" | "asaas";
   },
) {
   const [row] = await db
      .insert(contactSubscriptions)
      .values({
         teamId: opts.teamId,
         contactId: opts.contactId,
         status: opts.status ?? "active",
         couponId: opts.couponId ?? null,
         trialEndsAt: opts.trialEndsAt ?? null,
         startDate: opts.startDate ?? dayjs().format("YYYY-MM-DD"),
         endDate: opts.endDate ?? null,
         source: opts.source ?? "manual",
         cancelAtPeriodEnd: false,
      })
      .returning();
   return row!;
}

export async function makeSubscriptionItem(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      subscriptionId: string;
      priceId: string;
      quantity?: number;
      negotiatedPrice?: string | null;
   },
) {
   const [row] = await db
      .insert(subscriptionItems)
      .values({
         teamId: opts.teamId,
         subscriptionId: opts.subscriptionId,
         priceId: opts.priceId,
         quantity: opts.quantity ?? 1,
         negotiatedPrice: opts.negotiatedPrice ?? null,
      })
      .returning();
   return row!;
}

export async function makeCoupon(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      code?: string;
      type?: "percent" | "amount";
      amount?: string;
      duration?: "once" | "forever" | "repeating";
      durationMonths?: number | null;
      isActive?: boolean;
   },
) {
   const [row] = await db
      .insert(coupons)
      .values({
         teamId: opts.teamId,
         code: opts.code ?? `CODE-${crypto.randomUUID().slice(0, 6)}`,
         scope: "team",
         type: opts.type ?? "percent",
         amount: opts.amount ?? "10",
         duration: opts.duration ?? "once",
         durationMonths: opts.durationMonths ?? null,
         isActive: opts.isActive ?? true,
      })
      .returning();
   return row!;
}

export async function makeUsageEvent(
   db: DatabaseInstance,
   opts: {
      teamId: string;
      meterId: string;
      quantity: string;
      timestamp?: Date;
      idempotencyKey?: string;
   },
) {
   const [row] = await db
      .insert(usageEvents)
      .values({
         teamId: opts.teamId,
         meterId: opts.meterId,
         quantity: opts.quantity,
         timestamp: opts.timestamp ?? new Date(),
         idempotencyKey: opts.idempotencyKey ?? crypto.randomUUID(),
      })
      .returning();
   return row!;
}
```

Factory coverage matches schemas touched by every router/workflow path. `new Date()` usage inside factories is allowed per CLAUDE.md test-fixture exception.

**Step 2: Commit**

```bash
git add modules/billing/__tests__/helpers/billing-factories.ts
git commit -m "test(billing): add billing domain factories"
```

---

### Task 1.6: Billing-local mock wiring (publisher + resend)

**Files:**
- Create: `modules/billing/__tests__/helpers/mock-billing-context.ts`

**Step 1: Define the billing-specific mock bindings**

Only the shims that are specific to billing live here; everything general comes from `@core/dbos/testing/mock-dbos`:

```ts
import { vi } from "vitest";

export const billingPublisherSpy = vi.fn().mockResolvedValue(undefined);
export const billingResendSpies = {
   sendBillingInvoiceGenerated: vi.fn().mockResolvedValue(undefined),
   sendBillingTrialExpired: vi.fn().mockResolvedValue(undefined),
   sendBillingTrialExpiryWarning: vi.fn().mockResolvedValue(undefined),
};

vi.mock("../../src/workflows/context", async () => {
   const actual =
      await vi.importActual<typeof import("../../src/workflows/context")>(
         "../../src/workflows/context",
      );
   return {
      ...actual,
      getBillingPublisher: () => ({ publish: billingPublisherSpy }),
      getBillingResendClient: () => ({}) as never,
   };
});

vi.mock("@core/transactional/client", () => ({
   sendBillingInvoiceGenerated: billingResendSpies.sendBillingInvoiceGenerated,
   sendBillingTrialExpired: billingResendSpies.sendBillingTrialExpired,
   sendBillingTrialExpiryWarning: billingResendSpies.sendBillingTrialExpiryWarning,
}));
```

Workflow test files wire all `vi.mock` calls at literal module scope BEFORE importing the workflow-under-test so vitest hoists them above imports:
```ts
import { vi } from "vitest";
import {
   createDbosMocks,
   dbosSdkMockFactory,
   drizzleDataSourceMockFactory,
} from "@core/dbos/testing/mock-dbos";

const mocks = vi.hoisted(() => createDbosMocks());
vi.mock("@dbos-inc/dbos-sdk", () => dbosSdkMockFactory(mocks));
vi.mock("@dbos-inc/drizzle-datasource", () =>
   drizzleDataSourceMockFactory(mocks),
);
import "../helpers/mock-billing-context";

// now safe to import workflows
import { benefitLifecycleWorkflow } from "../../src/workflows/benefit-lifecycle-workflow";
```

**Step 2: Commit**

```bash
git add modules/billing/__tests__/helpers/mock-billing-context.ts
git commit -m "test(billing): add billing-specific publisher + resend mocks"
```

---

## Phase 2 — Router tests

Each router test file:
- Imports shared helpers via subpath aliases (`@core/database/testing/*`, `@core/orpc/testing/*`).
- Billing-specific mocks (hyprpay client factory, publisher/resend shims) stay in `modules/billing/__tests__/helpers/`.
- Uses one shared `setupTestDb()` in `beforeAll`; cleanup in `afterAll`.
- Seeds `team` + `user` + ownership rows via `@core/database/testing/factories` (generic) + `billing-factories` (domain-specific) per `it`.
- Invokes procedures via `call(procedure, input, { context })` from `@orpc/server`.
- Asserts thrown errors with `.rejects.toSatisfy((e: WebAppError) => e.code === "NOT_FOUND")` — `WebAppError` is a subclass of `ORPCError` so `.code` is available.

Billing router tests also need a hyprpay client mock. Create `modules/billing/__tests__/helpers/hyprpay-mock.ts` in Task 1.5 alongside the domain factories:
```ts
import { vi } from "vitest";
export function createHyprpayMock() {
   return {
      usage: { list: vi.fn() },
      customerPortal: { createSession: vi.fn() },
      coupons: { validate: vi.fn() },
   };
}
```
Usage in a router test:
```ts
const hyprpayClient = createHyprpayMock();
const ctx = createTestContext(testDb.db, { extras: { hyprpayClient } });
```

### Task 2.1: `__tests__/router/billing.test.ts`

**Files:**
- Create: `modules/billing/__tests__/router/billing.test.ts`

**Cases (each its own `it`):**

1. `getEventCatalog` — pre-seed two `eventCatalog` rows via `db.insert(schema.eventCatalog)`; assert result ordered by `category` then `displayName`.
2. `getEventCatalog` surfaces internal error — stub `context.db.query.eventCatalog.findMany` via `vi.spyOn` to reject; assert `WebAppError.code === "INTERNAL_SERVER_ERROR"`.
3. `getUsageSummary` — hyprpay mock returns `ok([{...}])`, assert return value; hyprpay mock returns `err(...)`, assert thrown `INTERNAL_SERVER_ERROR`.
4. `getCustomerPortalSession` — same two paths.

**Step 1: Write the tests (failing)**

Template:
```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call } from "@orpc/server";
import { ok, err } from "neverthrow";
import { setupTestDb } from "@core/database/testing/setup-test-db";
import { createTestContext } from "@core/orpc/testing/create-test-context";
import { createHyprpayMock } from "../helpers/hyprpay-mock";
import * as billing from "../../src/router/billing";
import { eventCatalog } from "@core/database/schemas/event-catalog";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;
beforeAll(async () => { testDb = await setupTestDb(); });
afterAll(async () => { await testDb.cleanup(); });

describe("billing router", () => {
   it("getEventCatalog returns rows ordered by category, displayName", async () => {
      await testDb.db.insert(eventCatalog).values([
         { eventName: "a", displayName: "B", category: "usage", pricePerEvent: "0", isBillable: false },
         { eventName: "b", displayName: "A", category: "usage", pricePerEvent: "0", isBillable: false },
      ]);
      const ctx = createTestContext(testDb.db);
      const result = await call(billing.getEventCatalog, undefined, { context: ctx });
      expect(result.map((r) => r.displayName)).toEqual(["A", "B"]);
   });

   it("getUsageSummary returns hyprpay data", async () => {
      const hyprpayClient = createHyprpayMock();
      const ctx = createTestContext(testDb.db, { extras: { hyprpayClient } });
      hyprpayClient.usage.list.mockResolvedValueOnce(ok([{ id: "u1" }]));
      const result = await call(
         billing.getUsageSummary,
         { customerId: "cus_1" },
         { context: ctx },
      );
      expect(result).toEqual([{ id: "u1" }]);
   });

   it("getUsageSummary throws INTERNAL when hyprpay fails", async () => {
      const hyprpayClient = createHyprpayMock();
      const ctx = createTestContext(testDb.db, { extras: { hyprpayClient } });
      hyprpayClient.usage.list.mockResolvedValueOnce(err(new Error("boom")));
      await expect(
         call(billing.getUsageSummary, { customerId: "cus_1" }, { context: ctx }),
      ).rejects.toSatisfy((e: Error & { code?: string }) => e.code === "INTERNAL_SERVER_ERROR");
   });

   // ... similar for getCustomerPortalSession
});
```

**Step 2: Run**

Run: `cd modules/billing && bunx vitest run __tests__/router/billing.test.ts`
Expected: fails if any implementation bug exists; otherwise passes.

**Step 3: Commit**

```bash
git add modules/billing/__tests__/router/billing.test.ts
git commit -m "test(billing): cover billing router procedures"
```

---

### Task 2.2: `__tests__/router/coupons.test.ts`

**Files:**
- Create: `modules/billing/__tests__/router/coupons.test.ts`

**Cases:**

1. `list` — creates 2 coupons for `teamId`, 1 for another team → returns exactly 2, ordered by `createdAt asc`.
2. `get` — happy path; `notFound` when coupon belongs to another team (ownership middleware).
3. `create` — happy path with `scope="team"`, `type="percent"`, `duration="once"`.
4. `create` → `CONFLICT` when duplicate `code` (case-insensitive: create `PROMO`, attempt `promo`).
5. `create` zod fail → `INPUT_VALIDATION_FAILED` when `scope="price"` and `priceId` is null (uses `.superRefine`).
6. `create` zod fail → same when `duration="repeating"` without `durationMonths`.
7. `update` — flips `isActive` to false; `notFound` for foreign team.
8. `deactivate` — sets `isActive=false`; `notFound` for foreign team.
9. `validate` — hyprpay ok path returns value; err path → `INTERNAL_SERVER_ERROR`.

**Step 1: Write tests**

Use `makeCoupon` factory + `seedTeam` for foreign-team cases.

**Step 2: Run / commit**

Run: `bunx vitest run __tests__/router/coupons.test.ts`
Commit: `test(billing): cover coupons router procedures`.

---

### Task 2.3: `__tests__/router/services.test.ts` — Services section

**Files:**
- Create: `modules/billing/__tests__/router/services.test.ts`

**Cases (first `describe` block "services"):**

1. `getAll` — 3 services across 2 categories, filter by `search` (matches `name` OR `description`), filter by `categoryId`, team isolation.
2. `create` — inserts, returns row with `teamId`.
3. `create` → `INPUT_VALIDATION_FAILED` when name empty.
4. `bulkCreate` — 3 items, assert ordering and that all 3 rows have `teamId`.
5. `bulkCreate` → `INPUT_VALIDATION_FAILED` when `items.length === 0`.
6. `update` — happy path; foreign team → `NOT_FOUND`.
7. `remove` — deletes; foreign team → `NOT_FOUND`.
8. `exportAll` — returns ordered by name, joins category + tag.

**Step 1: Write tests**. **Step 2: Run.** **Step 3: Commit.**

---

### Task 2.4: Prices section (same file)

Append `describe("prices", …)`:

1. `getVariants` — lists variants for a service.
2. `createVariant` flat — happy path.
3. `createVariant` metered without `meterId` → `BAD_REQUEST` (`"meterId é obrigatório…"`).
4. `createVariant` metered with `basePrice="5.00"` → `BAD_REQUEST` (`"basePrice igual a '0'…"`).
5. `updateVariant` — partial update; metered rules trigger same badRequests.
6. `updateVariant` foreign team → `NOT_FOUND`.
7. `removeVariant` — deletes; foreign team → `NOT_FOUND`.

Commit: `test(billing): cover service prices procedures`.

---

### Task 2.5: Subscriptions section

Append `describe("subscriptions", …)`:

1. `getAllSubscriptions` — scoped to team; `status` filter narrows result.
2. `getContactSubscriptions` — lists by contact ordered `desc` by `createdAt`.
3. `createSubscription` — simple (no items, `status=active` via DB default). Assert workflow enqueue **not** called.
4. `createSubscription` with `status=trialing, trialEndsAt` — assert `workflowClient.enqueue` called once with payload matching `trial-expiry-*` fields.
5. `createSubscription` with `items.length > 0` and default active status — assert `enqueue` called with benefit-lifecycle payload and `serviceId` derived from first item's price.
6. `createSubscription` items insert failure — monkey-patch `db.insert(subscriptionItems)` to reject; assert tx rolls back (no subscription row persisted).
7. `cancelSubscription` — trialing → cancelled; enqueue benefit-lifecycle called with `previousStatus="trialing"`.
8. `cancelSubscription` for `status=completed` → `BAD_REQUEST`.
9. `cancelSubscription` for `source="asaas"` → `BAD_REQUEST`.
10. `cancelSubscription` foreign team → `NOT_FOUND`.
11. `getExpiringSoon` — fixture: 3 subs with endDate today, +10d, +40d → returns today + +10d.

To assert the workflow-client payload, inspect `ctx.workflowClient.enqueue.mock.calls` for the workflowName/queue/inputs. Do not spy on `enqueueTrialExpiryWorkflow` directly — the router calls that helper which in turn calls `client.enqueue`, and the helper is the behaviour we want to verify.

Commit: `test(billing): cover subscription lifecycle procedures`.

---

### Task 2.6: Meters + Benefits + Usage sections

Append three more `describe` blocks:

**Meters**
1. `createMeter` persists row.
2. `getMeters` / `getMeterById` — team scope; cross-team → `NOT_FOUND`.
3. `updateMeterById` — happy, cross-team.
4. `removeMeter` — delete, cross-team.

**Benefits**
1. `createBenefit` — happy path.
2. `getBenefits` — aggregated count: seed 2 services → 1 benefit attached to both → `usedInServices === 2`.
3. `getBenefitById` — happy, cross-team.
4. `updateBenefitById` / `removeBenefit` — happy, cross-team.
5. `attachBenefit` / `detachBenefit` — idempotent on re-attach.
6. `getServiceBenefits` — returns benefit rows only (not link rows).

**Usage**
1. `ingestUsage` — happy path writes to `usageEvents`.
2. `ingestUsage` with `input.teamId !== context.teamId` → `FORBIDDEN`.
3. `ingestUsage` idempotency — two calls with same `(teamId, idempotencyKey)` → only 1 row (assert `count()`).

Commit: `test(billing): cover meters, benefits, usage ingestion`.

---

### Task 2.7: Aggregates + subscription items

**Aggregates**
1. `getMrr` — fixture with 2 monthly subscriptions (`basePrice=100`, qty=2 → 200) + 1 annual (`basePrice=1200`, qty=1 → 100) → `mrr === "300"`.
2. `getMrr` → `"0"` when no active subscriptions.
3. `getActiveCountByPrice` — counts only `status="active"` items for the given price.

**Subscription items**
1. `addItem` — happy path.
2. `addItem` → `BAD_REQUEST` when 20 items already exist.
3. `addItem` cross-team subscription → `NOT_FOUND`.
4. `updateItem` — happy, cross-team.
5. `removeItem` — delete, cross-team.
6. `listItems` — ordered `createdAt asc`.

Commit: `test(billing): cover MRR aggregate + subscription items`.

---

## Phase 3 — Workflow tests

Every workflow test file:
- **First:** create + register DBOS mocks via `@core/dbos/testing/mock-dbos` so `vi.mock` calls land before workflow modules load. Then import `../helpers/mock-billing-context` for the billing-specific publisher/resend shims.
- **Then:** import the workflow-under-test.
- `beforeAll`: `testDb = await setupTestDb(); dbosMocks.setActiveDb(testDb.db);`.
- `beforeEach`: `vi.clearAllMocks()` then re-set `dbosMocks.setActiveDb(testDb.db)` because `clearAllMocks` resets the spies' internal state but not the bound DB getter.
- `afterAll`: `await testDb.cleanup()`.

### Task 3.1: `__tests__/workflows/benefit-lifecycle.test.ts`

**Cases:**

1. Service with no benefits → early return, no rows in `benefitGrants`, no publish.
2. `newStatus=active`, no `previousStatus` → inserts one `benefitGrant` per attached benefit with `status="active"`; publishes one `BILLING_BENEFIT_GRANTED` notification with `benefitIds` matching.
3. `newStatus=trialing`, no `previousStatus` → same grant behaviour.
4. `newStatus=cancelled` with pre-existing active grants → updates rows to `status="revoked"` with `revokedAt` non-null; publishes `BILLING_BENEFIT_REVOKED`; no new inserts.
5. `newStatus=completed` → same as cancelled.
6. **Upgrade path** — `previousStatus="trialing"`, `newStatus="active"` → both branches fire: existing grants revoked *and* re-inserted via `onConflictDoUpdate` (status ends as `active` with `revokedAt: null`).
7. Idempotency — run grant path twice, assert row count matches benefits count (not duplicated).
8. DB failure path — force `runTransaction` helper to throw by stubbing the insert step; assert `WorkflowError.database` propagates.

**Step 1: Write tests**
```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
   createDbosMocks,
   dbosSdkMockFactory,
   drizzleDataSourceMockFactory,
} from "@core/dbos/testing/mock-dbos";

const dbosMocks = vi.hoisted(() => createDbosMocks());
vi.mock("@dbos-inc/dbos-sdk", () => dbosSdkMockFactory(dbosMocks));
vi.mock("@dbos-inc/drizzle-datasource", () =>
   drizzleDataSourceMockFactory(dbosMocks),
);
import { billingPublisherSpy, billingResendSpies } from "../helpers/mock-billing-context";

import { setupTestDb } from "@core/database/testing/setup-test-db";
import { seedTeam } from "@core/database/testing/factories";
import {
   makeContact,
   makeService,
   makeBenefit,
   attachBenefit,
   makeSubscription,
} from "../helpers/billing-factories";
import { benefitGrants } from "@core/database/schemas/benefit-grants";
import { benefitLifecycleWorkflow } from "../../src/workflows/benefit-lifecycle-workflow";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
   testDb = await setupTestDb();
   dbosMocks.setActiveDb(testDb.db);
});
afterAll(async () => { await testDb.cleanup(); });
beforeEach(() => {
   vi.clearAllMocks();
   dbosMocks.setActiveDb(testDb.db);
});

describe("benefitLifecycleWorkflow", () => {
   it("no-ops when service has no benefits", async () => {
      const { teamId } = await seedTeam(testDb.db);
      const contact = await makeContact(testDb.db, { teamId });
      const service = await makeService(testDb.db, { teamId });
      const sub = await makeSubscription(testDb.db, { teamId, contactId: contact.id });

      await benefitLifecycleWorkflow({
         teamId,
         subscriptionId: sub.id,
         serviceId: service.id,
         newStatus: "active",
      });

      const grants = await testDb.db
         .select()
         .from(benefitGrants)
         .where(eq(benefitGrants.subscriptionId, sub.id));
      expect(grants).toHaveLength(0);
      expect(billingPublisherSpy).not.toHaveBeenCalled();
   });
   // ... remaining cases
});
```

**Step 2: Run / iterate.**

**Step 3: Commit**: `test(billing): cover benefit-lifecycle workflow`.

---

### Task 3.2: `__tests__/workflows/trial-expiry.test.ts`

**Cases:**

1. Pre-expiry warning path — `trialEndsAt = now + 5 days`. After workflow:
   - `dbosMocks.sleepSpy` called twice (first call ≈ `2 days`, second ≈ `3 days`).
   - `billingPublisherSpy` called for `BILLING_TRIAL_EXPIRING status=started`.
   - `billingResendSpies.sendBillingTrialExpiryWarning` called when `contactEmail` set.
2. Same case with no `contactEmail` → warning email **not** sent, but publish still happens.
3. Expiry path, subscription still `trialing` → status flipped to `active`; publishes `BILLING_TRIAL_EXPIRING status=completed`; `sendBillingTrialExpired` called.
4. Expiry path, subscription `cancelled` → no status update, no notifications about activation, no expired email. Workflow returns early.
5. Expiry path, subscription missing → early return, no error thrown.
6. `trialEndsAt` already in the past → sleepMs negative, `DBOS.sleepms` not awaited for that branch (assert `sleepSpy` not called with negative arg). Use `dayjs` to compute.

**Step 1 → 3: write, run, commit** — `test(billing): cover trial-expiry workflow`.

---

### Task 3.3: `__tests__/workflows/period-end-invoice.test.ts`

**Cases:**

1. Subscription missing → throws `WorkflowError.notFound`.
2. Subscription with zero items → persists invoice with `subtotal="0.00"`, `total="0.00"`, `lineItems=[]`, `couponSnapshot=null`.
3. Flat price, `qty=2`, `basePrice=150.00`, no coupon → `subtotal=total=300.00`, one line item.
4. Metered price, usage total 1000, credit benefit 400 → billed quantity 600; `priceCap` clamps subtotal when `unitPrice*600 > cap`.
5. `negotiatedPrice="80.00"` overrides `basePrice="100.00"`.
6. Inactive price (`isActive=false`) → skipped, not in lineItems.
7. Coupon `once`, `redemptionCount=0` → applied; `couponSnapshot` populated.
8. Coupon `once`, `redemptionCount=1` (pre-seeded `couponRedemptions` row) → skipped.
9. Coupon `repeating`, `durationMonths=3`, `redemptionCount=2` → applied; `redemptionCount=3` → skipped.
10. Coupon `forever` → always applied.
11. Coupon `type=percent amount=10` on `subtotal=500.00` → discount `50.00`, total `450.00`.
12. Coupon `type=amount amount=600.00` on `subtotal=500.00` → `total="0.00"` (clamped).
13. Notification publish happens after invoice row is created; payload includes `invoiceId, total, subscriptionId`.
14. `sendBillingInvoiceGenerated` called when `contactEmail` supplied; not called when absent.

Each test seeds the exact fixtures it needs via factories + direct `db.insert` for `couponRedemptions`, `usageEvents`, `benefitGrants` with active benefits.

Commit: `test(billing): cover period-end-invoice workflow`.

---

## Phase 4 — Bug-hunt and fix

### Task 4.1: Run the full suite, record failures

Run: `cd modules/billing && bunx vitest run`
Expected: some failures. Capture the list.

### Task 4.2: Categorise failures

For each failing case:
1. Verify the failure describes a real bug (implementation wrong) versus a test bug (fixture wrong). If test bug, fix the test.
2. For real bugs, create a one-line note in `docs/plans/2026-04-24-modules-billing-tests.md` under an "Open bugs" section.

Candidates from static review (confirm only when the test actually trips the bug — do not pre-fix):
- `modules/billing/src/router/services.ts:781` — `createSubscription` enqueues benefit-lifecycle only for `input.items[0]`; multi-item subs with different services miss later enqueues.
- `modules/billing/src/router/services.ts:864` — `cancelSubscription` reads `subscriptionItems.findFirst({ with: { price: true } })`; requires Drizzle relation `subscriptionItems.price` — verify defined and tested.
- `modules/billing/src/workflows/period-end-invoice-workflow.ts:373` — email formats `periodEnd` as `"MM/YYYY"` but `periodStart` as `"DD/MM/YYYY"`; likely intended `DD/MM/YYYY` for both.
- `modules/billing/src/router/services.ts:897` — `getExpiringSoon` compares `endDate` (a `date` column, YYYY-MM-DD strings) to `dayjs().format("YYYY-MM-DD")` — verify string-compare semantics match on PGlite.

### Task 4.3: Fix bugs in source

For each real bug:

**Step 1:** update the failing test to describe the correct behaviour (if the original expectation was wrong).
**Step 2:** Fix the source.
**Step 3:** Run only the affected test file.
**Step 4:** Run the whole suite.
**Step 5:** Commit: `fix(billing): <short description>`. One bug per commit.

### Task 4.4: Record any bugs that are out of scope

If a bug needs more context (e.g. a design question), leave it in the "Open bugs" section with a short note and a file reference — do not silently fix.

---

## Phase 5 — Wire into CI

### Task 5.1: Confirm `bun run test` picks up the new package

**Files:**
- Read-only: `nx.json`, root `package.json`.

**Step 1:** Run `cd /home/yorizel/Documents/montte-nx && bun run test -- --filter @modules/billing`
Expected: vitest executes against the new suite.

**Step 2:** Run `bun run test` (full suite)
Expected: every package's tests still green; new package tests included in the run output.

**Step 3:** If Nx project graph needs a refresh, run `bun nx reset` and rerun.

### Task 5.2: Commit any Nx / project-graph touch-ups

Only commit if files outside `modules/billing` needed to change.

Commit: `chore(nx): include modules/billing tests in workspace runs`.

---

## Final verification checklist

- [ ] `cd modules/billing && bunx vitest run` → all green.
- [ ] `cd /home/yorizel/Documents/montte-nx && bun run test` → all packages green.
- [ ] `bun run typecheck` → exits 0.
- [ ] `bun run check` → oxlint clean for `modules/billing`.
- [ ] Every router procedure in `billing.ts`, `coupons.ts`, `services.ts` has at least one success-path and (when applicable) one failure-path test.
- [ ] Every workflow has grant/revoke/early-return/error paths covered.
- [ ] Any real bugs discovered have their own `fix(billing): …` commit, or are documented under "Open bugs".

---

## Open questions resolved before execution

- **Duplicate workflows under `packages/workflows/src/workflows/billing/*`** — out of scope for this plan; flag to owner that the `modules/billing` versions supersede them once tests pass.
- **DBOS testing approach** — chose mock-based over the docs.dbos.dev "real DBOS runtime" pattern because (a) the codebase already requires `vi.mock('@dbos-inc/dbos-sdk')` convention per CLAUDE.md, (b) real DBOS needs a running Postgres app DB and would slow the suite 10×, (c) mocks let us assert `sleepSpy` / step boundaries exactly.
- **Test location** — `modules/billing/__tests__/` per the `core/database` + `packages/events` package-local convention. No tests go under `apps/web`.

---

## Open bugs (filled in during Phase 4)

_(Populated as Phase 4 runs. One line per bug, with file:line reference.)_
