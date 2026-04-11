# Environment Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `core/environment/src/server.ts` (t3-oss, server-only vars) for `apps/server` to use, and delete the orphaned `worker.ts`.

**Architecture:** `@core/environment/web` stays untouched — `apps/web` keeps using it. A new `@core/environment/server` export is added with only the vars `apps/server` needs. `worker.ts` is deleted since `apps/worker` no longer exists. `apps/server` swaps its `@core/environment/web` import for `@core/environment/server`.

**Tech Stack:** `@t3-oss/env-core`, `zod`, Bun monorepo with Nx.

---

### Task 1: Create `core/environment/src/server.ts`

**Files:**
- Create: `core/environment/src/server.ts`

**Step 1: Create the file**

`apps/server` needs: DATABASE_URL (db + DBOS), REDIS_URL, POSTHOG_KEY/HOST, STRIPE_SECRET_KEY/WEBHOOK_SECRET/price IDs, MINIO_*, RESEND_API_KEY, BETTER_AUTH_*, LOG_LEVEL.

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
   server: {
      DATABASE_URL: z.url(),
      REDIS_URL: z.url().optional().default("redis://localhost:6379"),

      BETTER_AUTH_SECRET: z.string().min(32),
      BETTER_AUTH_URL: z.url().optional().default("http://localhost:3000"),
      BETTER_AUTH_TRUSTED_ORIGINS: z.string(),
      BETTER_AUTH_GOOGLE_CLIENT_ID: z.string(),
      BETTER_AUTH_GOOGLE_CLIENT_SECRET: z.string(),

      STRIPE_SECRET_KEY: z.string(),
      STRIPE_WEBHOOK_SECRET: z.string(),
      STRIPE_BOOST_PRICE_ID: z.string().optional(),
      STRIPE_SCALE_PRICE_ID: z.string().optional(),
      STRIPE_ENTERPRISE_PRICE_ID: z.string().optional(),

      POSTHOG_HOST: z.url(),
      POSTHOG_KEY: z.string().min(1),

      RESEND_API_KEY: z.string(),

      MINIO_ENDPOINT: z.string(),
      MINIO_ACCESS_KEY: z.string().optional(),
      MINIO_SECRET_KEY: z.string().optional(),
      MINIO_BUCKET: z.string().optional().default("montte"),

      LOG_LEVEL: z
         .enum(["trace", "debug", "info", "warn", "error", "fatal"])
         .optional()
         .default("info"),
   },
   runtimeEnv: process.env,
});

export type ServerEnv = typeof env;
```

**Step 2: Add `./server` export to `core/environment/package.json`**

Add alongside the existing `./web` and `./helpers` exports:
```json
"./server": {
   "types": "./dist/server.d.ts",
   "default": "./dist/server.js"
}
```

Also remove the `./worker` export entry.

**Step 3: Build `@core/environment`**

```bash
cd core/environment && bun run build
```

Expected: compiles cleanly, `dist/server.d.ts` and `dist/server.js` generated.

**Step 4: Commit**

```bash
git add core/environment/src/server.ts core/environment/package.json
git commit -m "feat(env): add server env to @core/environment"
```

---

### Task 2: Update `apps/server` to use `@core/environment/server`

**Files:**
- Modify: `apps/server/src/index.ts:5`
- Modify: `apps/server/src/singletons.ts:1`
- Modify: `apps/server/src/workflows/budget-alerts.ts:7`

**Step 1: Update `index.ts`**

Change import (line 5):
```typescript
// Before
import { env } from "@core/environment/web";

// After
import { env } from "@core/environment/server";
```

Also add `DBOS.setConfig` call right after imports, before `initOtel(...)`:
```typescript
DBOS.setConfig({
   name: "montte-server",
   systemDatabaseUrl: env.DATABASE_URL,
});
```

**Step 2: Update `singletons.ts`**

Change line 1:
```typescript
// Before
import { env } from "@core/environment/web";

// After
import { env } from "@core/environment/server";
```

**Step 3: Update `budget-alerts.ts`**

Change the import:
```typescript
// Before
import { env } from "@core/environment/web";

// After
import { env } from "@core/environment/server";
```

**Step 4: Typecheck**

```bash
cd apps/server && bun run typecheck 2>&1 | head -30
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/server/src/index.ts apps/server/src/singletons.ts apps/server/src/workflows/budget-alerts.ts
git commit -m "refactor(env): migrate apps/server to @core/environment/server + fix DBOS.setConfig"
```

---

### Task 3: Delete orphaned `worker.ts`

**Files:**
- Delete: `core/environment/src/worker.ts`

**Step 1: Confirm nothing imports it**

```bash
grep -r '@core/environment/worker' . --include='*.ts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=docs
```

Expected: zero results.

**Step 2: Delete the file**

```bash
rm core/environment/src/worker.ts
```

**Step 3: Rebuild and typecheck**

```bash
cd core/environment && bun run build
bun run typecheck 2>&1 | grep -i "worker\|environment" | head -20
```

Expected: clean.

**Step 4: Commit**

```bash
git add core/environment/src/worker.ts
git commit -m "refactor(env): delete orphaned worker env from @core/environment"
```
