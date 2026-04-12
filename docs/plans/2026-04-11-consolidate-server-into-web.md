# Consolidate apps/server into apps/web Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Delete `apps/server` entirely by moving the SDK oRPC API and DBOS workflows into `apps/web`, running everything in the same process.

**Architecture:** The SDK routes move to a new TanStack Start route `/api/sdk/$` in `apps/web`. DBOS is initialized inside `apps/web/src/server.ts` alongside the existing HTTP handler — it starts with `DBOS.launch()` and shuts down with `DBOS.shutdown()`. The two keyword workflows move to `apps/web/src/features/ai/`. The categories router calls `DBOS.startWorkflow(DeriveKeywordsWorkflow).run(...)` directly — no HTTP fetch needed. Since derivation runs in the same process, SSE notifications via `jobPublisher` work without any cross-process pub/sub.

**Tech Stack:** TanStack Start server entry (`server.ts`), DBOS `@dbos-inc/dbos-sdk`, oRPC `@orpc/server`, Better Auth API key verification, TanStack AI + OpenRouter, existing `@packages/notifications` Redis pub/sub.

---

### Task 1: Fix CI — `@packages/events` build error (teamId notNull)

The `events.teamId` DB column is `.notNull()` but `emitEventBatch` maps `teamId: evt.teamId ?? null`. Drizzle's insert type for notNull columns does not accept `null`. Fix: omit the field when undefined (Drizzle treats missing fields as DB default/NULL only for nullable columns — since this column is notNull, the caller must always supply it). The correct fix is to make `teamId` required and throw if missing.

**Files:**
- Modify: `packages/events/src/emit.ts:57-61` (EmitEventBatchParams)
- Modify: `packages/events/src/emit.ts:243-260` (batch row mapper)

**Step 1: Fix the batch row mapper**

In `emitEventBatch`, the `rows` mapper at line 243–260, change:

```typescript
teamId: evt.teamId ?? null,
```

to:

```typescript
teamId: evt.teamId!,
```

Wait — no type casting allowed. The correct fix: the `EmitEventParams` interface already has `teamId?: string` (optional). The events table has `teamId notNull`. This means every event that goes through `emitEventBatch` MUST have a teamId. Add a runtime guard and narrow the type:

In `emitEventBatch`, before the `rows` mapper, add:

```typescript
for (const evt of eventList) {
   if (!evt.teamId) {
      throw new Error(`emitEventBatch: teamId is required but missing for event "${evt.eventName}"`);
   }
}
```

Then change the mapper:

```typescript
teamId: evt.teamId as string,
```

Actually no casts. The proper fix: narrow in the mapper using the guard above. After the guard loop, TypeScript still considers `evt.teamId` as `string | undefined` because TypeScript doesn't narrow across array iterations. Use a type predicate:

```typescript
const rows = eventList.map((evt) => {
   if (!evt.teamId) throw new Error(`emitEventBatch: missing teamId for "${evt.eventName}"`);
   const billing = billingMap.get(evt.eventName) ?? { priceStr: "0", isBillable: false };
   return {
      organizationId: evt.organizationId,
      eventName: evt.eventName,
      eventCategory: evt.eventCategory,
      properties: evt.properties,
      userId: evt.userId ?? null,
      teamId: evt.teamId,
      isBillable: billing.isBillable,
      pricePerEvent: billing.priceStr,
      ipAddress: evt.ipAddress,
      userAgent: evt.userAgent,
   };
});
```

TypeScript narrows `evt.teamId` to `string` after the `if (!evt.teamId) throw` guard inside the same callback. This is the correct, cast-free fix.

**Step 2: Verify build passes**

```bash
cd /path/to/montte-nx && bun run typecheck
```

Expected: no errors in `packages/events`.

**Step 3: Commit**

```bash
git add packages/events/src/emit.ts
git commit -m "fix(events): guard teamId in emitEventBatch to satisfy notNull schema constraint"
```

---

### Task 2: Fix code review comments

Three independent fixes, one commit.

**Files:**
- Modify: `packages/notifications/src/publisher.ts:28-32`
- Modify: `apps/server/src/workflows/backfill-keywords.workflow.ts:27-34`
- Modify: `apps/web/src/integrations/orpc/router/categories.ts:20-38`

**Step 1: Remove `_options` param from subscribeListener**

In `packages/notifications/src/publisher.ts`, the `subscribeListener` signature currently has `_options?: PublisherSubscribeListenerOptions`. Since it's unused and the project forbids `_` prefixed params, remove it entirely. The method still satisfies the abstract signature because TypeScript allows omitting trailing optional parameters in overrides.

```typescript
protected async subscribeListener<K extends keyof JobEvents & string>(
   event: K,
   listener: (payload: JobEvents[K]) => void,
): Promise<() => Promise<void>> {
```

Also remove the unused `PublisherSubscribeListenerOptions` import.

**Step 2: Move raw team query to repository**

In `apps/server/src/workflows/backfill-keywords.workflow.ts`, `fetchTeamsWithPendingStep` calls `db.query.team.findMany()` directly. Move this to `core/database/src/repositories/categories-repository.ts`.

Add to `categories-repository.ts`:

```typescript
export async function listTeamMetadataByIds(
   db: DatabaseInstance,
   teamIds: string[],
) {
   try {
      if (teamIds.length === 0) return [];
      return await db.query.team.findMany({
         where: (fields, { inArray }) => inArray(fields.id, teamIds),
         columns: { id: true, organizationId: true },
      });
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to list team metadata");
   }
}
```

You'll need to add `import { team } from "@core/database/schemas/auth"` if not already present in the repo file. Check existing imports first — `team` may already be imported via the auth schema.

Then update `fetchTeamsWithPendingStep` in the workflow:

```typescript
import { listTeamsWithPendingKeywords, listCategoriesWithNullKeywords, listTeamMetadataByIds } from "@core/database/repositories/categories-repository";

@DBOS.step()
static async fetchTeamsWithPendingStep() {
   const rows = await listTeamsWithPendingKeywords(db);
   const teamIds = [...new Set(rows.map((r) => r.teamId))];
   const teamRows = await listTeamMetadataByIds(db, teamIds);
   return teamRows.map((t) => ({
      teamId: t.id,
      organizationId: t.organizationId,
   }));
}
```

**Step 3: Add logging to silent enqueueKeywordDerivation**

In `apps/web/src/integrations/orpc/router/categories.ts`, the `enqueueKeywordDerivation` function silently discards errors. This function will be replaced entirely in Task 3, but for now add minimal logging so failures are visible while Task 3 is not yet applied:

```typescript
import { getLogger } from "@core/logging/root";

const logger = getLogger().child({ module: "categories.enqueue" });

function enqueueKeywordDerivation(input: { categoryId: string; teamId: string; organizationId: string; userId: string; name: string; description?: string | null }): void {
   void ResultAsync.fromPromise(
      fetch(`${env.SERVER_URL}/internal/jobs/derive-keywords`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(input),
      }),
      (e) => AppError.internal(`Failed to enqueue keyword derivation: ${String(e)}`),
   ).mapErr((err) => {
      logger.error({ err, categoryId: input.categoryId }, "Failed to enqueue keyword derivation");
   });
}
```

**Step 4: Commit**

```bash
git add packages/notifications/src/publisher.ts \
        core/database/src/repositories/categories-repository.ts \
        apps/server/src/workflows/backfill-keywords.workflow.ts \
        apps/web/src/integrations/orpc/router/categories.ts
git commit -m "fix: resolve code review comments — remove _options param, move team query to repo, log enqueue errors"
```

---

### Task 3: Move DBOS + keyword workflows into apps/web

Move the two DBOS workflow files from `apps/server` into `apps/web`, initialize DBOS in `apps/web/src/server.ts`, and update the categories router to call `DBOS.startWorkflow` directly instead of fetching `apps/server`.

**Files:**
- Modify: `apps/web/package.json` (add DBOS + TanStack AI deps)
- Create: `apps/web/src/features/ai/derive-keywords.workflow.ts` (moved from apps/server)
- Create: `apps/web/src/features/ai/backfill-keywords.workflow.ts` (moved from apps/server)
- Create: `apps/web/src/features/ai/publisher.ts` (moved from apps/server/src/publisher.ts)
- Modify: `apps/web/src/server.ts` (add DBOS init/shutdown)
- Modify: `apps/web/src/integrations/orpc/router/categories.ts` (call DBOS.startWorkflow directly)

**Step 1: Add DBOS and TanStack AI deps to apps/web/package.json**

Add to `dependencies` in `apps/web/package.json`:

```json
"@dbos-inc/dbos-sdk": "catalog:workers",
"@tanstack/ai": "catalog:tanstack-ai",
"@tanstack/ai-openrouter": "catalog:tanstack-ai"
```

**Step 2: Create the publisher in apps/web**

Create `apps/web/src/features/ai/publisher.ts`:

```typescript
import { createJobPublisher } from "@packages/notifications/publisher";
import { redis } from "@/integrations/singletons";

export const jobPublisher = createJobPublisher(redis);
```

Note: `apps/web/src/integrations/orpc/publisher.ts` already exists and does the same thing. Use that existing one — do NOT create a new one. Skip this step. The workflows will import from `@/integrations/orpc/publisher`.

**Step 3: Move DeriveKeywordsWorkflow**

Copy `apps/server/src/workflows/derive-keywords.workflow.ts` to `apps/web/src/features/ai/derive-keywords.workflow.ts`.

Update imports:
- `../publisher` → `@/integrations/orpc/publisher`
- `../singletons` → `@/integrations/singletons`
- All `@core/*`, `@packages/*` imports stay the same

The `DeriveKeywordsInput` type, `MODEL` constant, `keywordsOutputSchema`, and full workflow class stay identical. No logic changes.

**Step 4: Move BackfillKeywordsWorkflow**

Copy `apps/server/src/workflows/backfill-keywords.workflow.ts` to `apps/web/src/features/ai/backfill-keywords.workflow.ts`.

Update imports:
- `../publisher` → `@/integrations/orpc/publisher`
- `../singletons` → `@/integrations/singletons`
- All `@core/*`, `@packages/*` imports stay the same

No logic changes.

**Step 5: Initialize DBOS in apps/web server entry**

`apps/web/src/server.ts` currently looks like:

```typescript
import "@/integrations/otel/init";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

export default createServerEntry({
   fetch(request) { ... return handler.fetch(request); },
});
```

Update it to initialize DBOS on startup and shut it down on process exit:

```typescript
import "@/integrations/otel/init";
import "@/features/ai/backfill-keywords.workflow";
import { DBOS } from "@dbos-inc/dbos-sdk";
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { getLogger } from "@core/logging/root";
import { env } from "@core/environment/server";

const logger = getLogger().child({ module: "web-server" });

DBOS.setConfig({
   name: "montte-web",
   systemDatabaseUrl: env.DATABASE_URL,
   logLevel: env.LOG_LEVEL,
});

// DBOS must be launched before the server starts handling requests.
// createServerEntry is synchronous, so we launch DBOS eagerly here.
// This is a top-level side effect that runs once on module load.
DBOS.launch().then(() => {
   logger.info("DBOS runtime started");
}).catch((err) => {
   logger.error({ err }, "DBOS launch failed");
});

const shutdown = async () => {
   await DBOS.shutdown();
};
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

export default createServerEntry({
   fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/api/ping") {
         if (request.method === "HEAD") return new Response(null, { status: 200, headers: { "Content-Type": "application/json" } });
         if (request.method === "GET") return Response.json({ pong: true, time: new Date().toISOString() });
      }
      return handler.fetch(request);
   },
});
```

The `import "@/features/ai/backfill-keywords.workflow"` side-effect import is required so DBOS can discover and register the `@DBOS.scheduled` cron workflow. The `DeriveKeywordsWorkflow` is triggered on-demand so it doesn't need to be imported here (it will be imported via the categories router).

**Step 6: Update categories router to call DBOS.startWorkflow directly**

In `apps/web/src/integrations/orpc/router/categories.ts`, replace the entire `enqueueKeywordDerivation` function:

Remove these imports (only if not used elsewhere):
```typescript
import { env } from "@core/environment/server";
import { AppError } from "@core/logging/errors";
import { ResultAsync } from "neverthrow";
```

Add:
```typescript
import { DBOS } from "@dbos-inc/dbos-sdk";
import { getLogger } from "@core/logging/root";
import { DeriveKeywordsWorkflow } from "@/features/ai/derive-keywords.workflow";

const logger = getLogger().child({ module: "categories.router" });
```

Replace `enqueueKeywordDerivation`:

```typescript
function enqueueKeywordDerivation(input: {
   categoryId: string;
   teamId: string;
   organizationId: string;
   userId: string;
   name: string;
   description?: string | null;
   stripeCustomerId?: string | null;
}): void {
   void DBOS.startWorkflow(DeriveKeywordsWorkflow).run(input).catch((err) => {
      logger.error({ err, categoryId: input.categoryId }, "Failed to start derive-keywords workflow");
   });
}
```

The `create` and `update` handlers already call `enqueueKeywordDerivation` — no changes needed there. Check `apps/web/src/integrations/orpc/server.ts` for whether `stripeCustomerId` is in the protected procedure context. If it is, pass `context.stripeCustomerId`. If not, pass `null`.

**Step 7: Typecheck**

```bash
bun run typecheck
```

Fix any import errors. Common issues:
- If `LOG_LEVEL` isn't in the web app's env schema, add it as `z.string().optional().default("info")`
- If DBOS type definitions conflict, ensure `@dbos-inc/dbos-sdk` is resolved from workspace root

**Step 8: Smoke test locally**

```bash
bun dev
```

Create a category and verify in the web app logs:
- `DBOS runtime started`
- `[derive-keywords] category=... started`
- `[derive-keywords] category=... completed`
- Toast notification appears in the UI

**Step 9: Commit**

```bash
git add apps/web/package.json \
        apps/web/src/server.ts \
        apps/web/src/features/ai/ \
        apps/web/src/integrations/orpc/router/categories.ts
git commit -m "feat: move DBOS keyword workflows into apps/web, call DBOS.startWorkflow from categories router"
```

---

### Task 4: Port SDK server to apps/web

Move the SDK oRPC handler, auth middleware, and billable procedure into `apps/web`.

**Files:**
- Create: `apps/web/src/integrations/orpc/sdk/server.ts`
- Create: `apps/web/src/integrations/orpc/sdk/billable.ts`
- Create: `apps/web/src/integrations/orpc/sdk/utils/sdk-auth.ts`
- Create: `apps/web/src/integrations/orpc/sdk/router/index.ts`
- Copy (then adapt): all files from `apps/server/src/orpc/router/` → `apps/web/src/integrations/orpc/sdk/router/`
- Create: `apps/web/src/routes/api/sdk/$.ts`

**Step 1: Copy sdk-auth utility**

Copy `apps/server/src/utils/sdk-auth.ts` to `apps/web/src/integrations/orpc/sdk/utils/sdk-auth.ts`.

Update imports: replace `../singletons` with the web app's auth singleton:

```typescript
import { auth } from "@/integrations/singletons";
```

No other changes needed — the logic is pure and has no server-specific deps.

**Step 2: Create sdk/server.ts**

Copy `apps/server/src/orpc/server.ts` to `apps/web/src/integrations/orpc/sdk/server.ts`.

Update imports:
- Replace `../singletons` → `@/integrations/singletons`  
- Replace `../utils/sdk-auth` → `./utils/sdk-auth`
- Replace `@core/logging/errors` → stays the same (it's a `@core/` import, valid in web app)

The `BaseContext` needs `db` — in the web app, `db` is the same Drizzle instance. Keep as-is but import from `@/integrations/singletons`:

```typescript
import { db } from "@/integrations/singletons";
```

Wait — `BaseContext` defines `db: typeof db`. The `db` in the web app singletons is `DatabaseInstance`. Keep the type as `DatabaseInstance` from `@core/database/client` to avoid coupling to the singleton.

Final `sdk/server.ts`:

```typescript
import { os } from "@orpc/server";
import type { DatabaseInstance } from "@core/database/client";
import type { PostHog } from "@core/posthog/server";
import { WebAppError } from "@core/logging/errors";
import { authenticateRequest } from "./utils/sdk-auth";
import type { AuthError } from "./utils/sdk-auth";

interface BaseContext {
   db: DatabaseInstance;
   posthog: PostHog;
   request: Request;
}

interface SdkContext extends BaseContext {
   organizationId: string;
   teamId?: string;
   plan: string;
   sdkMode: "static" | "ssr";
   remaining: number | null;
   userId?: string;
   apiKeyType: "public" | "private";
}

function authErrorToOrpc(error: AuthError) {
   switch (error.code) {
      case "MISSING_KEY":
         return new WebAppError("UNAUTHORIZED", { message: "Missing API Key", source: "sdk" });
      case "RATE_LIMITED":
         return new WebAppError("TOO_MANY_REQUESTS", { message: "Rate limit exceeded", source: "sdk" });
      case "INVALID_KEY":
         return new WebAppError("UNAUTHORIZED", { message: "Invalid API Key", source: "sdk" });
      case "NO_ORGANIZATION":
         return new WebAppError("FORBIDDEN", { message: "API key has no associated organization", source: "sdk" });
   }
}

const baseProcedure = os.$context<BaseContext>();

export const sdkProcedure = baseProcedure.use(async ({ context, next }) => {
   const authResult = await authenticateRequest(context.request);
   if (authResult.isErr()) throw authErrorToOrpc(authResult.error);
   const { organizationId, teamId, userId, plan, sdkMode, remaining, apiKeyType } = authResult.value;
   return next({ context: { ...context, organizationId, teamId, plan, sdkMode, remaining, userId, apiKeyType } });
});

export const router = os.router;
export type { SdkContext };
```

**Step 3: Create sdk/billable.ts**

Copy `apps/server/src/orpc/billable.ts` to `apps/web/src/integrations/orpc/sdk/billable.ts`.

Update imports:
- Replace `../singletons` → `@/integrations/singletons` (for `redis`, `posthog`, `stripeClient`)
- Replace `./server` → `./server` (stays same)

No logic changes.

**Step 4: Copy SDK router files**

Copy the entire `apps/server/src/orpc/router/` directory to `apps/web/src/integrations/orpc/sdk/router/`.

For each file, update imports:
- `../server` → `../server` (stays same relative)
- `../billable` → `../billable` (stays same relative)
- `@core/*` imports stay the same
- Any `../singletons` → `@/integrations/singletons`

Review each router file for any remaining `apps/server`-specific imports. Run typecheck to catch them.

**Step 5: Create the TanStack Start route `/api/sdk/$`**

Create `apps/web/src/routes/api/sdk/$.ts`:

```typescript
import "@/polyfill";

import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { FetchLoggingPlugin } from "@core/logging/orpc-plugin";
import { createFileRoute } from "@tanstack/react-router";
import pino from "pino";
import { db, posthog } from "@/integrations/singletons";
import sdkRouter from "@/integrations/orpc/sdk/router";

const logger = pino({ name: "montte-web-sdk" });

const handler = new RPCHandler(sdkRouter, {
   plugins: [
      new BatchHandlerPlugin(),
      new FetchLoggingPlugin({
         logger,
         generateId: () => crypto.randomUUID(),
         logRequestResponse: true,
         logRequestAbort: true,
      }),
   ],
});

async function handle({ request }: { request: Request }) {
   const { response } = await handler.handle(request, {
      prefix: "/api/sdk",
      context: { db, posthog, request },
   });
   return response ?? new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/api/sdk/$")({
   server: {
      handlers: {
         HEAD: handle,
         GET: handle,
         POST: handle,
         PUT: handle,
         PATCH: handle,
         DELETE: handle,
      },
   },
});
```

**Step 6: Add missing deps to apps/web if needed**

Check `apps/server/package.json` for deps used by the SDK router files. The likely new deps are:
- `@montte/hyprpay` — check if already in `apps/web/package.json`
- `@core/stripe` — likely already there
- `neverthrow` — likely already there

Add any missing ones to `apps/web/package.json` using `workspace:*` or catalog references.

**Step 7: Remove SERVER_URL from env**

Once `apps/server` is gone, `SERVER_URL` is no longer needed. Remove it from `core/environment/src/server.ts`:

```typescript
// Remove this line:
SERVER_URL: z.string().url(),
```

And remove from any `.env.*` files.

**Step 8: Typecheck**

```bash
bun run typecheck
```

Fix any import errors until clean.

**Step 9: Commit**

```bash
git add apps/web/src/integrations/orpc/sdk/ \
        apps/web/src/routes/api/sdk/ \
        apps/web/package.json \
        core/environment/src/server.ts
git commit -m "feat: port SDK oRPC API from apps/server into apps/web at /api/sdk"
```

---

### Task 5: Remove apps/server

**Files:**
- Delete: `apps/server/` (entire directory)
- Modify: root `package.json` (workspace packages list if needed)
- Modify: `nx.json` if it references `server`

**Step 1: Verify nothing imports from apps/server**

```bash
grep -r "from.*apps/server\|require.*apps/server" apps/web/src core/ packages/ --include="*.ts" --include="*.tsx"
```

Expected: no results.

**Step 2: Check nx.json for server references**

```bash
grep -r "server" nx.json
```

Remove any entries that reference the server app.

**Step 3: Delete apps/server**

```bash
rm -rf apps/server
```

**Step 4: Verify workspace still resolves**

```bash
bun install
bun run typecheck
```

Expected: clean.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete apps/server — SDK API moved to apps/web, keyword derivation runs inline"
```

---

### Task 6: Update deploy config / docs

**Files:**
- Modify: any Railway/Docker/CI config that references `server` app
- Modify: `CLAUDE.md` monorepo structure section

**Step 1: Find deploy references**

```bash
grep -r "server" .github/ railway.toml railway.json Dockerfile* docker-compose* 2>/dev/null
```

Remove or update any entries that reference the `server` app or `SERVER_URL`.

**Step 2: Update CLAUDE.md**

In `CLAUDE.md`, update the monorepo structure section: remove `apps/server` entry and add a note that the SDK API lives at `apps/web/src/routes/api/sdk/` and `apps/web/src/integrations/orpc/sdk/`.

**Step 3: Final typecheck + build check**

```bash
bun run typecheck && bun run build
```

Expected: clean build.

**Step 4: Commit**

```bash
git add .github/ CLAUDE.md
git commit -m "chore: remove server app from deploy config and update docs"
```
