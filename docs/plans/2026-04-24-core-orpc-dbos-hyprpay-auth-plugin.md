# core/orpc + core/dbos + HyprPay Better Auth Plugin

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract oRPC procedures to `@core/orpc`, extract DBOSClient creation to `@core/dbos`, and ADD a HyprPay Better Auth plugin alongside the existing `@better-auth/stripe` — all in one PR.

**Architecture:** Three clean extractions. `@core/orpc` defines `createORPCProcedures(deps)` factory with all middleware/telemetry — `apps/web/server.ts` calls it and re-exports. `@core/dbos` wraps `DBOSClient.create()`. HyprPay plugin (`libraries/hyprpay/src/better-auth/`) is added to `core/authentication` alongside `@better-auth/stripe` — Stripe plugin stays untouched. `billing.ts` router keeps `stripeClient` in context — no changes there.

**Tech Stack:** `@orpc/server`, `better-auth`, `@dbos-inc/dbos-sdk`, `dayjs`, `neverthrow`, workspace packages.

---

## What changes vs what stays

| Piece | This PR |
|---|---|
| `apps/web/src/integrations/orpc/server.ts` | Becomes a thin wiring file — calls `createORPCProcedures()`, re-exports procedures |
| All router files (`router/*.ts`) | **No changes** — they still import from `"../server"` |
| `core/orpc/` | **New package** — owns context types + procedure factory |
| `core/dbos/` | **New package** — owns `createWorkflowClient()` |
| `apps/web/singletons.ts` | Swap `DBOSClient.create()` → `createWorkflowClient()` from `@core/dbos/client` |
| `libraries/hyprpay/src/better-auth/` | **New** — HyprPay Better Auth plugin |
| `core/authentication/src/server.ts` | Add `hyprpay()` plugin alongside existing `stripePlugin` — Stripe untouched |
| `core/authentication/package.json` | Add `@montte/hyprpay` dep |
| `apps/web/src/integrations/better-auth/auth-client.ts` | **No changes** |
| `core/stripe/` | **Stays** — no changes |
| `billing.ts` router | **No changes** |

---

## Task 1: Scaffold `@core/orpc` package

**Files:**
- Create: `core/orpc/package.json`
- Create: `core/orpc/tsconfig.json`

**Step 1: Create `core/orpc/package.json`**

```json
{
   "name": "@core/orpc",
   "version": "0.1.0",
   "private": true,
   "license": "Apache-2.0",
   "files": ["dist"],
   "type": "module",
   "exports": {
      "./context": {
         "types": "./dist/context.d.ts",
         "default": "./dist/context.js"
      },
      "./procedures": {
         "types": "./dist/procedures.d.ts",
         "default": "./dist/procedures.js"
      }
   },
   "scripts": {
      "build": "tsc --build",
      "check": "oxlint ./src",
      "format": "oxfmt --write ./src",
      "format:check": "oxfmt --check ./src",
      "test": "vitest run --passWithNoTests",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@core/authentication": "workspace:*",
      "@core/database": "workspace:*",
      "@core/logging": "workspace:*",
      "@core/posthog": "workspace:*",
      "@core/redis": "workspace:*",
      "@core/stripe": "workspace:*",
      "@core/utils": "workspace:*",
      "@dbos-inc/dbos-sdk": "catalog:workers",
      "@opentelemetry/api-logs": "catalog:telemetry",
      "@orpc/server": "catalog:orpc",
      "@packages/notifications": "workspace:*",
      "dayjs": "catalog:ui",
      "neverthrow": "catalog:validation"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "typescript": "catalog:development"
   }
}
```

**Step 2: Create `core/orpc/tsconfig.json`**

```json
{
   "extends": "@tooling/typescript/core.json",
   "compilerOptions": {
      "paths": {
         "@core/authentication/*": ["../../core/authentication/src/*"],
         "@core/database": ["../../core/database/src/index.ts"],
         "@core/database/*": ["../../core/database/src/*"],
         "@core/environment/*": ["../../core/environment/src/*"],
         "@core/logging": ["../../core/logging/src/logger.ts"],
         "@core/logging/*": ["../../core/logging/src/*"],
         "@core/posthog/*": ["../../core/posthog/src/*"],
         "@core/redis/*": ["../../core/redis/src/*"],
         "@core/stripe": ["../../core/stripe/src/index.ts"],
         "@core/stripe/*": ["../../core/stripe/src/*"],
         "@core/utils/*": ["../../core/utils/src/*"],
         "@packages/notifications/*": ["../../packages/notifications/src/*"]
      }
   },
   "references": [
      { "path": "../authentication" },
      { "path": "../database" },
      { "path": "../logging" },
      { "path": "../posthog" },
      { "path": "../redis" },
      { "path": "../stripe" },
      { "path": "../utils" },
      { "path": "../../packages/notifications" }
   ],
   "include": ["src"]
}
```

**Step 3: Create `core/orpc/src/` directory**

```bash
mkdir -p /path/to/core/orpc/src
```

**Step 4: Add to root `tsconfig.json` references**

In the root `tsconfig.json`, add:
```json
{ "path": "./core/orpc" }
```

Add it alongside the other core references (after `core/utils`).

**Step 5: No commit yet — wait for source files.**

---

## Task 2: Extract context types to `@core/orpc/context`

**Files:**
- Create: `core/orpc/src/context.ts`

**Step 1: Create `core/orpc/src/context.ts`**

Copy the context interfaces from `apps/web/src/integrations/orpc/server.ts` lines 30–53:

```typescript
import type { AuthInstance } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import type { Redis } from "@core/redis/connection";
import type { StripeClient } from "@core/stripe";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import type { createJobPublisher } from "@packages/notifications/publisher";

export interface ORPCContext {
   headers: Headers;
   request: Request;
}

export interface ORPCContextWithAuth extends ORPCContext {
   auth: AuthInstance;
   db: DatabaseInstance;
   session: Awaited<ReturnType<AuthInstance["api"]["getSession"]>> | null;
   posthog: PostHog;
   stripeClient: StripeClient;
   redis: Redis;
   workflowClient: DBOSClient;
   jobPublisher: ReturnType<typeof createJobPublisher>;
}

export interface ORPCContextAuthenticated extends ORPCContextWithAuth {
   session: NonNullable<ORPCContextWithAuth["session"]>;
   userId: string;
}

export interface ORPCContextWithOrganization extends ORPCContextAuthenticated {
   organizationId: string;
   teamId: string;
}
```

---

## Task 3: Extract procedure factory to `@core/orpc/procedures`

**Files:**
- Create: `core/orpc/src/procedures.ts`

**Step 1: Create `core/orpc/src/procedures.ts`**

This is the full procedure chain from `apps/web/src/integrations/orpc/server.ts` — refactored into a factory that takes deps instead of importing singletons:

```typescript
import dayjs from "dayjs";
import { fromPromise, fromThrowable } from "neverthrow";
import { logs } from "@opentelemetry/api-logs";
import { ORPCError, os } from "@orpc/server";
import type { AuthInstance } from "@core/authentication/server";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import {
   captureError,
   captureServerEvent,
   identifyUser,
   setGroup,
} from "@core/posthog/server";
import { AppError, WebAppError } from "@core/logging/errors";
import type { Redis } from "@core/redis/connection";
import type { StripeClient } from "@core/stripe";
import type { DBOSClient } from "@dbos-inc/dbos-sdk";
import { sanitizeData } from "@core/utils/sanitization";
import { createJobPublisher } from "@packages/notifications/publisher";
import type { ORPCContext } from "./context";

export interface ORPCProcedureDeps {
   auth: AuthInstance;
   db: DatabaseInstance;
   posthog: PostHog;
   redis: Redis;
   stripeClient: StripeClient;
   workflowClient: Promise<DBOSClient>;
   jobPublisher: ReturnType<typeof createJobPublisher>;
}

const otelLogger = logs.getLogger("montte-web-orpc");

export function createORPCProcedures(deps: ORPCProcedureDeps) {
   const base = os.$context<ORPCContext>();

   const withDeps = base.use(async ({ context, next }) => {
      const sessionResult = await fromPromise(
         (async () => deps.auth.api.getSession({ headers: context.headers }))(),
         () => null,
      );

      return next({
         context: {
            ...context,
            auth: deps.auth,
            db: deps.db,
            session: sessionResult.isOk() ? sessionResult.value : null,
            posthog: deps.posthog,
            stripeClient: deps.stripeClient,
            redis: deps.redis,
            workflowClient: await deps.workflowClient,
            jobPublisher: deps.jobPublisher,
         },
      });
   });

   const withAuth = withDeps.use(async ({ context, next }) => {
      const { session } = context;

      if (!session?.user) {
         throw new ORPCError("UNAUTHORIZED", {
            message: "You must be logged in to access this resource",
         });
      }

      return next({
         context: {
            ...context,
            session,
            userId: session.user.id,
         },
      });
   });

   const withOrganization = withAuth.use(async ({ context, next }) => {
      const { session } = context;
      const organizationId = session.session.activeOrganizationId;

      if (!organizationId) {
         throw new ORPCError("FORBIDDEN", {
            message: "No active organization selected",
         });
      }

      const teamId = session.session.activeTeamId;

      if (!teamId) {
         throw new ORPCError("FORBIDDEN", {
            message: "No active team selected",
         });
      }

      return next({
         context: { ...context, organizationId, teamId },
      });
   });

   const withTelemetry = withOrganization.use(
      async ({ context, path, next }, input) => {
         const startDate = dayjs().toDate();
         const userId = context.session?.user?.id;
         const userEmail = context.session?.user?.email;
         const userName = context.session?.user?.name;
         const organizationId = context.organizationId;
         const teamId = context.teamId;

         const sessionId = context.headers.get("x-posthog-session-id");

         const otelIdentity = {
            posthogDistinctId: userId ?? "anonymous",
            ...(sessionId ? { sessionId } : {}),
            organizationId,
            teamId,
            path: path.join("."),
         };

         otelLogger.emit({
            severityText: "info",
            body: `oRPC request: ${path.join(".")}`,
            attributes: otelIdentity,
         });

         if (userId && deps.posthog) {
            identifyUser(deps.posthog, userId, {
               email: userEmail,
               name: userName,
            });
            if (organizationId) setGroup(deps.posthog, organizationId, {});
         }

         const result = await fromPromise(
            (async () => next())(),
            (err): Error => (err instanceof Error ? err : new Error(String(err))),
         );

         const durationMs = Date.now() - startDate.getTime();
         const isSuccess = result.isOk();
         const error = result.isErr() ? result.error : null;

         otelLogger.emit({
            severityText: isSuccess ? "info" : "error",
            body: isSuccess
               ? `oRPC completed: ${path.join(".")} (${durationMs}ms)`
               : `oRPC error: ${path.join(".")} — ${error?.message}`,
            attributes: {
               ...otelIdentity,
               durationMs,
               success: isSuccess,
               ...(error
                  ? { errorName: error.name, errorMessage: error.message }
                  : {}),
            },
         });

         if (userId && deps.posthog) {
            const safeCapture = fromThrowable(() => {
               const rootPath = path[0];
               if (!isSuccess && error) {
                  captureError(deps.posthog!, {
                     code: "INTERNAL_SERVER_ERROR",
                     errorId: crypto.randomUUID(),
                     input: sanitizeData(input),
                     message: error.message,
                     organizationId: organizationId || undefined,
                     path: path.join("."),
                     userId: userId!,
                  });
               }
               captureServerEvent(deps.posthog!, {
                  userId: userId!,
                  event: "orpc_request",
                  properties: {
                     durationMs,
                     endAt: dayjs().toISOString(),
                     input: sanitizeData(input),
                     path: path.join("."),
                     rootPath,
                     startAt: startDate.toISOString(),
                     success: isSuccess,
                     ...(isSuccess
                        ? {}
                        : {
                             errorMessage: error?.message,
                             errorName: error?.name,
                          }),
                  },
                  groups: organizationId
                     ? { organization: organizationId }
                     : undefined,
               });
            });
            safeCapture();
         }

         if (result.isErr()) {
            const err = result.error;
            if (err instanceof AppError) throw WebAppError.fromAppError(err);
            throw err;
         }
         return result.value;
      },
   );

   return {
      publicProcedure: withDeps,
      authenticatedProcedure: withAuth,
      protectedProcedure: withTelemetry,
   };
}
```

**Step 2: Build `core/orpc` to verify types**

```bash
cd core/orpc && bun run build
```

Expected: `dist/` emitted with `context.d.ts` and `procedures.d.ts`.

**Step 3: Commit**

```bash
git add core/orpc/
git commit -m "feat(core): scaffold @core/orpc package with procedure factory"
```

---

## Task 4: Wire `apps/web` to `@core/orpc`

**Files:**
- Modify: `apps/web/src/integrations/orpc/server.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`

**Step 1: Replace `apps/web/src/integrations/orpc/server.ts` entirely**

```typescript
import { createJobPublisher } from "@packages/notifications/publisher";
import { createORPCProcedures } from "@core/orpc/procedures";
import {
   auth,
   db,
   posthog,
   redis,
   stripeClient,
   workflowClient,
} from "@/integrations/singletons";

const jobPublisher = createJobPublisher(redis);

export type {
   ORPCContext,
   ORPCContextWithAuth,
   ORPCContextAuthenticated,
   ORPCContextWithOrganization,
} from "@core/orpc/context";

export const { publicProcedure, authenticatedProcedure, protectedProcedure } =
   createORPCProcedures({
      auth,
      db,
      posthog,
      redis,
      stripeClient,
      workflowClient,
      jobPublisher,
   });
```

> `workflowClient` in `singletons.ts` is `Promise<DBOSClient>` — pass it directly, the factory awaits it inside the middleware.

**Step 2: Add `@core/orpc` dep to `apps/web/package.json`**

```json
"@core/orpc": "workspace:*"
```

Add alongside the other `@core/*` deps in `dependencies`.

**Step 3: Add path alias + tsconfig reference to `apps/web/tsconfig.json`**

In `compilerOptions.paths`, add:
```json
"@core/orpc/*": ["../../core/orpc/src/*"]
```

In `references`, add:
```json
{ "path": "../../core/orpc" }
```

**Step 4: Typecheck**

```bash
bun run typecheck
```

Expected: no errors related to oRPC context or procedures. All router files still work because they import from `"../server"` which re-exports identically.

**Step 5: Commit**

```bash
git add apps/web/src/integrations/orpc/server.ts apps/web/package.json apps/web/tsconfig.json tsconfig.json
git commit -m "refactor(orpc): wire apps/web to @core/orpc procedure factory"
```

---

## Task 5: Scaffold `@core/dbos` package

**Files:**
- Create: `core/dbos/package.json`
- Create: `core/dbos/tsconfig.json`
- Create: `core/dbos/src/client.ts`

**Step 1: Create `core/dbos/package.json`**

```json
{
   "name": "@core/dbos",
   "version": "0.1.0",
   "private": true,
   "license": "Apache-2.0",
   "files": ["dist"],
   "type": "module",
   "exports": {
      "./client": {
         "types": "./dist/client.d.ts",
         "default": "./dist/client.js"
      }
   },
   "scripts": {
      "build": "tsc --build",
      "check": "oxlint ./src",
      "format": "oxfmt --write ./src",
      "format:check": "oxfmt --check ./src",
      "test": "vitest run --passWithNoTests",
      "typecheck": "tsgo"
   },
   "dependencies": {
      "@dbos-inc/dbos-sdk": "catalog:workers"
   },
   "devDependencies": {
      "@tooling/typescript": "workspace:*",
      "typescript": "catalog:development"
   }
}
```

**Step 2: Create `core/dbos/tsconfig.json`**

```json
{
   "extends": "@tooling/typescript/core.json",
   "compilerOptions": {},
   "include": ["src"]
}
```

**Step 3: Create `core/dbos/src/client.ts`**

```typescript
import { DBOSClient } from "@dbos-inc/dbos-sdk";

export function createWorkflowClient(
   systemDatabaseUrl: string,
): Promise<DBOSClient> {
   return DBOSClient.create({ systemDatabaseUrl });
}

export type { DBOSClient };
```

**Step 4: Add to root `tsconfig.json` references**

```json
{ "path": "./core/dbos" }
```

**Step 5: Build**

```bash
cd core/dbos && bun run build
```

Expected: `dist/client.d.ts` and `dist/client.js` emitted.

---

## Task 6: Wire `apps/web` singletons to `@core/dbos`

**Files:**
- Modify: `apps/web/src/integrations/singletons.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`

**Step 1: Update `apps/web/src/integrations/singletons.ts`**

Replace:
```typescript
import { DBOSClient } from "@dbos-inc/dbos-sdk";

export const workflowClient = DBOSClient.create({
   systemDatabaseUrl: env.DATABASE_URL,
});
```

With:
```typescript
import { createWorkflowClient } from "@core/dbos/client";

export const workflowClient = createWorkflowClient(env.DATABASE_URL);
```

**Step 2: Add `@core/dbos` to `apps/web/package.json`**

```json
"@core/dbos": "workspace:*"
```

**Step 3: Add path alias + tsconfig reference to `apps/web/tsconfig.json`**

In `compilerOptions.paths`:
```json
"@core/dbos/*": ["../../core/dbos/src/*"]
```

In `references`:
```json
{ "path": "../../core/dbos" }
```

**Step 4: Typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add core/dbos/ apps/web/src/integrations/singletons.ts apps/web/package.json apps/web/tsconfig.json tsconfig.json
git commit -m "feat(core): @core/dbos package — createWorkflowClient factory"
```

---

## Task 7: Create HyprPay Better Auth plugin

**Files:**
- Create: `libraries/hyprpay/src/better-auth/index.ts`

**Context:** The `./better-auth` export is already configured in `libraries/hyprpay/package.json` — it just needs the source file. The plugin replaces `@better-auth/stripe`. It is intentionally minimal: auth lifecycle concerns (Stripe customer creation, external subscription state) are removed. Billing is now fully DB-backed via Montte's own subscription tables; HyprPay hooks will be added here as billing evolves.

**Step 1: Create `libraries/hyprpay/src/better-auth/index.ts`**

```typescript
import type { BetterAuthPlugin } from "better-auth";

export interface HyprPayPluginOptions {
   // Reserved for future: gateway config, plan definitions, lifecycle callbacks
}

export function hyprpay(_options?: HyprPayPluginOptions): BetterAuthPlugin {
   return {
      id: "hyprpay",
   };
}
```

**Step 2: Build the library**

```bash
cd libraries/hyprpay && bun run build
```

Expected: `dist/esm/better-auth/index.js` and `dist/cjs/better-auth/index.cjs` emitted with no errors.

> If the build script `scripts/build-subpaths.ts` doesn't already handle `better-auth`, add it — check the script for how other subpaths like `contract` are handled and replicate the pattern.

---

## Task 8: Add HyprPay plugin to `core/authentication` (additive)

**Files:**
- Modify: `core/authentication/src/server.ts`
- Modify: `core/authentication/package.json`

**Step 1: Add import to `core/authentication/src/server.ts`**

```typescript
import { hyprpay } from "@montte/hyprpay/better-auth";
```

**Step 2: Add `hyprpay()` to the `plugins` array**

Keep `stripePlugin({...})` exactly as-is. Add `hyprpay()` after it:

```typescript
plugins: [
   // ... all existing plugins unchanged ...
   stripePlugin({ ... }),
   hyprpay(),
   tanstackStartCookies(),
],
```

**Step 3: Update `core/authentication/package.json`**

Add:
```json
"@montte/hyprpay": "workspace:*"
```

**Step 4: Build auth**

```bash
cd core/authentication && bun run build
```

Expected: builds clean.

---

## Task 9: Typecheck after all changes

**Step 1: Run full typecheck**

```bash
bun run typecheck
```

Expected: no errors. Nothing removed — only additions.

---

## Task 10: Update CLAUDE.md + plan doc

**Files:**
- Modify: `docs/plans/2026-04-23-modular-monolith-architecture.md`

**Step 1: Mark next milestone as done in the migration table**

Update the migration table row for `core/orpc` extraction:

```markdown
| Next | `core/orpc` — protectedProcedure, context types, procedure factory | ✅ Merged |
| Next | `core/dbos` — createWorkflowClient factory | ✅ Merged |
| Next | HyprPay Better Auth plugin — kill @better-auth/stripe from auth | ✅ Merged |
| Later | `core/authentication` — remove stripeClient from oRPC context when billing.ts migrates | Planned |
| Later | Remaining modules (contacts, finance, inventory) | Planned |
| Later | `modules/analytics` — fresh ParadeDB build | Planned |
```

---

## Task 11: Final typecheck + commit

**Step 1: Run full typecheck**

```bash
bun run typecheck
```

**Step 2: Run boundary check**

```bash
bun run check-boundaries
```

**Step 3: Run tests**

```bash
bun run test
```

**Step 4: Final commit**

```bash
git add -p  # stage remaining changes
git commit -m "feat(auth): replace @better-auth/stripe with HyprPay plugin, wire core/orpc + core/dbos"
```

---

## Caveats

1. **`better-auth` plugin type** — `BetterAuthPlugin` import: check if it's from `"better-auth"` or `"better-auth/types"`. Run `grep -r "BetterAuthPlugin" node_modules/better-auth/dist` to confirm. The `better-auth` package exports it from the root.

2. **`core/authentication/tsconfig.json`** — If it currently references `../../core/stripe` via composite references, remove that reference. If there's no tsconfig in `core/authentication` (auth uses its own build), skip this.

3. **`@montte/hyprpay` workspace resolution** — After adding `"@montte/hyprpay": "workspace:*"` to `core/authentication/package.json`, run `bun install` to update lockfile.

5. **`build-subpaths.ts`** — The `libraries/hyprpay/scripts/build-subpaths.ts` script handles extra ESM subpath entries after the main vite build. Check if `better-auth` subpath is already handled; if not, add it following the `contract` subpath pattern in that script.

---

**Plan complete and saved to `docs/plans/2026-04-24-core-orpc-dbos-hyprpay-auth-plugin.md`.**

**Two execution options:**

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session in the worktree with executing-plans, batch execution with checkpoints

**Which approach?**
