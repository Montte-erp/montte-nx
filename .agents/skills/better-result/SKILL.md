---
name: better-result
description: Use when implementing, refactoring, reviewing, or testing Result-based domain flows with better-result in Montte, especially core wrappers, async integrations, retries, error mapping, serialization, and oRPC router boundaries.
---

# Better Result In Montte

Use this skill when code uses or should use `better-result`. In this repo, prefer it for new shared wrappers and isolated domain flows that are not already standardized on `neverthrow`. Do not mix `better-result` and `neverthrow` inside the same module.

Primary sources:

- `https://better-result.dev/introduction`
- `https://better-result.dev/quickstart`
- `https://better-result.dev/core/creating-results`
- `https://better-result.dev/core/transforming-results`
- `https://better-result.dev/core/error-handling`
- `https://better-result.dev/core/pattern-matching`
- `https://better-result.dev/core/generator-composition`
- `https://better-result.dev/advanced/retry-logic`
- `https://better-result.dev/advanced/async-operations`
- `https://better-result.dev/advanced/serialization`
- `https://better-result.dev/advanced/best-practices`

## Repo Workflow

1. Inspect the current domain path before changing patterns. For MON-1076-style DBOS work, start with:
   - `core/dbos/src/client.ts`
   - `core/dbos/src/worker.ts`
   - `modules/classification/src/workflows`
   - `modules/classification/src/router`
   - `core/orpc/src/server.ts`
2. Keep Result usage inside shared wrapper, domain/use-case, and adapter code. oRPC routers are boundary code: they may call Result-returning use cases, then translate `Err` into `WebAppError` or a serialized result shape intentionally.
3. Prefer explicit domain error unions with `TaggedError`; do not return strings or raw thrown exceptions from expected domain code.
4. Keep user-facing messages in pt-BR.
5. Add or update focused tests in the owning package. Prefer Nx targets such as `bun nx run @core/dbos:typecheck` and `bun nx run @modules/classification:typecheck`.

## Core Pattern

Use `Result<T, E>` for recoverable domain/integration failures. Throw only for programmer errors or truly unrecoverable states.

```ts
import { Result, TaggedError } from "better-result";

export class CaseNotFoundError extends TaggedError("CaseNotFoundError")<{
  processNumber: string;
  message: string;
}>() {}

export const normalizeCaseInput = (
  processNumber: string,
): Result<{ normalized: string }, CaseNotFoundError> => {
  const normalized = processNumber.replace(/\D/g, "");

  if (!normalized) {
    return Result.err(
      new CaseNotFoundError({
        processNumber,
        message: "Informe um numero de processo valido.",
      }),
    );
  }

  return Result.ok({ normalized });
};
```

For thrown or promise APIs, use typed catch handlers:

```ts
const response = await Result.tryPromise({
  try: () => fetch(url, { signal: AbortSignal.timeout(10_000) }),
  catch: (cause) =>
    new ExternalCourtError({
      source: "trf1-pje-public",
      message: "Falha ao consultar o tribunal.",
      retryable: true,
      cause,
    }),
});
```

Do not let `catch` handlers throw. Convert unknown causes into domain errors.

## Composition

Use `.map()` for pure success transforms, `.mapError()` to convert error types at boundaries, `.andThen()` for simple Result-returning chains, and `Result.gen()` for multi-step use cases.

For async composition inside `Result.gen`, always wrap `Promise<Result<...>>` with `Result.await()`.

```ts
export const searchCase = async (
  input: SearchCaseInput,
): Promise<Result<CaseSearchResult, CaseSearchError>> =>
  Result.gen(async function* () {
    const parsed = yield* parseCnj(input.processNumber);
    const organization = yield* Result.await(resolveOrganization(input.organizationSlug));
    const records = yield* Result.await(searchAdapters({ parsed, organization }));

    return Result.ok({
      processNumber: parsed,
      records,
    });
  });
```

Use `andThen()` for short linear chains:

```ts
const result = parseCnj(input).andThen(inferTribunal).andThen(validateSupportedTribunal);
```

## Errors

Use `TaggedError` classes for domain/integration errors and preserve useful structured fields:

```ts
export class CaseAdapterError extends TaggedError("CaseAdapterError")<{
  source: CaseSourceKind;
  status: "skipped" | "blocked" | "failed";
  reason: string;
  message: string;
  officialUrl?: string;
  retryable?: boolean;
  raw?: unknown;
  cause?: unknown;
}>() {}
```

Use `matchError` when translating error unions exhaustively:

```ts
import { matchError } from "better-result";
import { WebAppError } from "@core/logging/errors";

const toRpcError = (error: CaseSearchError) =>
  matchError(error, {
    CaseValidationError: (e) => WebAppError.badRequest(e.message),
    CaseAdapterError: (e) =>
      e.status === "blocked" ? WebAppError.forbidden(e.message) : WebAppError.internal(e.message),
  });
```

## oRPC Boundaries

Do not leak internal `Err` objects by accident. Pick one explicit boundary style per procedure:

- Domain result returned intentionally: return `Result.serialize(result)` and document the client-side handling.
- Standard RPC behavior: if `Err`, throw a mapped `WebAppError`; if `Ok`, return `value`.

```ts
const result = await useCase(input);

if (Result.isError(result)) {
  throw toRpcError(result.error);
}

return result.value;
```

Use serialization only for JSON/RPC/cache boundaries. Never `JSON.stringify` a Result instance directly; call `Result.serialize(result)` first and handle `Result.deserialize(...)` errors for untrusted data.

## Retries

Use `Result.tryPromise(..., { retry })` for flaky external operations like court APIs. Keep retries narrow:

```ts
const result = await Result.tryPromise(
  {
    try: () => client.search(tribunal.alias, query),
    catch: (cause) =>
      createAdapterError({
        source: "datajud",
        reason: "Falha ao consultar DataJud.",
        cause,
      }),
  },
  {
    retry: {
      times: 2,
      delayMs: 200,
      backoff: "exponential",
      shouldRetry: (error) => error.retryable === true,
    },
  },
);
```

Do not retry validation errors, auth/permission failures, or deterministic parsing failures. Test retry behavior with mocked clients and explicit attempt counters.

## Testing Checklist

For every non-trivial Result flow, cover:

- `Ok` path, including transformed output shape.
- Each `TaggedError` variant or important error branch.
- Short-circuit behavior in `Result.gen` or adapter loops.
- `Result.await` async failure path.
- Boundary translation in oRPC routers: `Err` becomes the expected `WebAppError` or serialized shape.
- Retry attempts and non-retryable errors when retry logic is used.
- Serialization/deserialization round trip if a Result crosses a JSON/cache boundary.

Prefer `Result.isOk(result)` / `Result.isError(result)` in assertions before reading `.value` or `.error`.

## Anti-Patterns

- Do not call `.unwrap()` without a prior `Result.isOk(result)` or equivalent narrowing.
- Do not mix `throw`/`try-catch` into domain control flow when a typed `Err` is expected.
- Do not return `Result<..., string>` for domain code; define a tagged error.
- Do not hide every error behind `INTERNAL_SERVER_ERROR`; map known domain errors intentionally.
- Do not use `Result.gen()` for a single transform; keep simple flows simple.
- Do not add repository layers or broad abstractions just to host Result helpers.
