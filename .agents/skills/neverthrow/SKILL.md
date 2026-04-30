---
name: neverthrow
description: Type-safe error handling for TS/JS via Result/ResultAsync. Encode failure in the type system instead of throwing. Eliminates try/catch, forces explicit error handling, composes chain-style like a functional monad.
---

## Overview

`neverthrow` represents fallible operations as values of type `Result<T, E>` (sync) or `ResultAsync<T, E>` (async). Throwing is replaced with returning `err(...)`; catching is replaced with `.mapErr(...)`, `.match(...)`, or `.isErr()` checks.

**Package:** `neverthrow`
**Lint plugin:** `eslint-plugin-neverthrow` — forces `.match` / `.unwrapOr` / `._unsafeUnwrap` consumption so results cannot leak unhandled.

**Montte rule (`CLAUDE.md`):** No `try/catch` outside tests and scripts. Use `fromThrowable`, `fromPromise`, `ok`, `err`, `Result`, `ResultAsync`. Repositories under `core/database/src/repositories/` return `ResultAsync<T, AppError>`; routers under `apps/web/src/integrations/orpc/router/` consume them.

## Installation

```bash
bun add neverthrow
bun add -D eslint-plugin-neverthrow
```

## Mental Model

| Throwing style                  | neverthrow style                                |
| ------------------------------- | ----------------------------------------------- |
| `throw new Error("bad")`        | `return err(new AppError("bad"))`               |
| `try { x } catch (e) { ... }`   | `fromPromise(x, (e) => mapErr(e))`              |
| `const v = await p; doThing(v)` | `p.andThen(doThing)` or `yield* p` in `safeTry` |
| `if (e) throw; return x`        | `ok(x)` / `err(e)`                              |
| `.catch(e => fallback)`         | `.orElse(e => ok(fallback))`                    |
| Side effects on success         | `.andTee(fn)` — errors ignored, value passes    |
| Side effects then continue      | `.andThrough(fn)` — errors short-circuit        |

Result is **not thenable**; `ResultAsync` **is** thenable (`await` yields a `Result`).

## Top-Level Exports

```typescript
import {
   ok,
   err, // sync constructors
   Ok,
   Err,
   Result, // sync types
   okAsync,
   errAsync,
   ResultAsync, // async constructors + type
   fromThrowable, // sync wrap
   fromAsyncThrowable, // async wrap
   fromPromise, // Promise<T> → ResultAsync<T, E>
   fromSafePromise, // Promise that can't throw
   safeTry, // generator-based do-notation
} from "neverthrow";
```

## Synchronous API — `Result<T, E>`

### Constructors

```typescript
ok<T, E>(value: T): Ok<T, E>
err<T, E>(error: E): Err<T, E>
```

```typescript
const r1 = ok({ id: "123" }); // Ok
const r2 = err("missing"); // Err
r1.isOk(); // true
r2.isErr(); // true
```

### Core methods

| Method            | Signature                                                         | Purpose                                                                                         |
| ----------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `isOk()`          | `() => boolean` (type guard for `Ok`)                             | Branch on success.                                                                              |
| `isErr()`         | `() => boolean` (type guard for `Err`)                            | Branch on failure.                                                                              |
| `map`             | `<U>(fn: (t: T) => U) => Result<U, E>`                            | Transform `Ok` value. Leaves `Err` unchanged.                                                   |
| `mapErr`          | `<F>(fn: (e: E) => F) => Result<T, F>`                            | Transform `Err`. Leaves `Ok` unchanged.                                                         |
| `unwrapOr`        | `(fallback: T) => T`                                              | Extract `Ok` value or return fallback.                                                          |
| `andThen`         | `<U, F>(fn: (t: T) => Result<U, F>) => Result<U, E \| F>`         | Chain fallible sync op. Flattens nested `Result`.                                               |
| `asyncAndThen`    | `<U, F>(fn: (t: T) => ResultAsync<U, F>) => ResultAsync<U, E\|F>` | Chain into async world.                                                                         |
| `orElse`          | `<U, A>(fn: (e: E) => Result<U, A>) => Result<U\|T, A>`           | Error recovery; may convert `Err` → `Ok`.                                                       |
| `match`           | `<A, B>(onOk: (t)=>A, onErr: (e)=>B) => A\|B`                     | Fold both branches to a single value. Callbacks may return different types; result is `A \| B`. |
| `asyncMap`        | `<U>(fn: (t: T) => Promise<U>) => ResultAsync<U, E>`              | Map to async; result becomes `ResultAsync`.                                                     |
| `andTee`          | `(fn: (t: T) => unknown) => Result<T, E>`                         | Side-effect on `Ok`; passed-in errors **swallowed** (e.g. logging).                             |
| `orTee`           | `(fn: (e: E) => unknown) => Result<T, E>`                         | Side-effect on `Err`; passed-in errors swallowed.                                               |
| `andThrough`      | `<F>(fn: (t: T) => Result<unknown, F>) => Result<T, E\|F>`        | Side-effect on `Ok`; **errors propagate**. Value passes through.                                |
| `asyncAndThrough` | `<F>(fn: (t) => ResultAsync<unknown, F>) => ResultAsync<T, E\|F>` | Async variant of `andThrough`.                                                                  |

### Static class methods

```typescript
Result.fromThrowable(fn, errorMapper?) // wrap throwing function
Result.combine([r1, r2, ...])          // Promise.all semantics; short-circuits on first Err
Result.combineWithAllErrors([...])     // collects all errors instead of short-circuiting
```

### `Result.combine` — heterogeneous tuple inference

```typescript
const tuple = <T extends unknown[]>(...args: T): T => args;
const combined = Result.combine(tuple(ok("a"), ok(1), ok(true)));
// Result<[string, number, boolean], never>
```

## Asynchronous API — `ResultAsync<T, E>`

`ResultAsync` wraps `Promise<Result<T, E>>`. It is **thenable** — awaiting yields a `Result`. Most `Result` methods are mirrored and return `ResultAsync`, but terminal methods (`match`, `unwrapOr`) return `Promise` instead of `ResultAsync`.

### Constructors

```typescript
okAsync<T, E>(v: T): ResultAsync<T, E>
errAsync<T, E>(e: E): ResultAsync<T, E>

ResultAsync.fromPromise<T, E>(p: PromiseLike<T>, errFn: (u: unknown) => E): ResultAsync<T, E>
ResultAsync.fromSafePromise<T, E>(p: PromiseLike<T>): ResultAsync<T, E>          // no rejection possible
ResultAsync.fromThrowable<Fn, E>(fn: Fn, errFn?: (u) => E): (...args) => ResultAsync<...>
```

**Gotcha:** `ResultAsync.fromPromise(syncThrowingFn())` does NOT protect against synchronous throws inside `syncThrowingFn`. If the function may throw before returning its Promise, wrap with `ResultAsync.fromThrowable(fn, errFn)` instead.

### Methods (mirror `Result`, return `ResultAsync`)

`map` · `mapErr` · `unwrapOr` · `andThen` · `orElse` · `match` · `andTee` · `orTee` · `andThrough`
`ResultAsync.combine([...])` · `ResultAsync.combineWithAllErrors([...])`

`andThen` on `ResultAsync` accepts a callback returning `Result` **or** `ResultAsync`; return type is always `ResultAsync`.

`map` / `mapErr` callbacks can be sync or async (`Promise<U>`); return type stays `ResultAsync<U, E>`.

## `safeTry` — generator-based do-notation

Eliminates repetitive `if (r.isErr()) return err(...)` blocks. Inside a generator passed to `safeTry`, `yield* someResult` unwraps to `.value` or aborts the block returning the `Err`.

```typescript
function computation(): Result<number, string> {
   return safeTry<number, string>(function* () {
      const a = yield* mayFail1().mapErr((e) => `step1: ${e}`);
      const b = yield* mayFail2().mapErr((e) => `step2: ${e}`);
      return ok(a + b);
   });
}
```

Async version — use `async function*`:

```typescript
function computation(): Promise<Result<number, string>> {
   return safeTry<number, string>(async function* () {
      const a = yield* (await promiseOfResult()).mapErr((e) => `1: ${e}`);
      const b = yield* resultAsyncValue().mapErr((e) => `2: ${e}`); // ResultAsync works directly
      return ok(a + b);
   });
}
```

Rules:

1. Entire block is a generator function.
2. `yield* <RESULT>` inside aborts on `Err` or unwraps to `T`.
3. Return `ok(...)` / `err(...)` from the generator.
4. For `Promise<Result<T, E>>`, `await` **before** `yield*`.
5. `ResultAsync` — `yield*` directly (already thenable).

## Montte Conventions

### Repositories (`core/database/src/repositories/*.ts`)

Wrap DB work in `fromPromise` with an async IIFE; inside, use `throw AppError.*(...)` freely — `fromPromise` converts to `Err`. The second argument maps unknown → `AppError`.

```typescript
import { fromPromise, ok, err } from "neverthrow";
import { AppError, validateInput } from "@core/logging/errors";

export function createCategory(
   db: DatabaseInstance,
   teamId: string,
   data: CreateCategoryInput,
) {
   return fromPromise(
      (async () => {
         const validated = validateInput(createCategorySchema, data);
         const [row] = await db
            .insert(categories)
            .values({ ...validated, teamId })
            .returning();
         if (!row) throw AppError.database("Failed to create category");
         return row;
      })(),
      (e) =>
         e instanceof AppError
            ? e
            : AppError.database("Failed to create category", { cause: e }),
   );
}
```

Chain dependent ops with `.andThen(...)`:

```typescript
export function archiveCategory(
   db: DatabaseInstance,
   id: string,
   teamId: string,
) {
   return ensureCategoryOwnership(db, id, teamId).andThen(() =>
      fromPromise(
         db
            .update(categories)
            .set({ archivedAt: dayjs().toDate() })
            .where(eq(categories.id, id))
            .returning(),
         (e) => AppError.database("Failed to archive category", { cause: e }),
      ),
   );
}
```

### Routers (`apps/web/src/integrations/orpc/router/*.ts`)

Consume repository results and convert errors to `WebAppError` via `propagateError` or explicit `match`. Never use `_unsafeUnwrap()` in new code — existing callsites are legacy.

Preferred pattern using `match`:

```typescript
import { WebAppError } from "@core/logging/errors";

return (await createCategory(context.db, context.teamId, input)).match(
   (category) => category,
   (e) => {
      throw WebAppError.fromAppError(e);
   },
);
```

Or using `safeTry` when chaining:

```typescript
const result = await safeTry<Category, AppError>(async function* () {
   yield* ensureCategoryOwnership(context.db, id, context.teamId);
   return ok(yield* updateCategory(context.db, id, data));
});
if (result.isErr()) throw WebAppError.fromAppError(result.error);
return result.value;
```

### TanStack Form submit handlers

```typescript
import { fromPromise } from "neverthrow";
import { ORPCError } from "@orpc/client";

onSubmitAsync: async ({ value }) => {
   const result = await fromPromise(
      createMutation.mutateAsync(value),
      (e) => e,
   );
   if (result.isErr()) {
      if (
         result.error instanceof ORPCError &&
         result.error.code === "CONFLICT"
      ) {
         return { fields: { name: "Já existe um registro com esse valor." } };
      }
      return result.error instanceof Error
         ? result.error.message
         : "Erro inesperado.";
   }
   toast.success("Salvo com sucesso.");
   return null;
};
```

For simple forms without field-level server conflicts, use plain `onSubmit` + `toast.error` — `fromPromise` only required when discriminating error types.

### DBOS workflow steps

Workflow steps must use repositories (already return `ResultAsync`). Chain with `.andThen`, consume with `.match` at the step boundary. Never call raw `db` directly in workflow steps.

## Common Recipes

### Convert a throwing third-party call

```typescript
const safeParse = Result.fromThrowable(JSON.parse, (e) =>
   AppError.validation("Invalid JSON", { cause: e }),
);
const result = safeParse(untrustedJson); // Result<unknown, AppError>
```

### Wrap a Promise-returning SDK call

```typescript
const charge = ResultAsync.fromThrowable(
   (id: string) => stripe.charges.retrieve(id),
   (e) => AppError.internal("Stripe fetch failed", { cause: e }),
);
await charge("ch_123"); // ResultAsync<Stripe.Charge, AppError>
```

### Recover from specific error

```typescript
findUser(id).orElse((e) =>
   e.code === "NotFound" ? ok(createGuestUser()) : err(e),
);
```

### Parallel combine — short-circuit

```typescript
const combined = await ResultAsync.combine([
   fetchUser(id),
   fetchOrg(orgId),
   fetchTeam(teamId),
]);
// ResultAsync<[User, Org, Team], UserErr | OrgErr | TeamErr>
```

### Parallel combine — collect all errors

```typescript
await ResultAsync.combineWithAllErrors([op1, op2, op3]);
// ResultAsync<[A, B, C], (E1 | E2 | E3)[]>
```

### Flatten nested Results

```typescript
const nested: Result<Result<number, E1>, E2> = ...;
const flat = nested.andThen((inner) => inner); // Result<number, E1 | E2>
```

### Fire-and-forget logging

```typescript
validateInput(schema, data)
   .andTee((v) => logger.info({ v }, "validated")) // log, continue regardless
   .andThrough((v) => auditLog(v)) // fail if auditLog fails
   .andThen(insertUser);
```

## Pitfalls

1. **`andTee` vs `andThrough`** — `andTee` swallows side-effect errors; `andThrough` propagates them. Pick deliberately.
2. **`Result.combine` with mixed sync/async** — never combine `Result[]` with `ResultAsync[]`; use separate arrays.
3. **`fromPromise` can't catch sync throws** — if the callee throws before returning a Promise, `fromPromise` still throws. Use `ResultAsync.fromThrowable` or an async IIFE: `fromPromise((async () => syncThrowing())(), errFn)`.
4. **`await` a `ResultAsync`** — yields a `Result`, not a `T`. Call `.isOk()` / `.match()` before reading `.value`.
5. **`_unsafeUnwrap` / `_unsafeUnwrapErr`** — tests only. Not allowed in production code.
6. **Match callback return types can differ** — `match<A, B>(onOk: (t) => A, onErr: (e) => B)` returns `A | B`. No need to unify them manually.
7. **TypeScript narrowing** — after `if (r.isErr()) return ...`, `r` narrows to `Ok<T, E>` and `r.value` is accessible.
8. **No `try/catch` to convert** — if you find yourself wrapping existing neverthrow code in `try/catch`, it's wrong. Use `.match` / `.mapErr`.
9. **`safeTry` + Promise<Result>** — must `await` before `yield*`. `ResultAsync` can be `yield*`'d directly.
10.   **Error union explosion** — chaining `.andThen` across many different error types produces wide union. Use `.mapErr` early to normalize to a single error type (Montte: `AppError`).

## Testing

```typescript
import { ok, err } from "neverthrow";

// Prefer equality — Result instances are comparable
expect(callFn("a")).toEqual(ok(42));

// Or unwrap when you need the inner value
expect(callFn("a")._unsafeUnwrap()).toBe(42);
expect(callFn("bad")._unsafeUnwrapErr()).toBe("reason");

// Include stack trace for debugging
result._unsafeUnwrap({ withStackTrace: true });
```

`_unsafeUnwrap` / `_unsafeUnwrapErr` throw a custom object (not `Error`) so Jest/Vitest output stays readable. Only use in tests.

## eslint-plugin-neverthrow

Forces every `Result` to be consumed via `.match`, `.unwrapOr`, or `._unsafeUnwrap`. Enable it to prevent silently-dropped results. Analogous to Rust's `#[must_use]`.

## Quick Reference — When to use what

| Need                                             | Tool                                                        |
| ------------------------------------------------ | ----------------------------------------------------------- |
| Wrap throwing sync fn                            | `Result.fromThrowable(fn, errFn)`                           |
| Wrap Promise                                     | `ResultAsync.fromPromise(p, errFn)`                         |
| Wrap Promise-returning fn (sync throws possible) | `ResultAsync.fromThrowable(fn, errFn)`                      |
| Chain sync fallible op                           | `.andThen(fn)`                                              |
| Chain async fallible op                          | `.andThen(fn)` on `ResultAsync`; `asyncAndThen` on `Result` |
| Transform Ok value                               | `.map(fn)`                                                  |
| Transform Err                                    | `.mapErr(fn)`                                               |
| Recover from Err                                 | `.orElse(fn)`                                               |
| Fold to single value                             | `.match(onOk, onErr)`                                       |
| Side-effect, ignore inner failure                | `.andTee(fn)` / `.orTee(fn)`                                |
| Side-effect, propagate inner failure             | `.andThrough(fn)` / `.asyncAndThrough(fn)`                  |
| Run many in parallel, stop on first Err          | `Result.combine([...])` / `ResultAsync.combine([...])`      |
| Run many in parallel, collect all Errs           | `.combineWithAllErrors([...])`                              |
| Eliminate `if (r.isErr()) return` boilerplate    | `safeTry(function*() { ... })`                              |
| Default value on Err                             | `.unwrapOr(default)`                                        |
