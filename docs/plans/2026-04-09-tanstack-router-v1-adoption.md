# TanStack Router v1 — Complete API Adoption

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Adopt all recommended TanStack Router v1 APIs and patterns: `loaderDeps`, `pendingComponent`, `errorComponent`, `autoCodeSplitting`, router config fixes, and `declare module` type registration.

**Architecture:** Incrementally update each route file and the router config. No new abstractions — just use the TanStack Router APIs directly. The `tableSearchSchema` already exists in `apps/web/src/lib/table-search-schema.ts` but its fields lack `.catch()` — fix that first so all downstream routes are safe.

**Tech Stack:** TanStack Router v1, TanStack Start (SSR), oRPC, TanStack Query, Vite

---

## Task 1: Fix router.tsx — add missing config options + type declaration

**Files:**
- Modify: `apps/web/src/router.tsx`

**Context:** The router is missing `defaultPreloadStaleTime: 0` (critical when using TanStack Query — prevents a duplicate 30s cache that competes with TQ), `scrollRestoration: true`, `defaultStructuralSharing: true`, and the `declare module` type registration. The `declare module` block belongs at the bottom of router.tsx. Note: `setupRouterSsrQueryIntegration` likely already handles some SSR concerns — don't remove it.

**Step 1: Update createRouter call and add declare module**

Open `apps/web/src/router.tsx`. Replace the `createRouter({...})` call:

```typescript
const router = createRouter({
   routeTree,
   context: {
      ...rqContext,
   },
   defaultPreload: "intent",
   defaultPreloadStaleTime: 0,
   defaultNotFoundComponent: NotFound,
   scrollRestoration: true,
   defaultStructuralSharing: true,
});
```

Then add at the very bottom of the file (after the `getRouter` function export):

```typescript
declare module "@tanstack/react-router" {
   interface Register {
      router: ReturnType<typeof getRouter>;
   }
}
```

**Step 2: Typecheck**

```bash
bun run typecheck
```

Expected: no new errors

**Step 3: Commit**

```bash
git add apps/web/src/router.tsx
git commit -m "feat(web): add missing router config options and type registration"
```

---

## Task 2: Enable autoCodeSplitting in Vite plugin

**Files:**
- Modify: `apps/web/vite.config.ts`

**Context:** `tanstackStart()` wraps `TanStackRouterVite` internally. Check if it accepts `autoCodeSplitting` via options. If it does, enable it — all routes automatically get code-split without needing `.lazy.tsx` files.

**Step 1: Check tanstackStart signature**

```bash
grep -r "autoCodeSplitting" node_modules/@tanstack/react-start/dist --include="*.d.ts" -l 2>/dev/null | head -3
grep -r "autoCodeSplitting" node_modules/@tanstack/router-plugin/dist --include="*.d.ts" -l 2>/dev/null | head -3
```

**Step 2: If supported, update vite.config.ts**

Replace `tanstackStart()` with:

```typescript
tanstackStart({
   tsr: {
      autoCodeSplitting: true,
   },
}),
```

If not supported by `tanstackStart`, leave as-is and note it — the issue's `createLazyFileRoute` approach is the manual fallback.

**Step 3: Dev server smoke test**

```bash
bun dev &
sleep 10
kill %1
```

Expected: starts without errors

**Step 4: Commit**

```bash
git add apps/web/vite.config.ts
git commit -m "feat(web): enable autoCodeSplitting in TanStack Router Vite plugin"
```

---

## Task 3: Fix tableSearchSchema — add .catch() to all fields

**Files:**
- Modify: `apps/web/src/lib/table-search-schema.ts`

**Context:** The schema is used by contacts, categories, tags, bank-accounts, credit-cards, insights routes. Without `.catch()`, an invalid URL param (e.g., from an external link) causes a parse error instead of falling back to defaults.

**Step 1: Update table-search-schema.ts**

Current content:
```typescript
import { z } from "zod";

export const tableSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .optional()
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .optional()
      .default([]),
});
```

Replace with:
```typescript
import { z } from "zod";

export const tableSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
});
```

**Step 2: Typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/table-search-schema.ts
git commit -m "fix(web): add .catch() to tableSearchSchema fields for invalid URL param safety"
```

---

## Task 4: Migrate transactions pagination to URL search params + loaderDeps

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`

**Context:**
- `TransactionFilters` (defined in `transaction-filter-bar.tsx`) includes `page`, `pageSize`, `dateFrom`, `dateTo`, and other filter fields — all currently in local `useState`
- `TransactionsList` uses `filters.page` and `filters.pageSize` in its `useSuspenseQuery` call
- The loader hardcodes `page: 1, pageSize: 20` — it never re-runs when the user changes pages because `loaderDeps` is missing
- Goal: move `page` and `pageSize` out of local state and into `validateSearch` URL params. The rest of the filters (date, type, search, etc.) stay as local state for now.
- The pattern: read `page`/`pageSize` from `Route.useSearch()`, merge them into the `filters` object before passing to `TransactionsList`, and navigate (instead of `setFilters`) for page/pageSize changes.

**Step 1: Update transactionsSearchSchema**

In `transactions.tsx`, find the `transactionsSearchSchema` const and add `page` and `pageSize`:

```typescript
const transactionsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});
```

Also remove the unused `type TransactionsSearch` declaration (it's inferred by the router).

**Step 2: Update Route definition — add loaderDeps, pendingComponent, head**

Replace the `export const Route = createFileRoute(...)({...})` block:

```typescript
export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/transactions",
)({
   validateSearch: transactionsSearchSchema,
   loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(orpc.tags.getAll.queryOptions({}));
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.transactions.getAll.queryOptions({
            input: { page: deps.page, pageSize: deps.pageSize },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.transactions.getSummary.queryOptions({
            input: {
               dateFrom: DEFAULT_FILTERS.dateFrom,
               dateTo: DEFAULT_FILTERS.dateTo,
            },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: TransactionsSkeleton,
   head: () => ({
      meta: [{ title: "Lançamentos — Montte" }],
   }),
   component: TransactionsPage,
});
```

**Step 3: Update TransactionsPage — read page/pageSize from search, navigate on change**

In `TransactionsPage`, make these changes:

1. Destructure `page` and `pageSize` from `Route.useSearch()`:
```typescript
const { sorting, columnFilters, page, pageSize } = Route.useSearch();
```

2. Build the merged filters object to pass to `TransactionsList` (replaces using `filters` directly for pagination):
```typescript
const filtersWithPagination = { ...filters, page, pageSize };
```

3. Update `onPageChange` — replace `setFilters` call with `navigate`:
```typescript
onPageChange={(newPage) =>
   navigate({
      search: (prev) => ({ ...prev, page: newPage }),
      replace: true,
   })
}
```

4. Update `onPageSizeChange` — replace `setFilters` call with `navigate`:
```typescript
onPageSizeChange={(newPageSize) =>
   navigate({
      search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }),
      replace: true,
   })
}
```

5. Pass `filtersWithPagination` instead of `filters` to `TransactionsList`:
```typescript
<TransactionsList
   columnFilters={columnFilters}
   filters={filtersWithPagination}
   onColumnFiltersChange={handleColumnFiltersChange}
   onPageChange={...}
   onPageSizeChange={...}
   onSortingChange={handleSortingChange}
   sorting={sorting}
/>
```

Also remove the `TransactionFilters` import from the type annotation if `filters` state type can be inferred — or keep it, no type casting needed since `filtersWithPagination` is `TransactionFilters & { page: number, pageSize: number }` which is compatible.

**Step 4: Typecheck**

```bash
bun run typecheck
```

Fix any type errors. The `TransactionFilters` type has `page: number` and `pageSize: number` so spreading works cleanly.

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/transactions.tsx
git commit -m "feat(web): migrate transactions pagination to URL search params with loaderDeps"
```

---

## Task 5: Add pendingComponent + head to contacts route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts.tsx`

**Context:** No pagination via search params in this route — `loaderDeps` not needed. Add `pendingComponent` using the existing `ContactsSkeleton` and `head` for tab title.

**Step 1: Read the Route definition**

```bash
grep -B 2 -A 10 "export const Route" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/contacts.tsx
```

**Step 2: Update Route definition**

Add `pendingMs: 300`, `pendingComponent: ContactsSkeleton`, and `head`:

```typescript
export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts",
)({
   validateSearch: tableSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.contacts.getAll.queryOptions({}));
   },
   pendingMs: 300,
   pendingComponent: ContactsSkeleton,
   head: () => ({
      meta: [{ title: "Contatos — Montte" }],
   }),
   component: ContactsPage,
});
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/contacts.tsx
git commit -m "feat(web): add pendingComponent and head to contacts route"
```

---

## Task 6: Add pendingComponent + head to categories route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Step 1: Read the Route definition**

```bash
grep -B 2 -A 10 "export const Route" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
```

**Step 2: Update Route definition**

Add `pendingMs: 300`, `pendingComponent: CategoriesSkeleton`, and `head`.

```typescript
export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/categories",
)({
   validateSearch: categoriesSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: CategoriesSkeleton,
   head: () => ({
      meta: [{ title: "Categorias — Montte" }],
   }),
   component: CategoriesPage,
});
```

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(web): add pendingComponent and head to categories route"
```

---

## Task 7: Add pendingComponent + head to tags route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/tags.tsx`

**Step 1: Read the Route definition**

```bash
grep -B 2 -A 10 "export const Route" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/tags.tsx
```

**Step 2: Update Route definition**

Add `pendingMs: 300`, `pendingComponent: TagsSkeleton`, and `head`.

```typescript
export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/tags",
)({
   validateSearch: tagsSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.tags.getAll.queryOptions({}));
   },
   pendingMs: 300,
   pendingComponent: TagsSkeleton,
   head: () => ({
      meta: [{ title: "Centros de Custo — Montte" }],
   }),
   component: TagsPage,
});
```

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/tags.tsx
git commit -m "feat(web): add pendingComponent and head to tags (Centros de Custo) route"
```

---

## Task 8: Add pendingComponent + head to bank-accounts route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx`

**Step 1: Read the Route definition**

```bash
grep -B 2 -A 10 "export const Route" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/bank-accounts.tsx
```

**Step 2: Update Route definition**

```typescript
export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts",
)({
   validateSearch: bankAccountsSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: BankAccountsSkeleton,
   head: () => ({
      meta: [{ title: "Contas Bancárias — Montte" }],
   }),
   component: BankAccountsPage,
});
```

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/bank-accounts.tsx
git commit -m "feat(web): add pendingComponent and head to bank-accounts route"
```

---

## Task 9: Add pendingComponent + head to bills route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bills.tsx`

**Step 1: Read the Route definition**

```bash
grep -B 2 -A 15 "export const Route" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/bills.tsx
```

**Step 2: Update Route definition**

Add `pendingMs: 300`, `pendingComponent: BillsSkeleton`, `head`. Keep both prefetchQuery calls.

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/bills.tsx
git commit -m "feat(web): add pendingComponent and head to bills route"
```

---

## Task 10: Add pendingComponent + head to inventory route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`

**Step 1: Read the Route definition**

```bash
grep -B 2 -A 12 "export const Route" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/index.tsx
```

**Step 2: Update Route definition**

Add `pendingMs: 300`, `pendingComponent` (find or create `InventorySkeleton` — check if it exists in the file), `head`.

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/index.tsx
git commit -m "feat(web): add pendingComponent and head to inventory route"
```

---

## Task 11: Add pendingComponent + head to analytics/insights route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/index.tsx`

**Step 1: Read the Route definition**

```bash
grep -B 2 -A 12 "export const Route" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/analytics/insights/index.tsx
```

**Step 2: Update Route definition**

Add `pendingMs: 300`, find skeleton component in file, add `head`.

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/analytics/insights/index.tsx
git commit -m "feat(web): add pendingComponent and head to insights route"
```

---

## Task 12: Add head() to remaining dashboard routes (home, goals, credit-cards, billing)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/home/*.tsx` (check structure)
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/goals.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/billing.tsx`

**Step 1: Read each Route definition**

```bash
for f in goals.tsx credit-cards.tsx billing.tsx; do
  echo "=== $f ==="; grep -A 12 "export const Route" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/$f
done
ls apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/home/
```

**Step 2: Add head() to each Route**

For each route, add:
```typescript
head: () => ({
   meta: [{ title: "<Portuguese page name> — Montte" }],
}),
```

Portuguese names: `goals.tsx` → "Metas Financeiras", `credit-cards.tsx` → "Cartões de Crédito", `billing.tsx` → "Assinatura"

**Step 3: Typecheck + commit**

```bash
bun run typecheck
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/goals.tsx apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/credit-cards.tsx apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/billing.tsx
git commit -m "feat(web): add head() with page titles to remaining dashboard routes"
```

---

## Task 13: Update CLAUDE.md with new TanStack Router patterns

**Files:**
- Modify: `CLAUDE.md`

**Context:** Add the new rules to the "Routes (TanStack Router — file-based)" section so future engineers use these patterns by default.

**Step 1: Read the current Routes section in CLAUDE.md**

Find the "Routes (TanStack Router — file-based)" section.

**Step 2: Append new rules after the conventions line**

Add after the existing Routes section content:

```markdown
**Required patterns:**
- `loaderDeps` is mandatory when the loader uses any search params — without it, the loader won't re-execute when params change
- `pendingMs: 300` + `pendingComponent` on all routes with loaders that do prefetch
- `errorComponent` on routes that use blocking `ensureQueryData` in the loader
- `validateSearch` must always use `.catch()` on fields with defaults to prevent parse errors from invalid URL params
- `head()` required on every route for dynamic tab title (Brazilian Portuguese, format: `"Page Name — Montte"`)
- `autoCodeSplitting: true` is configured in `vite.config.ts` — no manual `.lazy.tsx` files needed

**Complete route pattern:**
```typescript
export const Route = createFileRoute('/feature')({
   validateSearch: z.object({
      page: z.number().int().catch(1),
      search: z.string().catch(''),
   }),
   loaderDeps: ({ search: { page, search } }) => ({ page, search }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.feature.getAll.queryOptions({ input: deps }),
      );
   },
   pendingMs: 300,
   pendingComponent: FeatureSkeleton,
   head: () => ({ meta: [{ title: 'Feature — Montte' }] }),
   component: FeaturePage,
});
```
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with TanStack Router v1 required patterns"
```

---

## Notes on pagination in other routes

After auditing all dashboard routes, **only `transactions.tsx` has actual server-side pagination** (page/pageSize). The other routes — contacts, categories, tags, bank-accounts, credit-cards, inventory, insights, bills — all call `getAll` without pagination and render all results client-side. There is no page/pageSize state to migrate in those routes.

### Future refactoring: all DataTable routes must adopt URL-based pagination

**Every route that renders a `<DataTable>` must eventually adopt the same URL-based pagination pattern established in Task 4.**

The complete pattern for routes that will add server-side pagination:

```typescript
// 1. validateSearch includes page + pageSize with .catch()
const featureSearchSchema = z.object({
   sorting: z.array(z.object({ id: z.string(), desc: z.boolean() })).catch([]).default([]),
   columnFilters: z.array(z.object({ id: z.string(), value: z.unknown() })).catch([]).default([]),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

// 2. loaderDeps makes loader reactive to page/pageSize changes
export const Route = createFileRoute('/feature')({
   validateSearch: featureSearchSchema,
   loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.feature.getAll.queryOptions({ input: { page: deps.page, pageSize: deps.pageSize } }),
      );
   },
   pendingMs: 300,
   pendingComponent: FeatureSkeleton,
   head: () => ({ meta: [{ title: 'Feature — Montte' }] }),
   component: FeaturePage,
});

// 3. Component reads page/pageSize from URL, navigates on change
function FeaturePage() {
   const { sorting, columnFilters, page, pageSize } = Route.useSearch();
   const navigate = Route.useNavigate();

   // page/pageSize changes go to URL, not local state
   const handlePageChange = (newPage: number) =>
      navigate({ search: (prev) => ({ ...prev, page: newPage }), replace: true });
   const handlePageSizeChange = (newPageSize: number) =>
      navigate({ search: (prev) => ({ ...prev, pageSize: newPageSize, page: 1 }), replace: true });
}
```

Routes pending this refactoring (requires server-side pagination added to their oRPC procedure first):
- `contacts.tsx` — `orpc.contacts.getAll`
- `categories.tsx` — `orpc.categories.getAll`
- `tags.tsx` — `orpc.tags.getAll`
- `bank-accounts.tsx` — `orpc.bankAccounts.getAll`
- `credit-cards.tsx` — `orpc.creditCards.getAll`
- `inventory/index.tsx` — `orpc.inventory.getProducts`
- `analytics/insights/index.tsx` — `orpc.insights.list`
- `bills.tsx` — `orpc.bills.getAll`

---

## Notes on what was NOT implemented

- **`useBlocker`** for dirty forms: The issue mentions this but it requires identifying specific form components (transaction edit, service edit, contact edit forms). This is a separate scope — create a follow-up issue for each form.
- **`errorComponent` at route level**: Only meaningful for routes using `ensureQueryData` (blocking loaders). Currently all loaders use fire-and-forget `prefetchQuery`, so errors are handled by `<ErrorBoundary>` inside components, which is correct. Add `errorComponent` only when adding a blocking `ensureQueryData` loader.
- **Per-route `loaderDeps` for pagination**: After inspecting the routes, none use search params for pagination — they use local state or component-level state. The `tableSearchSchema` only handles `sorting` and `columnFilters` (not `page`/`pageSize`). So `loaderDeps` is only needed when a route actually prefetches based on search params.
