# Events Package Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Absorb `@packages/queue` into `@packages/events`, delete dead code, remove comments, add vitest + oxlint tooling, and write comprehensive tests for all testable modules.

**Architecture:** The queue package (5 files, ~75 lines) provides BullMQ queue factories and job data types. Two of its files are dead code (`scheduled.ts`, `bill-recurrence.ts`). The live queue code (connection, webhook-delivery, budget-alerts) moves into `packages/events/src/queues/`. The existing `bun:test` test gets rewritten to vitest. New tests cover: `catalog.ts`, `credits.ts`, `utils.ts`, and `emit.ts`. Category files (ai.ts, webhook.ts, etc.) are pure schema + thin wrappers — not worth unit testing.

**Tech Stack:** Vitest, `vi.fn()` mocks, `vite-tsconfig-paths`, oxlint, oxfmt, BullMQ

---

### Current State Summary

**`@packages/queue` files — what to keep:**
| File | Status | Action |
|---|---|---|
| `connection.ts` | Used by events + worker | Move to `events/src/queues/connection.ts` |
| `webhook-delivery.ts` | Used by events + worker | Move to `events/src/queues/webhook-delivery.ts` |
| `budget-alerts.ts` | Used by web + worker | Move to `events/src/queues/budget-alerts.ts` |
| `scheduled.ts` | Dead code (0 consumers) | Delete |
| `bill-recurrence.ts` | Dead code (0 consumers) | Delete |

**`@packages/queue` consumers that need import updates:**
| File | Current Import | New Import |
|---|---|---|
| `packages/events/src/emit.ts` | `@packages/queue/connection`, `@packages/queue/webhook-delivery` | `./queues/connection`, `./queues/webhook-delivery` (internal) |
| `apps/worker/src/index.ts` | `@packages/queue/connection` | `@packages/events/queues/connection` |
| `apps/worker/src/jobs/deliver-webhook.ts` | `@packages/queue/webhook-delivery` | `@packages/events/queues/webhook-delivery` |
| `apps/worker/src/jobs/check-budget-alerts.ts` | `@packages/queue/budget-alerts` | `@packages/events/queues/budget-alerts` |
| `apps/worker/src/workers/webhook-delivery.ts` | `@packages/queue/webhook-delivery` | `@packages/events/queues/webhook-delivery` |
| `apps/worker/src/workers/budget-alerts.ts` | `@packages/queue/budget-alerts` | `@packages/events/queues/budget-alerts` |
| `apps/web/src/integrations/queue/budget-alerts-queue.ts` | `@packages/queue/budget-alerts`, `@packages/queue/connection` | `@packages/events/queues/budget-alerts`, `@packages/events/queues/connection` |
| `packages/events/__tests__/emit.test.ts` | `@packages/queue/connection`, `@packages/queue/webhook-delivery` | Rewritten from scratch |

**package.json dependency updates:**
| File | Remove | Add (if not present) |
|---|---|---|
| `packages/events/package.json` | `"@packages/queue": "workspace:*"` | `"bullmq": "catalog:workers"` (direct dep now) |
| `apps/worker/package.json` | `"@packages/queue": "workspace:*"` | (already has `@packages/events`) |
| `apps/web/package.json` | (no direct queue dep) | — |

---

### Task 1: Add Tooling to Events Package

**Files:**
- Modify: `packages/events/package.json`
- Create: `packages/events/oxlint.json`
- Create: `packages/events/vitest.config.ts`
- Create: `packages/events/tsconfig.test.json`

**Step 1: Update `packages/events/package.json` scripts**

Replace the scripts block with:

```json
"scripts": {
   "build": "tsc --build",
   "check": "oxlint ./src",
   "format": "oxfmt --write ./src",
   "format:check": "oxfmt --check ./src",
   "test": "vitest run",
   "typecheck": "tsgo"
}
```

**Step 2: Create `packages/events/oxlint.json`**

```json
{
   "$schema": "../../node_modules/oxlint/configuration_schema.json",
   "extends": ["../../tooling/oxc/packages.json"]
}
```

Note: events is in `packages/` so it extends `packages.json`, not `core.json`.

**Step 3: Create `packages/events/vitest.config.ts`**

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

**Step 4: Create `packages/events/tsconfig.test.json`**

```json
{
   "extends": "./tsconfig.json",
   "compilerOptions": {
      "types": ["vitest/globals"]
   },
   "include": ["src", "__tests__"]
}
```

**Step 5: Commit**

```bash
git add packages/events/package.json packages/events/oxlint.json packages/events/vitest.config.ts packages/events/tsconfig.test.json
git commit -m "chore(events): add vitest, oxlint, and oxfmt tooling"
```

---

### Task 2: Move Queue Code into Events

**Files:**
- Create: `packages/events/src/queues/connection.ts`
- Create: `packages/events/src/queues/webhook-delivery.ts`
- Create: `packages/events/src/queues/budget-alerts.ts`
- Modify: `packages/events/package.json` (add exports, update deps)

**Step 1: Create `packages/events/src/queues/connection.ts`**

```typescript
import type { ConnectionOptions } from "bullmq";

export function createQueueConnection(redisUrl: string): ConnectionOptions {
   const url = new URL(redisUrl);

   return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      family: 6,
      maxRetriesPerRequest: null,
   };
}
```

**Step 2: Create `packages/events/src/queues/webhook-delivery.ts`**

```typescript
import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";

export const WEBHOOK_DELIVERY_QUEUE = "webhook-delivery";

export interface WebhookDeliveryJobData {
   deliveryId: string;
   webhookEndpointId: string;
   eventId: string;
   url: string;
   payload: Record<string, unknown>;
   signingSecret: string;
   attemptNumber: number;
}

export function createWebhookDeliveryQueue(
   connection: ConnectionOptions,
): Queue<WebhookDeliveryJobData> {
   return new Queue<WebhookDeliveryJobData>(WEBHOOK_DELIVERY_QUEUE, {
      connection,
      defaultJobOptions: {
         attempts: 5,
         backoff: {
            type: "exponential",
            delay: 60_000,
         },
         removeOnComplete: { count: 1000 },
         removeOnFail: { count: 5000 },
      },
   });
}
```

**Step 3: Create `packages/events/src/queues/budget-alerts.ts`**

```typescript
import type { ConnectionOptions } from "bullmq";
import { Queue } from "bullmq";

export const BUDGET_ALERTS_QUEUE = "budget-alerts";

export interface BudgetAlertJobData {
   teamId: string;
   month: number;
   year: number;
}

export function createBudgetAlertsQueue(
   connection: ConnectionOptions,
): Queue<BudgetAlertJobData> {
   return new Queue<BudgetAlertJobData>(BUDGET_ALERTS_QUEUE, {
      connection,
      defaultJobOptions: {
         attempts: 3,
         backoff: { type: "exponential", delay: 30_000 },
         removeOnComplete: { count: 500 },
         removeOnFail: { count: 1000 },
      },
   });
}
```

**Step 4: Update `packages/events/package.json`**

Add new exports:

```json
"./queues/connection": {
   "types": "./dist/src/queues/connection.d.ts",
   "default": "./src/queues/connection.ts"
},
"./queues/webhook-delivery": {
   "types": "./dist/src/queues/webhook-delivery.d.ts",
   "default": "./src/queues/webhook-delivery.ts"
},
"./queues/budget-alerts": {
   "types": "./dist/src/queues/budget-alerts.d.ts",
   "default": "./src/queues/budget-alerts.ts"
}
```

Update dependencies — remove `"@packages/queue": "workspace:*"` and add `"bullmq": "catalog:workers"` if not already present.

**Step 5: Update internal import in `packages/events/src/emit.ts`**

Replace:
```typescript
import { createQueueConnection } from "@packages/queue/connection";
import {
   createWebhookDeliveryQueue,
   type WebhookDeliveryJobData,
} from "@packages/queue/webhook-delivery";
```

With:
```typescript
import { createQueueConnection } from "./queues/connection";
import {
   createWebhookDeliveryQueue,
   type WebhookDeliveryJobData,
} from "./queues/webhook-delivery";
```

**Step 6: Commit**

```bash
git add packages/events/src/queues packages/events/package.json packages/events/src/emit.ts
git commit -m "refactor(events): absorb queue definitions from @packages/queue"
```

---

### Task 3: Update All External Queue Imports

**Files to modify (source imports):**
- `apps/worker/src/index.ts` — `@packages/queue/connection` → `@packages/events/queues/connection`
- `apps/worker/src/jobs/deliver-webhook.ts` — `@packages/queue/webhook-delivery` → `@packages/events/queues/webhook-delivery`
- `apps/worker/src/jobs/check-budget-alerts.ts` — `@packages/queue/budget-alerts` → `@packages/events/queues/budget-alerts`
- `apps/worker/src/workers/webhook-delivery.ts` — `@packages/queue/webhook-delivery` → `@packages/events/queues/webhook-delivery`
- `apps/worker/src/workers/budget-alerts.ts` — `@packages/queue/budget-alerts` → `@packages/events/queues/budget-alerts`
- `apps/web/src/integrations/queue/budget-alerts-queue.ts` — `@packages/queue/budget-alerts` → `@packages/events/queues/budget-alerts`, `@packages/queue/connection` → `@packages/events/queues/connection`

**Files to modify (package.json dependencies):**
- `apps/worker/package.json` — remove `"@packages/queue": "workspace:*"`

**Step 1: Update all source imports**

In every file above, replace `@packages/queue/` with `@packages/events/queues/`.

**Step 2: Update `apps/worker/package.json`**

Remove the `"@packages/queue": "workspace:*"` dependency line. Worker already has `"@packages/events": "workspace:*"`.

**Step 3: Verify no remaining `@packages/queue` references in source**

```bash
grep -r '@packages/queue' --include='*.ts' --include='*.tsx' -l | grep -v node_modules | grep -v __tests__
```

Should return nothing (the old test file will be rewritten in Task 5).

**Step 4: Commit**

```bash
git add apps/worker apps/web/src/integrations/queue
git commit -m "refactor(events): update all @packages/queue imports to @packages/events/queues"
```

---

### Task 4: Delete Queue Package

**Files:**
- Delete: `packages/queue/` (entire directory)

**Step 1: Remove the package**

```bash
rm -rf packages/queue
```

**Step 2: Run `bun install` to update lockfile**

```bash
bun install
```

**Step 3: Commit**

```bash
git add packages/queue bun.lock
git commit -m "chore: delete @packages/queue (absorbed into @packages/events)"
```

---

### Task 5: Remove All Comments from Events Source

The codebase has a strict no-comments rule. All event source files are full of comment dividers and JSDoc blocks.

**Files to modify (all files in `packages/events/src/`):**
- `catalog.ts` — remove top comment block and JSDoc
- `emit.ts` — remove all comment dividers and JSDoc blocks
- `credits.ts` — remove all comment dividers and JSDoc blocks
- `utils.ts` — remove JSDoc blocks
- `reconcile.ts` — remove JSDoc block
- `refresh-views.ts` — remove JSDoc block
- `ai.ts` — remove all comment dividers
- `finance.ts` — remove all comment dividers
- `webhook.ts` — remove all comment dividers
- `dashboard.ts` — remove all comment dividers
- `insight.ts` — remove all comment dividers
- `contact.ts` — remove all comment dividers
- `inventory.ts` — remove all comment dividers
- `service.ts` — remove all comment dividers
- `nfe.ts` — remove all comment dividers
- `document.ts` — remove all comment dividers
- `queues/connection.ts` — already clean (no comments)
- `queues/webhook-delivery.ts` — already clean
- `queues/budget-alerts.ts` — already clean

**Step 1: Strip all comments**

Remove every line that is:
- `// ---...---` divider lines
- `/** ... */` JSDoc blocks
- `// Single line comments`

Keep ONLY executable code, imports, and type definitions.

**Step 2: Run format**

```bash
cd packages/events && bun run format
```

**Step 3: Commit**

```bash
git add packages/events/src
git commit -m "style(events): remove all comments per codebase convention"
```

---

### Task 6: Write Catalog Tests

**Files:**
- Create: `packages/events/__tests__/catalog.test.ts`

**Step 1: Write tests**

`packages/events/__tests__/catalog.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import {
   EVENT_CATEGORIES,
   getEventCategory,
} from "../src/catalog";

describe("EVENT_CATEGORIES", () => {
   it("contains all expected categories", () => {
      expect(EVENT_CATEGORIES).toEqual({
         finance: "finance",
         ai: "ai",
         webhook: "webhook",
         dashboard: "dashboard",
         insight: "insight",
         contact: "contact",
         inventory: "inventory",
         service: "service",
         nfe: "nfe",
         document: "document",
         system: "system",
      });
   });
});

describe("getEventCategory", () => {
   it("extracts category from dotted event name", () => {
      expect(getEventCategory("finance.transaction_created")).toBe("finance");
      expect(getEventCategory("ai.chat_message")).toBe("ai");
      expect(getEventCategory("webhook.delivered")).toBe("webhook");
   });

   it("returns undefined for unknown category prefix", () => {
      expect(getEventCategory("unknown.event")).toBeUndefined();
   });

   it("returns undefined for empty string", () => {
      expect(getEventCategory("")).toBeUndefined();
   });

   it("handles single segment event name", () => {
      expect(getEventCategory("finance")).toBe("finance");
   });

   it("handles deeply nested event name", () => {
      expect(getEventCategory("webhook.endpoint.created")).toBe("webhook");
   });
});
```

**Step 2: Run tests**

```bash
cd packages/events && npx vitest run __tests__/catalog.test.ts
```

Expected: All pass.

**Step 3: Commit**

```bash
git add packages/events/__tests__/catalog.test.ts
git commit -m "test(events): add catalog tests"
```

---

### Task 7: Write Credits Tests

**Files:**
- Create: `packages/events/__tests__/credits.test.ts`

**Step 1: Write tests**

`packages/events/__tests__/credits.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn<(key: string) => Promise<string | null>>();
const mockIncr = vi.fn<(key: string) => Promise<number>>();
const mockPexpire = vi.fn<(key: string, ms: number) => Promise<number>>();

vi.mock("@core/redis/connection", () => ({
   getRedisConnection: () => ({
      get: mockGet,
      incr: mockIncr,
      pexpire: mockPexpire,
   }),
}));

vi.mock("@core/stripe/constants", () => ({
   FREE_TIER_LIMITS: {
      "finance.transaction_created": 500,
      "ai.chat_message": 20,
   } as Record<string, number>,
}));

import {
   getCurrentUsage,
   incrementUsage,
   isWithinFreeTier,
} from "../src/credits";

beforeEach(() => {
   vi.clearAllMocks();
});

describe("isWithinFreeTier", () => {
   it("returns true when usage is below limit", async () => {
      mockGet.mockResolvedValue("10");
      const result = await isWithinFreeTier("org-1", "finance.transaction_created");
      expect(result).toBe(true);
   });

   it("returns false when usage meets limit", async () => {
      mockGet.mockResolvedValue("500");
      const result = await isWithinFreeTier("org-1", "finance.transaction_created");
      expect(result).toBe(false);
   });

   it("returns false when usage exceeds limit", async () => {
      mockGet.mockResolvedValue("501");
      const result = await isWithinFreeTier("org-1", "finance.transaction_created");
      expect(result).toBe(false);
   });

   it("returns true when no usage recorded (null)", async () => {
      mockGet.mockResolvedValue(null);
      const result = await isWithinFreeTier("org-1", "finance.transaction_created");
      expect(result).toBe(true);
   });

   it("returns true for non-metered events", async () => {
      const result = await isWithinFreeTier("org-1", "dashboard.created");
      expect(result).toBe(true);
   });
});

describe("incrementUsage", () => {
   it("increments the counter", async () => {
      mockIncr.mockResolvedValue(5);
      await incrementUsage("org-1", "ai.chat_message");
      expect(mockIncr).toHaveBeenCalledWith("usage:org-1:ai.chat_message");
   });

   it("sets TTL on first increment", async () => {
      mockIncr.mockResolvedValue(1);
      await incrementUsage("org-1", "ai.chat_message");
      expect(mockPexpire).toHaveBeenCalledWith(
         "usage:org-1:ai.chat_message",
         expect.any(Number),
      );
   });

   it("does not set TTL on subsequent increments", async () => {
      mockIncr.mockResolvedValue(2);
      await incrementUsage("org-1", "ai.chat_message");
      expect(mockPexpire).not.toHaveBeenCalled();
   });
});

describe("getCurrentUsage", () => {
   it("returns usage data for metered events", async () => {
      mockGet.mockResolvedValue("100");
      const result = await getCurrentUsage("org-1", "finance.transaction_created");
      expect(result).toEqual({
         used: 100,
         limit: 500,
         withinFreeTier: true,
      });
   });

   it("returns over-limit status", async () => {
      mockGet.mockResolvedValue("600");
      const result = await getCurrentUsage("org-1", "finance.transaction_created");
      expect(result).toEqual({
         used: 600,
         limit: 500,
         withinFreeTier: false,
      });
   });

   it("returns zero usage when no data", async () => {
      mockGet.mockResolvedValue(null);
      const result = await getCurrentUsage("org-1", "finance.transaction_created");
      expect(result).toEqual({
         used: 0,
         limit: 500,
         withinFreeTier: true,
      });
   });

   it("returns zero limit for non-metered events", async () => {
      mockGet.mockResolvedValue(null);
      const result = await getCurrentUsage("org-1", "dashboard.created");
      expect(result).toEqual({
         used: 0,
         limit: 0,
         withinFreeTier: true,
      });
   });
});
```

**Step 2: Run tests**

```bash
cd packages/events && npx vitest run __tests__/credits.test.ts
```

Expected: All pass.

**Step 3: Commit**

```bash
git add packages/events/__tests__/credits.test.ts
git commit -m "test(events): add credits tests"
```

---

### Task 8: Write Queue Module Tests

**Files:**
- Create: `packages/events/__tests__/queues/connection.test.ts`

**Step 1: Write tests**

`packages/events/__tests__/queues/connection.test.ts`

```typescript
import { describe, expect, it } from "vitest";
import { createQueueConnection } from "../../src/queues/connection";

describe("createQueueConnection", () => {
   it("parses a full Redis URL", () => {
      const conn = createQueueConnection("redis://admin:secret@redis.host:6380");
      expect(conn).toEqual({
         host: "redis.host",
         port: 6380,
         password: "secret",
         username: "admin",
         family: 6,
         maxRetriesPerRequest: null,
      });
   });

   it("defaults port to 6379", () => {
      const conn = createQueueConnection("redis://redis.host");
      expect(conn.port).toBe(6379);
   });

   it("handles URL without auth", () => {
      const conn = createQueueConnection("redis://redis.host:6379");
      expect(conn.password).toBeUndefined();
      expect(conn.username).toBeUndefined();
   });

   it("sets maxRetriesPerRequest to null (required by BullMQ)", () => {
      const conn = createQueueConnection("redis://localhost");
      expect(conn.maxRetriesPerRequest).toBeNull();
   });
});
```

**Step 2: Run tests**

```bash
cd packages/events && npx vitest run __tests__/queues/connection.test.ts
```

Expected: All pass.

**Step 3: Commit**

```bash
git add packages/events/__tests__/queues
git commit -m "test(events): add queue connection tests"
```

---

### Task 9: Rewrite Emit Test with Vitest

**Files:**
- Rewrite: `packages/events/__tests__/emit.test.ts`

The existing test uses `bun:test` and mocks `@packages/queue/*` which no longer exists. Rewrite with vitest mocking the new internal queue paths and all external dependencies.

**Step 1: Delete old test and write new one**

`packages/events/__tests__/emit.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseInstance } from "@core/database/client";

const mockFindMatchingWebhooks = vi.fn().mockResolvedValue([]);
const mockCreateWebhookDelivery = vi
   .fn()
   .mockResolvedValue({ id: "delivery-1" });

vi.mock("@core/database/repositories/webhook-repository", () => ({
   findMatchingWebhooks: mockFindMatchingWebhooks,
   createWebhookDelivery: mockCreateWebhookDelivery,
}));

vi.mock("@core/logging/root", () => ({
   getLogger: () => ({
      child: () => ({
         info: vi.fn(),
         warn: vi.fn(),
         error: vi.fn(),
      }),
   }),
}));

vi.mock("@core/redis/connection", () => ({
   getRedisConnection: () => null,
}));

const mockGetEventPrice = vi.fn().mockResolvedValue({
   price: { amount: 0n, currency: "BRL", scale: 6 },
   isBillable: false,
});

vi.mock("../src/utils", () => ({
   getEventPrice: mockGetEventPrice,
}));

vi.mock("@f-o-t/money", () => ({
   toMajorUnitsString: () => "0.000000",
}));

const mockQueueAdd = vi.fn().mockResolvedValue(undefined);

vi.mock("../src/queues/connection", () => ({
   createQueueConnection: () => ({}),
}));

vi.mock("../src/queues/webhook-delivery", () => ({
   createWebhookDeliveryQueue: () => ({ add: mockQueueAdd }),
}));

import { EVENT_CATEGORIES } from "../src/catalog";
import { emitEvent, initializeWebhookQueue } from "../src/emit";

function createMockDb() {
   const mockReturning = vi.fn().mockResolvedValue([{ id: "event-1" }]);
   const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
   const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

   const mockLimit = vi
      .fn()
      .mockResolvedValue([{ pricePerEvent: "0", isBillable: false }]);
   const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
   const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
   const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

   return {
      insert: mockInsert,
      select: mockSelect,
   } as unknown as DatabaseInstance;
}

beforeEach(() => {
   vi.clearAllMocks();
});

describe("emitEvent", () => {
   it("inserts event into database", async () => {
      const db = createMockDb();

      await emitEvent({
         db,
         organizationId: "org-1",
         eventName: "finance.transaction_created",
         eventCategory: EVENT_CATEGORIES.finance,
         properties: { transactionId: "tx-1" },
         userId: "user-1",
         teamId: "team-1",
      });

      expect(db.insert).toHaveBeenCalled();
   });

   it("sends to PostHog when client provided", async () => {
      const db = createMockDb();
      const posthog = { capture: vi.fn() };

      await emitEvent({
         db,
         posthog: posthog as any,
         organizationId: "org-1",
         eventName: "ai.chat_message",
         eventCategory: EVENT_CATEGORIES.ai,
         properties: { chatId: "chat-1" },
         userId: "user-1",
      });

      expect(posthog.capture).toHaveBeenCalledWith(
         expect.objectContaining({
            distinctId: "user-1",
            event: "ai.chat_message",
            groups: { organization: "org-1" },
         }),
      );
   });

   it("uses organizationId as distinctId when no userId", async () => {
      const db = createMockDb();
      const posthog = { capture: vi.fn() };

      await emitEvent({
         db,
         posthog: posthog as any,
         organizationId: "org-1",
         eventName: "webhook.delivered",
         eventCategory: EVENT_CATEGORIES.webhook,
         properties: {},
      });

      expect(posthog.capture).toHaveBeenCalledWith(
         expect.objectContaining({
            distinctId: "org-1",
         }),
      );
   });

   it("triggers webhook delivery when queue is initialized", async () => {
      initializeWebhookQueue("redis://test");

      const db = createMockDb();
      mockFindMatchingWebhooks.mockResolvedValueOnce([
         {
            id: "wh-1",
            url: "https://example.com/hook",
            signingSecret: "secret",
         },
      ]);

      await emitEvent({
         db,
         organizationId: "org-1",
         eventName: "finance.transaction_created",
         eventCategory: EVENT_CATEGORIES.finance,
         properties: { foo: "bar" },
         userId: "user-1",
         teamId: "team-1",
      });

      expect(mockFindMatchingWebhooks).toHaveBeenCalledWith(
         "org-1",
         "finance.transaction_created",
         "team-1",
      );
      expect(mockCreateWebhookDelivery).toHaveBeenCalled();
      expect(mockQueueAdd).toHaveBeenCalledWith(
         "deliver",
         expect.objectContaining({
            deliveryId: "delivery-1",
            webhookEndpointId: "wh-1",
            url: "https://example.com/hook",
            signingSecret: "secret",
         }),
      );
   });

   it("does not throw on error (non-throwing)", async () => {
      const db = {
         insert: vi.fn().mockImplementation(() => {
            throw new Error("DB down");
         }),
         select: vi.fn(),
      } as unknown as DatabaseInstance;

      await expect(
         emitEvent({
            db,
            organizationId: "org-1",
            eventName: "ai.chat_message",
            eventCategory: EVENT_CATEGORIES.ai,
            properties: {},
         }),
      ).resolves.toBeUndefined();
   });
});
```

**Step 2: Run tests**

```bash
cd packages/events && npx vitest run __tests__/emit.test.ts
```

Expected: All pass.

**Step 3: Commit**

```bash
git add packages/events/__tests__/emit.test.ts
git commit -m "test(events): rewrite emit tests with vitest"
```

---

### Task 10: Final Verification

**Step 1: Run `bun install`**

```bash
bun install
```

**Step 2: Run lint and format on events**

```bash
cd packages/events && bun run check && bun run format:check
```

**Step 3: Run all events tests**

```bash
cd packages/events && npx vitest run
```

**Step 4: Verify no stale references**

```bash
grep -r '@packages/queue' --include='*.ts' --include='*.tsx' -l | grep -v node_modules | grep -v dist
```

Should return zero results.

**Step 5: Verify queue directory is gone**

```bash
ls packages/queue 2>&1 && echo "ERROR: still exists" || echo "OK: deleted"
```

**Step 6: Commit if needed**

```bash
git add -A
git commit -m "chore(events): final cleanup and verification"
```
