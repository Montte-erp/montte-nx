# SDK Error Tracing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all raw `ORPCError` usage in `apps/server` with `WebAppError` tagged with `source` (e.g. `"sdk"`, `"hyprpay"`, `"billing"`) visible in OpenTelemetry, and add an Elysia-level error handler that converts escaped `AppError` / `WebAppError` to proper HTTP responses.

**Architecture:** Extend `WebAppError` constructor to accept an optional `source` string emitted as `"error.source"` in otel. Call sites pass `source` inline — no factory file needed. Wire an Elysia `onError` hook as a safety net for errors that escape the oRPC handler.

**Tech Stack:** `@core/logging/errors` (`WebAppError`, `AppError`), `@opentelemetry/api-logs`, Elysia `onError`.

---

### Task 1: Add `source` to `WebAppError` in core/logging

**Files:**
- Modify: `core/logging/src/errors.ts:105-121`

**Context:** `WebAppError` constructor emits to otel with `"error.type": "WebAppError"`. We need `"error.source"` when provided so PostHog/otel dashboards can filter by origin layer.

**Step 1: Update the constructor signature and otel emit**

Change the constructor to accept `source` in options and spread it into otel attributes:

```typescript
constructor(
   code: TCode,
   options?: ORPCErrorOptions<TData> & { source?: string },
) {
   super(code, options as ORPCErrorOptions<TData>);

   otelLogger.emit({
      severityText: SERVER_ERROR_CODES.has(code) ? "error" : "warn",
      body: options?.message ?? code,
      attributes: {
         "error.type": "WebAppError",
         "error.code": code,
         "error.stack": this.stack ?? "",
         ...(options?.source ? { "error.source": options.source } : {}),
      },
   });
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "core/logging" | head -20
```

Expected: no errors.

**Step 3: Rebuild logging package**

```bash
cd /home/yorizel/Documents/montte-nx/core/logging && bun run build
```

**Step 4: Commit**

```bash
git add core/logging/src/errors.ts
git commit -m "feat(logging): add optional source tag to WebAppError otel emission"
```

---

### Task 2: Replace `ORPCError` in `apps/server/src/orpc/server.ts`

**Files:**
- Modify: `apps/server/src/orpc/server.ts`

**Context:** `authErrorToOrpc` returns raw `ORPCError` with no otel emission. Replace with `WebAppError` passing `source: "sdk"`. Remove the `ORPCError` import — `os` is a separate named export.

**Step 1: Update imports**

```typescript
// Remove: import { ORPCError, os } from "@orpc/server";
import { os } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
```

**Step 2: Replace `authErrorToOrpc` body**

```typescript
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
```

**Step 3: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "orpc/server" | head -20
```

**Step 4: Commit**

```bash
git add apps/server/src/orpc/server.ts
git commit -m "refactor(server): replace ORPCError with WebAppError in auth middleware"
```

---

### Task 3: Replace `ORPCError` in `apps/server/src/orpc/router/hyprpay.ts`

**Files:**
- Modify: `apps/server/src/orpc/router/hyprpay.ts`

**Context:** `requireTeamId` and individual handlers use raw `ORPCError`. The `Result` return type of `requireTeamId` must change to `Result<string, WebAppError<"FORBIDDEN">>`.

**Step 1: Update imports**

```typescript
// Remove: import { ORPCError, implementerInternal } from "@orpc/server";
import { implementerInternal } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
```

**Step 2: Update `requireTeamId`**

```typescript
function requireTeamId(
   teamId: SdkContext["teamId"],
): Result<string, WebAppError<"FORBIDDEN">> {
   if (!teamId) {
      return err(
         new WebAppError("FORBIDDEN", {
            message: "Esta operação requer uma chave de API vinculada a um projeto.",
            source: "hyprpay",
         }),
      );
   }
   return ok(teamId);
}
```

**Step 3: Replace throws in handlers**

- `get` handler: `throw new WebAppError("NOT_FOUND", { message: "Cliente não encontrado.", source: "hyprpay" })`
- `update` handler: same

**Step 4: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "hyprpay" | head -20
```

**Step 5: Commit**

```bash
git add apps/server/src/orpc/router/hyprpay.ts
git commit -m "refactor(server): replace ORPCError with WebAppError in HyprPay handlers"
```

---

### Task 4: Replace `ORPCError` in `apps/server/src/orpc/billable.ts`

**Files:**
- Modify: `apps/server/src/orpc/billable.ts`

**Context:** The credit enforcement catch block throws a raw `ORPCError("FORBIDDEN")`.

**Step 1: Update imports**

```typescript
// Remove: import { ORPCError } from "@orpc/server";
import { WebAppError } from "@core/logging/errors";
```

**Step 2: Replace the throw**

```typescript
   } catch {
      throw new WebAppError("FORBIDDEN", {
         message: "Free tier limit exceeded. Enable pay-as-you-go to continue.",
         source: "billing",
      });
   }
```

**Step 3: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "billable" | head -20
```

**Step 4: Commit**

```bash
git add apps/server/src/orpc/billable.ts
git commit -m "refactor(server): replace ORPCError with WebAppError in billable procedure"
```

---

### Task 5: Add Elysia `onError` handler in `apps/server/src/index.ts`

**Files:**
- Modify: `apps/server/src/index.ts`

**Context:** No Elysia-level error handler exists. The oRPC handler already serializes oRPC errors internally — `.onError()` is a safety net for errors that escape to the Elysia layer (non-oRPC routes, uncaught middleware throws). `AppError` has a `.status` field; `WebAppError` extends `ORPCError` which also has `.status`.

**Step 1: Add import**

```typescript
import { AppError, WebAppError } from "@core/logging/errors";
```

**Step 2: Add `.onError()` after `.get("/health", ...)` and before `.listen(...)`**

```typescript
      .onError(({ error, set }) => {
         if (error instanceof WebAppError) {
            set.status = error.status;
            return { code: error.code, message: error.message };
         }
         if (error instanceof AppError) {
            set.status = error.status;
            return { code: "APP_ERROR", message: error.message };
         }
         logger.error({ err: error }, "Unhandled server error");
         set.status = 500;
         return { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" };
      })
```

**Step 3: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "apps/server" | head -20
```

**Step 4: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(server): add Elysia onError handler for AppError and WebAppError"
```

---

### Task 6: Final verification

**Step 1: Full typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -40
```

**Step 2: Confirm no raw `ORPCError` remains in apps/server**

```bash
grep -rn "new ORPCError" /home/yorizel/Documents/montte-nx/apps/server/src/ --include="*.ts"
```

Expected: no output.
