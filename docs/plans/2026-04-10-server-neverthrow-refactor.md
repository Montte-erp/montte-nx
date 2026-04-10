# Server Neverthrow Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace manual union types and bare try-catch blocks in `apps/server` with `neverthrow` Result types for explicit, composable error handling.

**Architecture:** Install `neverthrow` in `apps/server`, then refactor in layers: utility helpers first (`sdk-auth.ts`), then the oRPC middleware that consumes them (`orpc/server.ts`), then workflow files that use bare try-catch, and finally the `requireTeamId` helper in `hyprpay.ts`. oRPC handlers still throw `ORPCError` at the boundary — neverthrow is used *inside* helpers and workflows where errors are collected or composed before that boundary.

**Tech Stack:** `neverthrow` (Result/ResultAsync/fromPromise/err/ok), TypeScript, oRPC, DBOS workflows, Elysia.

---

### Task 1: Add neverthrow dependency

**Files:**
- Modify: `apps/server/package.json`

**Step 1: Add neverthrow to dependencies**

In `apps/server/package.json`, add to the `"dependencies"` object:
```json
"neverthrow": "*"
```

**Step 2: Install**

```bash
cd /home/yorizel/Documents/montte-nx && bun install
```
Expected: lock file updated, no errors.

**Step 3: Verify import resolves**

```bash
cd /home/yorizel/Documents/montte-nx/apps/server && bun run typecheck
```
Expected: clean (no new errors).

**Step 4: Commit**

```bash
git add apps/server/package.json bun.lock
git commit -m "chore(server): add neverthrow dependency"
```

---

### Task 2: Refactor `sdk-auth.ts` — replace manual unions with Result types

**Files:**
- Modify: `apps/server/src/utils/sdk-auth.ts`

**Context:** `authenticateRequest` currently returns `{ success: true, organizationId, teamId, userId } | { success: false, error: string }`. `checkDomainAllowed` returns `{ allowed: boolean, reason? }`. Both are natural `Result` migrations.

**Step 1: Rewrite the file**

Replace `apps/server/src/utils/sdk-auth.ts` with:

```typescript
import type { DatabaseInstance } from "@core/database/client";
import { team } from "@core/database/schemas/auth";
import { getLogger } from "@core/logging/root";
import { eq } from "drizzle-orm";
import { ResultAsync, err, fromPromise, ok } from "neverthrow";
import { auth } from "../singletons";

const logger = getLogger().child({ module: "sdk-auth" });

export interface AuthData {
   organizationId: string;
   teamId: string | undefined;
   userId: string | undefined;
}

export type AuthError =
   | { code: "MISSING_KEY" }
   | { code: "RATE_LIMITED" }
   | { code: "INVALID_KEY" }
   | { code: "NO_ORGANIZATION" };

/**
 * Resolves an API key from the request, checking multiple sources:
 * 1. `X-API-Key` header (preferred by SDK clients)
 * 2. `sdk-api-key` header (legacy SDK clients)
 * 3. `apiKey` query parameter (sendBeacon fallback)
 */
export function resolveApiKey(request: Request): string | null {
   const xApiKey = request.headers.get("X-API-Key");
   if (xApiKey) return xApiKey;

   const sdkApiKey = request.headers.get("sdk-api-key");
   if (sdkApiKey) return sdkApiKey;

   const url = new URL(request.url);
   const queryApiKey = url.searchParams.get("apiKey");
   if (queryApiKey) return queryApiKey;

   return null;
}

/**
 * Authenticates the request using the API key.
 * Returns Ok<AuthData> on success or Err<AuthError> on failure.
 */
export function authenticateRequest(
   request: Request,
): ResultAsync<AuthData, AuthError> {
   const endpoint = new URL(request.url).pathname;
   const apiKeyValue = resolveApiKey(request);

   if (!apiKeyValue) {
      logger.error({ reason: "missing_api_key", endpoint }, "SDK auth failed");
      return ResultAsync.fromSafePromise(Promise.resolve(err({ code: "MISSING_KEY" as const })));
   }

   return fromPromise(
      auth.api.verifyApiKey({ body: { key: apiKeyValue } }),
      () => ({ code: "INVALID_KEY" as const }),
   ).andThen((result) => {
      if (!result.valid || !result.key) {
         const isRateLimited = result.error?.code === "RATE_LIMITED";
         const code = isRateLimited ? "RATE_LIMITED" : "INVALID_KEY";
         logger.error(
            {
               reason: code.toLowerCase(),
               endpoint,
               organizationId: result.key?.metadata?.organizationId,
               plan: result.key?.metadata?.plan,
               remaining: result.key?.remaining,
            },
            "SDK auth failed",
         );
         return err({ code } as AuthError);
      }

      const { organizationId, teamId } = result.key.metadata ?? {};

      if (!organizationId || typeof organizationId !== "string") {
         return err({ code: "NO_ORGANIZATION" as const });
      }

      return ok({
         organizationId,
         teamId: typeof teamId === "string" ? teamId : undefined,
         userId: result.key.referenceId ?? undefined,
      });
   });
}

/**
 * Checks whether the given origin hostname matches any of the allowed domain patterns.
 * Supports exact matches and wildcard subdomains (e.g. `*.example.com`).
 */
function matchesDomain(origin: string, patterns: string[]): boolean {
   try {
      const hostname = new URL(origin).hostname;
      return patterns.some((pattern) => {
         if (pattern.startsWith("*.")) {
            const suffix = pattern.slice(2);
            return hostname === suffix || hostname.endsWith(`.${suffix}`);
         }
         return hostname === pattern;
      });
   } catch {
      return false;
   }
}

/**
 * Soft domain filtering for SDK requests.
 * Returns Ok(undefined) when allowed, Err("Origin not allowed") when blocked.
 */
export function checkDomainAllowed(
   request: Request,
   teamId: string | undefined,
   db: DatabaseInstance,
): ResultAsync<void, string> {
   if (!teamId) {
      return ResultAsync.fromSafePromise(Promise.resolve(ok(undefined)));
   }

   return fromPromise(
      db
         .select({ allowedDomains: team.allowedDomains })
         .from(team)
         .where(eq(team.id, teamId))
         .then((rows) => rows[0]),
      () => "Domain check failed",
   ).andThen((row) => {
      if (!row?.allowedDomains || row.allowedDomains.length === 0) {
         return ok(undefined);
      }

      const origin =
         request.headers.get("Origin") ?? request.headers.get("Referer");

      if (!origin) {
         return ok(undefined);
      }

      if (matchesDomain(origin, row.allowedDomains)) {
         return ok(undefined);
      }

      return err("Origin not allowed");
   });
}
```

**Step 2: Verify typecheck**

```bash
cd /home/yorizel/Documents/montte-nx/apps/server && bun run typecheck
```
Expected: errors only in `orpc/server.ts` (caller not yet updated) — or clean if TypeScript is happy with the existing callers.

---

### Task 3: Update `orpc/server.ts` middleware to use Result types

**Files:**
- Modify: `apps/server/src/orpc/server.ts`

**Context:** The middleware calls `checkDomainAllowed` which now returns `ResultAsync<void, string>` instead of `Promise<{ allowed: boolean }>`. We need to `.match()` or `._unsafeUnwrap` / map-to-throw pattern. The cleanest approach is to await the Result and convert errors to `ORPCError` throws at the oRPC boundary.

**Step 1: Rewrite `orpc/server.ts`**

```typescript
import { ORPCError, os } from "@orpc/server";
import type { PostHog } from "@core/posthog/server";
import { auth, db } from "../singletons";
import { authenticateRequest, checkDomainAllowed } from "../utils/sdk-auth";
import type { AuthError } from "../utils/sdk-auth";

interface BaseContext {
   db: typeof db;
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

function authErrorToOrpc(error: AuthError): ORPCError {
   switch (error.code) {
      case "MISSING_KEY":
         return new ORPCError("UNAUTHORIZED", { message: "Missing API Key" });
      case "RATE_LIMITED":
         return new ORPCError("TOO_MANY_REQUESTS", { message: "Rate limit exceeded" });
      case "INVALID_KEY":
         return new ORPCError("UNAUTHORIZED", { message: "Invalid API Key" });
      case "NO_ORGANIZATION":
         return new ORPCError("FORBIDDEN", { message: "API key has no associated organization" });
   }
}

const baseProcedure = os.$context<BaseContext>();

export const sdkProcedure = baseProcedure.use(async ({ context, next }) => {
   const { request } = context;

   const authResult = await authenticateRequest(request);
   if (authResult.isErr()) {
      throw authErrorToOrpc(authResult.error);
   }

   const { organizationId, teamId } = authResult.value;

   const domainResult = await checkDomainAllowed(request, teamId, db);
   if (domainResult.isErr()) {
      throw new ORPCError("FORBIDDEN", { message: "Origin not allowed" });
   }

   const apiKeyHeader =
      request.headers.get("X-API-Key") ??
      request.headers.get("sdk-api-key") ??
      request.headers.get("apiKey");

   const verifyResult = await auth.api.verifyApiKey({
      body: { key: apiKeyHeader! },
   });

   const { plan, sdkMode, apiKeyType } = verifyResult.key?.metadata ?? {};

   return next({
      context: {
         ...context,
         organizationId,
         teamId,
         plan: (plan as string) ?? "metered",
         sdkMode: (sdkMode as "static" | "ssr") ?? "static",
         remaining: verifyResult.key?.remaining ?? null,
         userId: verifyResult.key?.referenceId ?? undefined,
         apiKeyType: (apiKeyType as "public" | "private") ?? "private",
      },
   });
});

export const router = os.router;
export type { SdkContext };
```

**Note:** The above calls `verifyApiKey` twice — once inside `authenticateRequest` and once here for `remaining`/`plan` metadata. To avoid the double call, we need to expose `remaining` from `AuthData`. Update `AuthData` in `sdk-auth.ts` to include `plan`, `sdkMode`, `remaining`, `apiKeyType` so the middleware only calls once.

**Step 2: Update `AuthData` in `sdk-auth.ts` to include all metadata needed by middleware**

In `sdk-auth.ts`, update `AuthData`:

```typescript
export interface AuthData {
   organizationId: string;
   teamId: string | undefined;
   userId: string | undefined;
   plan: string;
   sdkMode: "static" | "ssr";
   remaining: number | null;
   apiKeyType: "public" | "private";
}
```

And update the `ok(...)` return inside `authenticateRequest`:

```typescript
return ok({
   organizationId,
   teamId: typeof teamId === "string" ? teamId : undefined,
   userId: result.key.referenceId ?? undefined,
   plan: (result.key.metadata?.plan as string) ?? "metered",
   sdkMode: (result.key.metadata?.sdkMode as "static" | "ssr") ?? "static",
   remaining: result.key.remaining ?? null,
   apiKeyType: (result.key.metadata?.apiKeyType as "public" | "private") ?? "private",
});
```

**Step 3: Simplify `orpc/server.ts` to use all metadata from `AuthData` (no second verifyApiKey call)**

```typescript
import { ORPCError, os } from "@orpc/server";
import type { PostHog } from "@core/posthog/server";
import { db } from "../singletons";
import { authenticateRequest, checkDomainAllowed } from "../utils/sdk-auth";
import type { AuthError } from "../utils/sdk-auth";

interface BaseContext {
   db: typeof db;
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

function authErrorToOrpc(error: AuthError): ORPCError {
   switch (error.code) {
      case "MISSING_KEY":
         return new ORPCError("UNAUTHORIZED", { message: "Missing API Key" });
      case "RATE_LIMITED":
         return new ORPCError("TOO_MANY_REQUESTS", { message: "Rate limit exceeded" });
      case "INVALID_KEY":
         return new ORPCError("UNAUTHORIZED", { message: "Invalid API Key" });
      case "NO_ORGANIZATION":
         return new ORPCError("FORBIDDEN", { message: "API key has no associated organization" });
   }
}

const baseProcedure = os.$context<BaseContext>();

export const sdkProcedure = baseProcedure.use(async ({ context, next }) => {
   const { request } = context;

   const authResult = await authenticateRequest(request);
   if (authResult.isErr()) {
      throw authErrorToOrpc(authResult.error);
   }

   const { organizationId, teamId, userId, plan, sdkMode, remaining, apiKeyType } = authResult.value;

   const domainResult = await checkDomainAllowed(request, teamId, db);
   if (domainResult.isErr()) {
      throw new ORPCError("FORBIDDEN", { message: "Origin not allowed" });
   }

   return next({
      context: {
         ...context,
         organizationId,
         teamId,
         plan,
         sdkMode,
         remaining,
         userId,
         apiKeyType,
      },
   });
});

export const router = os.router;
export type { SdkContext };
```

**Step 4: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx/apps/server && bun run typecheck
```
Expected: clean.

**Step 5: Commit**

```bash
git add apps/server/src/utils/sdk-auth.ts apps/server/src/orpc/server.ts
git commit -m "refactor(server): migrate sdk-auth and middleware to neverthrow Result types"
```

---

### Task 4: Refactor `hyprpay.ts` — `requireTeamId` as Result helper

**Files:**
- Modify: `apps/server/src/orpc/router/hyprpay.ts`

**Context:** `requireTeamId` currently throws `ORPCError` directly. Refactor it to return `Result<string, ORPCError>` and handle at call sites.

**Step 1: Update `requireTeamId` and its callers**

Replace the `requireTeamId` function and its four usages:

```typescript
import { ORPCError, implementerInternal } from "@orpc/server";
import { and, asc, count, eq } from "drizzle-orm";
import { Result, err, ok } from "neverthrow";
import { updateContact } from "@core/database/repositories/contacts-repository";
import { contacts } from "@core/database/schemas/contacts";
import type { Contact } from "@core/database/schemas/contacts";
import { hyprpayContract } from "@montte/hyprpay/contract";
import { sdkProcedure } from "../server";
import type { SdkContext } from "../server";

const impl = implementerInternal(
   hyprpayContract,
   sdkProcedure["~orpc"].config,
   [...sdkProcedure["~orpc"].middlewares],
);

function requireTeamId(teamId: SdkContext["teamId"]): Result<string, ORPCError> {
   if (!teamId) {
      return err(
         new ORPCError("FORBIDDEN", {
            message:
               "Esta operação requer uma chave de API vinculada a um projeto.",
         }),
      );
   }
   return ok(teamId);
}
```

Then at each call site, replace `const teamId = requireTeamId(context.teamId);` with:

```typescript
const teamIdResult = requireTeamId(context.teamId);
if (teamIdResult.isErr()) throw teamIdResult.error;
const teamId = teamIdResult.value;
```

Apply this pattern to all four handlers: `create`, `get`, `list`, `update`.

**Step 2: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx/apps/server && bun run typecheck
```
Expected: clean.

**Step 3: Commit**

```bash
git add apps/server/src/orpc/router/hyprpay.ts
git commit -m "refactor(server): requireTeamId returns Result in hyprpay router"
```

---

### Task 5: Refactor `refresh-insights.ts` workflow — replace try-catch with fromPromise

**Files:**
- Modify: `apps/server/src/workflows/refresh-insights.ts`

**Context:** The loop uses try-catch to track successCount/failureCount per insight. Replace with `fromPromise`.

**Step 1: Rewrite `refreshAll`**

```typescript
import { DBOS } from "@dbos-inc/dbos-sdk";
import { fromPromise } from "neverthrow";
import { computeInsightData } from "@packages/analytics/compute-insight";
import { insights } from "@core/database/schemas/insights";
import { getLogger } from "@core/logging/root";
import { eq } from "drizzle-orm";
import { db } from "../singletons";

const logger = getLogger().child({ module: "workflow:insights" });

export class RefreshInsightsWorkflow {
   @DBOS.step()
   static async refreshAll(): Promise<void> {
      const startTime = Date.now();
      const allInsights = await db.select().from(insights);
      logger.info({ count: allInsights.length }, "Refreshing insights");

      const results = await Promise.all(
         allInsights.map((insight) =>
            fromPromise(
               computeInsightData(db, insight).then((freshData) =>
                  db
                     .update(insights)
                     .set({ cachedResults: freshData, lastComputedAt: new Date() })
                     .where(eq(insights.id, insight.id)),
               ),
               (error) => ({ insightId: insight.id, error }),
            ),
         ),
      );

      const successCount = results.filter((r) => r.isOk()).length;
      const failureCount = results.filter((r) => r.isErr()).length;

      for (const result of results) {
         if (result.isErr()) {
            logger.error(
               { err: result.error.error, insightId: result.error.insightId },
               "Failed to refresh insight",
            );
         }
      }

      logger.info(
         { durationMs: Date.now() - startTime, successCount, failureCount },
         "Insight refresh complete",
      );
   }

   @DBOS.scheduled({ crontab: "0 */3 * * *" })
   @DBOS.workflow()
   static async run(_scheduledTime: Date, _startTime: Date): Promise<void> {
      await RefreshInsightsWorkflow.refreshAll();
   }
}
```

**Step 2: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx/apps/server && bun run typecheck
```
Expected: clean.

**Step 3: Commit**

```bash
git add apps/server/src/workflows/refresh-insights.ts
git commit -m "refactor(server): use neverthrow fromPromise in refresh-insights workflow"
```

---

### Task 6: Refactor `budget-alerts.ts` workflow — use fromPromise for email sending

**Files:**
- Modify: `apps/server/src/workflows/budget-alerts.ts`

**Context:** The inner `for (const member of members)` uses `.catch()` to swallow email failures. Replace with `fromPromise` for explicit error tracking.

**Step 1: Update the email loop inside `processAlerts`**

Replace the existing member email loop (lines 65-80):

```typescript
// OLD: implicit error swallow with .catch()
for (const member of members) {
   await sendBudgetAlertEmail(resend, { ... }).catch((err: unknown) => {
      logger.error({ err, email: member.email }, "Failed to send budget alert email");
   });
}
```

With:

```typescript
const emailResults = await Promise.all(
   members.map((member) =>
      fromPromise(
         sendBudgetAlertEmail(resend, {
            email: member.email,
            categoryName,
            spentAmount: fmt(goal.spentAmount),
            limitAmount: fmt(Number(goal.limitAmount)),
            percentUsed: goal.percentUsed,
            alertThreshold: goal.alertThreshold ?? 0,
            month: monthName,
         }),
         (error) => ({ email: member.email, error }),
      ),
   ),
);

for (const result of emailResults) {
   if (result.isErr()) {
      logger.error(
         { err: result.error.error, email: result.error.email },
         "Failed to send budget alert email",
      );
   }
}
```

Also add `fromPromise` import from `neverthrow` at the top of the file.

**Step 2: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx/apps/server && bun run typecheck
```
Expected: clean.

**Step 3: Commit**

```bash
git add apps/server/src/workflows/budget-alerts.ts
git commit -m "refactor(server): use neverthrow fromPromise for email sends in budget-alerts"
```

---

### Task 7: Final typecheck

**Step 1: Full typecheck**

```bash
cd /home/yorizel/Documents/montte-nx/apps/server && bun run typecheck
```
Expected: clean — no output.

**Step 2: Confirm all files touched**

```bash
git log --oneline -6
```
Expected: 5 commits (chore: add dep, refactor: sdk-auth + middleware, refactor: hyprpay, refactor: insights, refactor: budget-alerts).
