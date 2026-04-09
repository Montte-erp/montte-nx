# TanStack Form + Query + Pacer — Advanced Adoption Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Code Review:** After EVERY task commit, dispatch a `superpowers:code-reviewer` subagent. Fix Critical and Important issues before proceeding to the next task. See the Code Review Protocol section at the bottom.

**Goal:** Unlock TanStack Form server-side inline field errors, TanStack Query v5 parallel queries / pagination / conditional query patterns, and migrate debounce from foxact to TanStack Pacer — across the 28+ form files and all route components.

**Architecture:** Three independent tracks that share no dependencies: (A) Form track — fix `FieldError` string handling, adopt `onSubmitAsync`, selective `Subscribe`, `useBlocker`; (B) Query track — `useSuspenseQueries` for parallel queries, `skipToken` for conditional queries, `keepPreviousData` for pagination, migrate raw `createErrorFallback` usages to `QueryBoundary`; (C) Pacer track — migrate 3 `useDebouncedValue` usages to `useDebouncedCallback`, add `useRateLimiter` on export buttons.

**Tech Stack:** `@tanstack/react-form@1.28.5`, `@tanstack/react-query@5`, `@tanstack/react-pacer` (already installed), `@tanstack/react-router` (`useBlocker`), `apps/web/src/components/query-boundary.tsx` (`QueryBoundary`, `createErrorFallback`), `packages/ui/src/components/field.tsx` (`FieldError`)

---

## Pre-flight Context

### FieldError — type mismatch (blocks Form Track)
`packages/ui/src/components/field.tsx:187` — `FieldError` accepts `errors?: Array<{ message?: string } | undefined>`. TanStack Form's `field.state.meta.errors` from Zod validators are `ZodIssue[]` (have `.message` ✅). Errors from `onSubmitAsync` field returns are **plain strings** ❌ — they silently render nothing because `"string".message === undefined`.

### QueryBoundary already wraps QueryErrorResetBoundary
`apps/web/src/components/query-boundary.tsx:60` — `QueryBoundary` already internally wraps `QueryErrorResetBoundary`. The issue is that many routes use `createErrorFallback` + bare `ErrorBoundary` + `Suspense` directly, bypassing the reset. Those need to migrate to `QueryBoundary`.

### Pacer already installed and in CLAUDE.md
`@tanstack/react-pacer` is in `catalog:tanstack`. CLAUDE.md already mandates `useDebouncedCallback` from Pacer for callbacks — 3 files still use `foxact/use-debounced-value` and need migration.

### oRPC client error codes
Before implementing `onSubmitAsync`, read `apps/web/src/integrations/orpc/client.ts` to understand how `WebAppError` surfaces on the client. Do **not** import `@core/logging/errors` in frontend code — `WebAppError` may be a plain `Error` with a serialized `code` field.

---

## Track A — TanStack Form

### Task A1: Fix FieldError to handle string errors

**Files:**
- Modify: `packages/ui/src/components/field.tsx:187-236`

**Step 1: Replace the FieldError implementation**

```tsx
function FieldError({
   className,
   children,
   errors,
   ...props
}: React.ComponentProps<"div"> & {
   errors?: Array<{ message?: string } | string | undefined>;
}) {
   const content = useMemo(() => {
      if (children) return children;
      if (!errors?.length) return null;

      const messages = errors
         .map((error) => (typeof error === "string" ? error : error?.message))
         .filter(Boolean) as string[];

      const unique = [...new Set(messages)];

      if (unique.length === 0) return null;
      if (unique.length === 1) return unique[0];

      return (
         <ul className="ml-4 flex list-disc flex-col gap-1">
            {unique.map((msg, index) => (
               <li key={`step-${index + 1}`}>{msg}</li>
            ))}
         </ul>
      );
   }, [children, errors]);

   if (!content) return null;

   return (
      <div
         className={cn("text-destructive text-sm font-normal", className)}
         data-slot="field-error"
         role="alert"
         {...props}
      >
         {content}
      </div>
   );
}
```

**Step 2: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "field.tsx" | head -10
```

Expected: no new errors from existing usages.

**Step 3: Commit**

```bash
git add packages/ui/src/components/field.tsx
git commit -m "fix(ui): FieldError handles plain string errors from onSubmitAsync"
```

**Step 4: Code review**

```bash
BASE_SHA=$(git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)
```

Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: FieldError updated to accept `string | { message?: string }` union
- `PLAN_OR_REQUIREMENTS`: Task A1 — fix FieldError string handling
- `BASE_SHA` / `HEAD_SHA`: from above
- `DESCRIPTION`: Single component change in packages/ui — check for regressions in existing error displays

---

### Task A2: Read oRPC client to understand error type

**Files:**
- Read: `apps/web/src/integrations/orpc/client.ts`
- Read: `apps/web/src/integrations/orpc/server.ts` (or wherever middleware is defined)

**Goal:** Understand if `err.code` is available on the client without importing `@core/logging/errors`. Write down the safe pattern for the tasks below. Likely: `err instanceof Error && 'code' in err && err.code === 'CONFLICT'`.

---

### Task A3: Migrate bills-form to onSubmitAsync

**Files:**
- Read then modify: `apps/web/src/features/bills/ui/bills-form.tsx`

**Step 1: Replace mutation + onSubmit with onSubmitAsync**

Remove `useMutation` if the only usage is in `onSubmit`. Replace with:

```tsx
const form = useForm({
   defaultValues: { ... },
   validators: {
      onSubmitAsync: async ({ value }) => {
         try {
            await orpc.bills.create.call({ input: value });
            toast.success("Conta a pagar criada");
            onSuccess?.();
            return null;
         } catch (err) {
            // Use pattern determined in Task A2
            if (err instanceof Error && (err as { code?: string }).code === "CONFLICT") {
               return { form: "Já existe uma conta com esses dados" };
            }
            return { form: err instanceof Error ? err.message : "Erro inesperado" };
         }
      },
   },
});
```

**Step 2: Add form-level error display above the submit button**

```tsx
<form.Subscribe selector={(state) => state.errors}>
   {(errors) => errors.length > 0 && <FieldError errors={errors} />}
</form.Subscribe>
```

**Step 3: Migrate submit button to selective Subscribe**

```tsx
<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
   {([canSubmit, isSubmitting]) => (
      <Button type="submit" disabled={!canSubmit}>
         {isSubmitting ? <Spinner /> : "Salvar"}
      </Button>
   )}
</form.Subscribe>
```

**Step 4: Typecheck + commit**

```bash
bun run typecheck 2>&1 | grep "bills-form" | head -10
git add apps/web/src/features/bills/ui/bills-form.tsx
git commit -m "feat(bills): inline server errors via onSubmitAsync"
```

**Step 5: Code review**

```bash
BASE_SHA=$(git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)
```

Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: bills-form migrated from useMutation+toast to onSubmitAsync with inline errors
- `PLAN_OR_REQUIREMENTS`: Task A3 — onSubmitAsync pattern, form-level FieldError, selective Subscribe on submit button
- `DESCRIPTION`: Check error mapping is complete, toast.success still fires on success, no dead useMutation code left

---

### Task A4: Migrate contacts-form to onSubmitAsync

**Files:**
- Read then modify: `apps/web/src/features/contacts/ui/contacts-form.tsx`

Same pattern as A3. Map known conflict:

```tsx
if (code === "CONFLICT") {
   return { fields: { document: "CNPJ/CPF já cadastrado" } };
}
```

The field name `document` must match the exact key in `defaultValues` — verify before applying.

**Commit:**
```bash
git commit -m "feat(contacts): inline server errors via onSubmitAsync"
```

**Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: contacts-form migrated to onSubmitAsync, CONFLICT mapped to document field
- `DESCRIPTION`: Verify field name matches defaultValues key, check CNPJ/CPF conflict error path, no orphaned imports

---

### Task A5: Migrate bank-accounts-form to onSubmitAsync

**Files:**
- Read then modify: `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx`

Same pattern. Commit separately:
```bash
git commit -m "feat(bank-accounts): inline server errors via onSubmitAsync"
```

**Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: bank-accounts-form migrated to onSubmitAsync
- `DESCRIPTION`: Verify agency/account validation errors map correctly, no dead mutation code

---

### Task A6: Audit and fix non-selective form.Subscribe

**Step 1: Find all non-selective usages**

```bash
grep -rn "form\.Subscribe" apps/web/src/ --include="*.tsx" | grep -v "selector"
```

**Step 2: For each hit, add the minimal selector**

Common pattern — replace:
```tsx
<form.Subscribe>
   {(state) => <Button disabled={!state.canSubmit} />}
</form.Subscribe>
```

With:
```tsx
<form.Subscribe selector={(state) => state.canSubmit}>
   {(canSubmit) => <Button disabled={!canSubmit} />}
</form.Subscribe>
```

For multiple values use `as const` tuple:
```tsx
selector={(state) => [state.canSubmit, state.isSubmitting] as const}
```

**Step 3: Typecheck + commit**

```bash
bun run typecheck 2>&1 | grep -E "Subscribe" | head -10
git add -p
git commit -m "perf(forms): add selective selectors to all form.Subscribe usages"
```

**Step 4: Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: All form.Subscribe usages now use typed selectors
- `DESCRIPTION`: Check for any remaining non-selective Subscribe, verify tuple selectors use `as const`, no type errors introduced

---

### Task A7: Add useBlocker to edit forms

**Files:**
- Modify: `apps/web/src/features/contacts/ui/contacts-form.tsx`
- Modify: `apps/web/src/features/bills/ui/bills-form.tsx`
- Modify: `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx`

**API shape (from types):**
```typescript
// useBlocker without withResolver → uses browser native confirm (void return)
useBlocker({ shouldBlockFn: () => boolean });

// useBlocker with withResolver: true → returns proceed()/reset() for custom UI
const blocker = useBlocker({ shouldBlockFn: () => boolean, withResolver: true });
// blocker.status === 'blocked' | 'idle'
// blocker.proceed() — allow navigation
// blocker.reset()   — cancel, stay on current page
```

**Step 1: Add import**

```tsx
import { useBlocker } from "@tanstack/react-router";
```

**Step 2: Use `withResolver: true` for a custom confirmation dialog**

Add inside the form component, after `useForm`. The `isEditing` condition depends on whether a record prop is passed (truthy = edit mode):

```tsx
const blocker = useBlocker({
   shouldBlockFn: () => form.state.isDirty && !form.state.isSubmitted,
   disabled: !isEditing,
   withResolver: true,
});
```

**Step 3: Render a confirmation dialog when blocked**

```tsx
{blocker.status === "blocked" && (
   <AlertDialog open>
      <AlertDialogContent>
         <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
               Você tem alterações não salvas. Deseja sair sem salvar?
            </AlertDialogDescription>
         </AlertDialogHeader>
         <AlertDialogFooter>
            <AlertDialogCancel onClick={blocker.reset}>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={blocker.proceed}>Sair sem salvar</AlertDialogAction>
         </AlertDialogFooter>
      </AlertDialogContent>
   </AlertDialog>
)}
```

Note: Use `useAlertDialog` hook (from the global store) if this confirmation pattern already exists in the project — check before adding inline JSX.

**Step 4: Typecheck + commit**

```bash
bun run typecheck 2>&1 | grep "useBlocker\|contacts-form\|bills-form\|bank-accounts" | head -10
git add apps/web/src/features/{contacts,bills,bank-accounts}/ui/*.tsx
git commit -m "feat(forms): block navigation on unsaved changes in edit mode"
```

**Step 5: Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: useBlocker with withResolver added to contacts, bills, bank-accounts edit forms
- `DESCRIPTION`: Check `disabled` prop correctly gates blocking to edit mode only, verify `!isSubmitted` prevents false blocks after save, confirm AlertDialog uses Portuguese strings, check `proceed`/`reset` wired to correct buttons

---

## Track B — TanStack Query v5

### Task B1: Fix useActiveTeam waterfall → useSuspenseQueries

**Files:**
- Modify: `apps/web/src/hooks/use-active-team.ts`

Current (sequential suspense = waterfall):
```tsx
const { data: session } = useSuspenseQuery(orpc.session.getSession.queryOptions({}));
const { data: teams } = useSuspenseQuery(orpc.organization.getOrganizationTeams.queryOptions({}));
```

Replace with:
```tsx
import { useSuspenseQueries } from "@tanstack/react-query";

export function useActiveTeam() {
   const [{ data: session }, { data: teams }] = useSuspenseQueries({
      queries: [
         orpc.session.getSession.queryOptions({}),
         orpc.organization.getOrganizationTeams.queryOptions({}),
      ],
   });

   const activeTeamId = session?.session.activeTeamId ?? null;
   const activeTeam = teams.find((team) => team.id === activeTeamId) ?? null;

   return { activeTeam, activeTeamId, teams };
}
```

**Typecheck + commit:**
```bash
bun run typecheck 2>&1 | grep "use-active-team" | head -10
git add apps/web/src/hooks/use-active-team.ts
git commit -m "perf(query): parallel queries in useActiveTeam via useSuspenseQueries"
```

**Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: useActiveTeam refactored from 2 sequential useSuspenseQuery to useSuspenseQueries
- `DESCRIPTION`: Verify destructure order matches query order, check activeTeam lookup logic unchanged

---

### Task B2: Migrate useQuery + enabled to skipToken

**Files:**
- Modify: `apps/web/src/features/services/ui/subscription-form.tsx:87`
- Modify: `apps/web/src/features/services/ui/services-form.tsx:68`
- Modify: `apps/web/src/features/analytics/ui/dashboard-tile.tsx:201`

**Pattern — subscription-form.tsx (selectedServiceId may be empty string):**

```tsx
import { skipToken, useSuspenseQuery } from "@tanstack/react-query";

const { data: variants } = useSuspenseQuery(
   selectedServiceId
      ? orpc.services.getVariants.queryOptions({ input: { serviceId: selectedServiceId } })
      : { queryKey: ["variants", "skip"], queryFn: skipToken },
);
// variants is [] when skipped — may need fallback: const safeVariants = variants ?? []
```

**Pattern — services-form.tsx (conditional on edit mode):**

```tsx
const { data: existingVariants } = useSuspenseQuery(
   !isCreate && service?.id
      ? orpc.services.getVariants.queryOptions({ input: { serviceId: service.id } })
      : { queryKey: ["variants", "skip"], queryFn: skipToken },
);
```

**Pattern — dashboard-tile.tsx (insightId + !insightName):**

```tsx
const { data: insight } = useSuspenseQuery(
   insightId && !insightName
      ? orpc.insights.getById.queryOptions({ input: { id: insightId } })
      : { queryKey: ["insight", "skip"], queryFn: skipToken },
);
```

**Important:** Each component using `useSuspenseQuery` with `skipToken` must already be inside a `<Suspense>` boundary. Verify this before applying. If not, add the boundary or keep `useQuery + enabled`.

**Typecheck each file after change. Commit per file:**
```bash
git commit -m "feat(services): use skipToken for conditional variant query"
git commit -m "feat(analytics): use skipToken for conditional insight query"
```

**Code review** (after all 3 files) — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: 3 useQuery+enabled migrated to skipToken+useSuspenseQuery
- `DESCRIPTION`: Verify each component is inside a Suspense boundary, check skipped query returns correct fallback type (undefined vs []), no TypeScript errors on skipped data usage

---

### Task B3: Add keepPreviousData to all paginated queries

**Step 1: Find all paginated query usages**

```bash
grep -rn "page\|pageSize" apps/web/src/ --include="*.tsx" | grep "queryOptions\|useSuspense" | head -30
```

**Step 2: Apply keepPreviousData**

For every `useSuspenseQuery` that takes `page` or `pageSize` as input:

```tsx
import { keepPreviousData } from "@tanstack/react-query";

const { data, isPlaceholderData } = useSuspenseQuery({
   ...orpc.transactions.getAll.queryOptions({
      input: { page, pageSize, ...otherFilters },
   }),
   placeholderData: keepPreviousData,
});
```

Use `isPlaceholderData` to show a subtle loading indicator (optional opacity change):
```tsx
<div className={isPlaceholderData ? "opacity-50" : ""}>
   {/* table content */}
</div>
```

**Known paginated queries to update:** transactions, contacts, bills, credit-cards, inventory, services, bank-accounts, budget-goals.

**Commit per feature area:**
```bash
git commit -m "feat(transactions): keepPreviousData for smooth page transitions"
# repeat for others
```

**Code review** (after all paginated queries updated) — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: keepPreviousData added to all paginated queries
- `DESCRIPTION`: Check isPlaceholderData is used consistently for visual feedback, verify no paginated query was missed, no conflicts with existing Suspense skeleton fallbacks

---

### Task B4: Migrate raw ErrorBoundary usages to QueryBoundary

**Step 1: Find files using createErrorFallback directly with ErrorBoundary (not via QueryBoundary)**

```bash
grep -rn "createErrorFallback\|ErrorBoundary" apps/web/src/ --include="*.tsx" | grep -v "QueryBoundary\|query-boundary" | head -30
```

**Step 2: Replace the pattern**

Before:
```tsx
<ErrorBoundary FallbackComponent={createErrorFallback({ errorTitle: "Erro ao carregar" })}>
   <Suspense fallback={<MySkeleton />}>
      <MyContent />
   </Suspense>
</ErrorBoundary>
```

After:
```tsx
import { QueryBoundary } from "@/components/query-boundary";

<QueryBoundary errorTitle="Erro ao carregar" fallback={<MySkeleton />}>
   <MyContent />
</QueryBoundary>
```

`QueryBoundary` already wraps `QueryErrorResetBoundary` internally — no changes to the component needed.

**Step 3: Typecheck + commit**

```bash
bun run typecheck 2>&1 | head -20
git add -p
git commit -m "feat(query): migrate ErrorBoundary usages to QueryBoundary for retry support"
```

**Step 4: Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: All bare ErrorBoundary+Suspense replaced with QueryBoundary
- `DESCRIPTION`: Verify errorTitle/fallback props preserved correctly in each migration, check no manual Suspense wrappers remain inside QueryBoundary children

---

## Track C — TanStack Pacer

### Task C1: Migrate transaction-filter-bar debounce

**Files:**
- Read then modify: `apps/web/src/features/transactions/ui/transaction-filter-bar.tsx`

**Current (line 14 + 144):**
```tsx
import { useDebouncedValue } from "foxact/use-debounced-value";
const debouncedSearch = useDebouncedValue(searchInput, 350);
// + useEffect watching debouncedSearch
```

**New:**
```tsx
import { useDebouncedCallback } from "@tanstack/react-pacer";

const handleSearchChange = useDebouncedCallback(
   (value: string) => {
      navigate({ search: (prev) => ({ ...prev, search: value, page: 1 }), replace: true });
   },
   { wait: 350 },
);
```

Remove the `useDebouncedValue` import, the `debouncedSearch` variable, and the `useEffect` that watched it. Wire `handleSearchChange` directly to the input's `onInput` or `onChange`.

**Typecheck + commit:**
```bash
bun run typecheck 2>&1 | grep "transaction-filter" | head -10
git add apps/web/src/features/transactions/ui/transaction-filter-bar.tsx
git commit -m "perf(transactions): migrate debounce to useDebouncedCallback from Pacer"
```

**Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: transaction-filter-bar debounce migrated from foxact to Pacer
- `DESCRIPTION`: Verify isMounted guard removed (Pacer handles this), useEffect deleted, no foxact import remains, debounce timing preserved (350ms)

---

### Task C2: Migrate category-filter-bar debounce

**Files:**
- Read then modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-filter-bar.tsx`

Same migration pattern (300ms). Remove `foxact` import.

**Commit:**
```bash
git commit -m "perf(categories): migrate debounce to useDebouncedCallback from Pacer"
```

**Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: category-filter-bar debounce migrated to Pacer
- `DESCRIPTION`: Same checks as C1 — no foxact import, no useEffect, 300ms preserved

---

### Task C3: Migrate use-insight-config debounce

**Files:**
- Read then modify: `apps/web/src/features/analytics/hooks/use-insight-config.ts`

Current uses `useDebouncedValue(pendingUpdates, 500)` + `useEffect`. Replace with `useDebouncedCallback`:

```tsx
import { useDebouncedCallback } from "@tanstack/react-pacer";

const flushPendingUpdates = useDebouncedCallback(
   (updates: Partial<InsightConfig>) => {
      applyConfig(updates); // whatever the current flush does
   },
   { wait: 500 },
);

// Call flushPendingUpdates(updates) directly instead of setPendingUpdates
```

**Commit:**
```bash
git commit -m "perf(analytics): migrate insight config debounce to Pacer"
```

**Code review** — Dispatch `superpowers:code-reviewer`:
- `WHAT_WAS_IMPLEMENTED`: use-insight-config debounce migrated to useDebouncedCallback
- `DESCRIPTION`: Verify updateConfigImmediate still works synchronously, debouncedUpdates state variable removed, 500ms preserved, useEffect deleted

---

### Task C4: Add useRateLimiter to export buttons (optional)

**Files:** Find export buttons in transactions, contacts feature areas.

```bash
grep -rn "Exportar\|handleExport\|exportCSV" apps/web/src/ --include="*.tsx" | head -10
```

If export handlers exist, apply:
```tsx
import { useRateLimiter } from "@tanstack/react-pacer";

const exportLimiter = useRateLimiter(handleExport, {
   limit: 3,
   window: 60_000,
   windowType: "sliding",
   onReject: () => toast.error("Aguarde antes de exportar novamente."),
});

<Button onClick={() => exportLimiter.maybeExecute("csv")}>Exportar CSV</Button>
```

**Only apply if export handlers exist and are prone to rapid-clicking.**

---

## Task D: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` — sections "TanStack Form Pattern" and "Client-Side Patterns (oRPC + TanStack Query)"

**Add to TanStack Form Pattern section:**
```markdown
- **FieldError** — use `<FieldError errors={field.state.meta.errors} />`. Handles Zod `ZodIssue[]` and plain `string[]`.
- **Server errors** — use `validators.onSubmitAsync` (not `onError` toast) for field-level server validation. Return `{ fields: { fieldName: "msg" } }` or `{ form: "msg" }`.
- **Form-level errors** — `<form.Subscribe selector={(state) => state.errors}>{(errors) => <FieldError errors={errors} />}</form.Subscribe>`.
- **Selective Subscribe** — always pass `selector` to `form.Subscribe`. Use `as const` for tuple selectors: `selector={(state) => [state.canSubmit, state.isSubmitting] as const}`.
- **Navigation guard** — `useBlocker({ shouldBlockFn: () => form.state.isDirty && !form.state.isSubmitted, disabled: !isEditing, withResolver: true })` in all edit forms. Use `blocker.status === "blocked"` to render a custom pt-BR AlertDialog with `blocker.proceed()` / `blocker.reset()`.
```

**Add to Client-Side Patterns section:**
```markdown
**Hook selection:**

| Need | Hook |
|------|------|
| Single query | `useSuspenseQuery` |
| Multiple independent queries in same component | `useSuspenseQueries` — prevents waterfall |
| Conditional query | `useSuspenseQuery` + `skipToken` |
| Paginated query (no flicker on page change) | `useSuspenseQuery` + `placeholderData: keepPreviousData` |
| Subscribe to partial data | `useSuspenseQuery` + `select` option |

**Rules:**
- `useSuspenseQueries` when multiple independent queries in same component — never sequential `useSuspenseQuery` calls.
- `skipToken` as default for conditional queries — not `useQuery + enabled`.
- `placeholderData: keepPreviousData` required for all queries with `page`/`pageSize` input.
- Use `QueryBoundary` (not bare `ErrorBoundary + Suspense`) so retry resets the query cache.
- `useQuery + enabled` only when intentionally outside a `<Suspense>` boundary.
```

**Add/update Foxact Hooks section:**
```markdown
- Debounce callbacks → `useDebouncedCallback` from `@tanstack/react-pacer` (not `foxact/use-debounced-value`)
- Rate limit → `useRateLimiter` from `@tanstack/react-pacer`
```

**Commit:**
```bash
git add CLAUDE.md
git commit -m "docs(claude): document TanStack Form, Query, and Pacer advanced patterns"
```

**Final code review** — Dispatch `superpowers:code-reviewer` with the full branch diff:
```bash
BASE_SHA=$(git rev-parse origin/master)
HEAD_SHA=$(git rev-parse HEAD)
```
- `WHAT_WAS_IMPLEMENTED`: Full CLAUDE.md update documenting Form, Query, and Pacer patterns
- `DESCRIPTION`: Verify all new rules are accurate, no contradictions with existing rules, examples compile, hook table is complete

---

## Execution Order

| Priority | Task | Unblocks |
|----------|------|----------|
| 1 | A1 — FieldError string fix | A3, A4, A5 |
| 2 | A2 — Read oRPC error types | A3, A4, A5 |
| 3 | B1 — useActiveTeam parallel | standalone |
| 3 | C1-C3 — Pacer migration | standalone |
| 4 | A3-A5 — onSubmitAsync forms | A6, A7 |
| 4 | B2 — skipToken migration | standalone |
| 5 | B3 — keepPreviousData | standalone |
| 5 | A6 — selective Subscribe | standalone |
| 6 | B4 — QueryBoundary migration | standalone |
| 6 | A7 — useBlocker | standalone |
| 7 | C4 — useRateLimiter | standalone |
| 8 | D — CLAUDE.md | last |

Tracks B (Query) and C (Pacer) are fully independent of Track A (Form) and can run in parallel.

---

## Code Review Protocol

After every task commit, dispatch `superpowers:code-reviewer`. This is mandatory, not optional.

**How to get SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)
```

**Severity handling:**
- **Critical** — stop, fix immediately, recommit, re-review before proceeding
- **Important** — fix before starting the next task
- **Minor** — note for later, do not block progress

**Template for each review:**
```
WHAT_WAS_IMPLEMENTED: <what the task built>
PLAN_OR_REQUIREMENTS: Task <ID> from docs/plans/2026-04-09-tanstack-form-query-pacer-adoption.md
BASE_SHA: <previous commit>
HEAD_SHA: <current commit>
DESCRIPTION: <1-2 sentences about what to focus on>
```

**Cross-cutting things the reviewer should always check:**
- No `@core/*` imports in frontend files
- No `as` type casts introduced
- No `space-x-*` / `space-y-*` / margin utilities — only `gap-2` or `gap-4`
- No barrel file imports — direct source imports only
- No `useEffect` introduced where Pacer/form callbacks replace it
- Brazilian Portuguese in all user-facing strings

---

## CLAUDE.md Update Checklist

Before the final commit on Task D, verify every item below is covered in CLAUDE.md:

**TanStack Form section:**
- [ ] `FieldError` handles both `ZodIssue[]` and `string[]`
- [ ] `onSubmitAsync` as the pattern for server-side field errors (with `{ fields, form }` return shape)
- [ ] Form-level error display via `form.Subscribe selector={(state) => state.errors}`
- [ ] `selector` mandatory on all `form.Subscribe` — `as const` for tuples
- [ ] `useBlocker` with `withResolver: true` + `disabled: !isEditing` in all edit forms — custom AlertDialog for pt-BR confirmation, `proceed()`/`reset()` wired to actions

**TanStack Query section:**
- [ ] Hook selection table (single / parallel / conditional / paginated / partial)
- [ ] `useSuspenseQueries` for multiple independent queries — no sequential `useSuspenseQuery`
- [ ] `skipToken` over `useQuery + enabled`
- [ ] `keepPreviousData` required for page/pageSize queries
- [ ] `QueryBoundary` over bare `ErrorBoundary + Suspense`

**Foxact Hooks section:**
- [ ] `foxact/use-debounced-value` removed from table — replaced by `useDebouncedCallback` from Pacer
- [ ] `useRateLimiter` documented for rate-limiting user actions
