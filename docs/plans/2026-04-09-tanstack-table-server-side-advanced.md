# TanStack Table — Server-Side & Advanced Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix server-side manual mode bugs in all data tables and add column pinning, faceted filtering, typed columnMeta, and memoized column definitions.

**Architecture:** All changes flow through the single `DataTable` component in `packages/ui/src/components/data-table.tsx`. Feature tables add `manualSorting`/`manualFiltering` to their `useReactTable` call (currently missing, causing client-side re-sort/filter on already-paginated server data). Column pinning and faceted filtering are opt-in via new props. Column definitions are memoized at their call sites.

**Tech Stack:** TanStack Table v8, React, TypeScript, Tailwind, `foxact/create-local-storage-state`

> **Note on row expansion:** The data-table-pattern skill explicitly prohibits `renderSubComponent` / expandable rows in this app. Row expansion from the issue is **excluded** from this plan.

---

## Phase 1 — Critical Bug Fix: Manual Sorting & Filtering

### Task 1: Add `manualSorting` and `manualFiltering` to DataTable

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx`

**Context:**
Currently `useReactTable` uses `getSortedRowModel()` and `getFilteredRowModel()`, which means TanStack Table re-sorts and re-filters the already-paginated subset returned by the server. This produces wrong results. Since all sorting/filtering state changes trigger a server query (via URL params → `loaderDeps` → oRPC), we must tell TanStack Table to skip its own sort/filter logic.

**Step 1: Locate the `useReactTable` call**

Open `packages/ui/src/components/data-table.tsx` and find the `useReactTable({...})` call (around line 525). It currently includes:
```ts
getSortedRowModel: getSortedRowModel(),
getFilteredRowModel: getFilteredRowModel(),
```

**Step 2: Add manual flags and remove client-side models**

Replace the sorting and filtering entries:
```ts
// Before
getSortedRowModel: getSortedRowModel(),
getFilteredRowModel: getFilteredRowModel(),

// After — server owns sort/filter; client-side models removed
manualSorting: true,
manualFiltering: true,
```

> Keep `getExpandedRowModel` and `getCoreRowModel` — those are still needed.

**Step 3: Verify the imports**

After removing `getSortedRowModel` and `getFilteredRowModel` from usage, check if their imports are still referenced elsewhere in the file. Remove unused imports to avoid lint errors.

**Step 4: Build check**

```bash
cd packages/ui && bun run build
```
Expected: no TypeScript errors.

**Step 5: Commit**

```bash
git add packages/ui/src/components/data-table.tsx
git commit -m "fix(data-table): add manualSorting and manualFiltering to prevent client-side re-sort on server-paginated data"
```

---

### Task 2: Memoize column definitions in feature tables

**Files (check all of these — skip any already wrapped in `useMemo`):**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions/-transactions/transactions-list.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts.tsx` (or nearby `-contacts/` folder)
- Modify: any other table that calls a `build*Columns()` function without `useMemo`

**Context:**
Column definition objects are recreated on every render unless memoized. For tables that re-render frequently (sort/filter state changes), this causes TanStack Table to re-process all columns unnecessarily.

**Step 1: Find all `build*Columns` call sites**

```bash
grep -r "buildColumns\|buildTransactionColumns\|buildContactColumns\|buildBankAccountColumns\|build.*Columns" apps/web/src --include="*.tsx" -l
```

**Step 2: For each file — wrap in `useMemo`**

Pattern to apply at each call site:
```tsx
// Before
const columns = buildTransactionColumns();

// After
const columns = useMemo(() => buildTransactionColumns(), []);
```

If the builder takes arguments that come from component state/props, include them as deps:
```tsx
// Example with dependencies
const columns = useMemo(
  () => buildContactColumns({ onEdit, onDelete }),
  [onEdit, onDelete],
);
```

**Step 3: Build check**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/...
git commit -m "perf(tables): memoize column definitions to prevent unnecessary re-creation on render"
```

---

## Phase 2 — Column Pinning

### Task 3: Add column pinning support to DataTable

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx`

**Context:**
TanStack Table v8 supports column pinning natively. When `columnPinning` state is provided, pinned columns receive `getIsPinned()`, `getPinnedIndex()`, and sticky position info. We expose this as an optional prop.

**Step 1: Add `columnPinning` to `DataTableStoredState`**

Find the `DataTableStoredState` type (around line 100):
```ts
// Before
export type DataTableStoredState = {
  columnVisibility?: VisibilityState;
  columnOrder?: ColumnOrderState;
};

// After
export type DataTableStoredState = {
  columnVisibility?: VisibilityState;
  columnOrder?: ColumnOrderState;
  columnPinning?: ColumnPinningState;
};
```

Add `ColumnPinningState` to the imports from `@tanstack/react-table`.

**Step 2: Wire `columnPinning` into `useReactTable` state**

Inside `useReactTable({...})`, add to the `state` object:
```ts
columnPinning: tableState?.columnPinning ?? {},
```

Add `onColumnPinningChange` handler that persists to `tableState`:
```ts
onColumnPinningChange: (updater) => {
  onTableStateChange?.((prev) => ({
    ...prev,
    columnPinning: typeof updater === 'function'
      ? updater(prev?.columnPinning ?? {})
      : updater,
  }));
},
```

**Step 3: Apply sticky styles to pinned columns**

In the `<TableHead>` and `<TableCell>` render sections, add pinning styles:
```tsx
// Helper (add above the return statement)
function getPinningStyles(column: Column<unknown>): React.CSSProperties {
  const isPinned = column.getIsPinned();
  return isPinned
    ? {
        left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
        right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
        position: 'sticky',
        zIndex: 1,
      }
    : {};
}
```

Apply to header cells:
```tsx
<TableHead
  key={header.id}
  style={getPinningStyles(header.column)}
  className={cn(
    header.column.getIsPinned() && "bg-background shadow-sm",
    // existing classes...
  )}
>
```

Apply to body cells:
```tsx
<TableCell
  key={cell.id}
  style={getPinningStyles(cell.column)}
  className={cn(
    cell.column.getIsPinned() && "bg-background",
    // existing classes...
  )}
>
```

**Step 4: Build check**

```bash
cd packages/ui && bun run build
```

**Step 5: Commit**

```bash
git add packages/ui/src/components/data-table.tsx
git commit -m "feat(data-table): add column pinning support with sticky positioning"
```

---

### Task 4: Pin columns in transactions table

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions/-transactions/transactions-list.tsx`

**Context:**
Transactions have many columns. "Descrição" and "Valor" should be pinned so they remain visible when scrolling horizontally.

**Step 1: Add pinned columns to localStorage state**

Find the `createLocalStorageState` call for the transactions table:
```ts
const [tableState, setTableState] = createLocalStorageState<DataTableStoredState | null>(
  "montte:datatable:transactions",
  null,
);
```

The `columnPinning` will be stored here automatically via Task 3.

**Step 2: Set default pinning in the `DataTable` call**

Add default `columnPinning` via `tableState` initialization or pass it as an initial value. The cleanest approach is to set it as the `initialState` default. Since we persist via `tableState`, seed the initial value:

Find where `tableState` is read and add a default:
```tsx
// Seed default pinning if none stored yet
const effectiveTableState = tableState ?? {
  columnPinning: { left: ['select', 'description'], right: ['amount'] },
};
```

Pass `effectiveTableState` (not raw `tableState`) to the `DataTable`.

**Step 3: Build check + visual verification**

```bash
bun dev
```

Navigate to `/transactions` and verify description and amount columns stay fixed on horizontal scroll.

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions/-transactions/transactions-list.tsx
git commit -m "feat(transactions): pin description and amount columns for wide-screen horizontal scroll"
```

---

## Phase 3 — Faceted Filtering

### Task 5: Add faceted filter models to DataTable

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx`

**Context:**
`getFacetedRowModel`, `getFacetedUniqueValues`, and `getFacetedMinMaxValues` from TanStack Table enable filter UIs that show value counts (e.g., "income: 45", "expense: 120"). These are purely derived from the current data set and work alongside `manualFiltering: true` — they count values in the data the server returned for the current page/filter combination, which is still useful.

**Step 1: Import faceted models**

Add to the `@tanstack/react-table` import:
```ts
import {
  // existing...
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFacetedMinMaxValues,
} from "@tanstack/react-table";
```

**Step 2: Add to `useReactTable` config**

```ts
getFacetedRowModel: getFacetedRowModel(),
getFacetedUniqueValues: getFacetedUniqueValues(),
getFacetedMinMaxValues: getFacetedMinMaxValues(),
```

**Step 3: Build check**

```bash
cd packages/ui && bun run build
```

**Step 4: Commit**

```bash
git add packages/ui/src/components/data-table.tsx
git commit -m "feat(data-table): add faceted row/unique-value/min-max models for filter UI"
```

---

### Task 6: Add `filterVariant` to typed `columnMeta`

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx` (or a new `packages/ui/src/types/data-table.d.ts`)

**Context:**
TanStack Table's `ColumnMeta` interface can be augmented via module declaration merging. This lets column definitions declare a `filterVariant` that filter UI components can read to know which control to render (text input, select, date picker, etc.).

**Step 1: Add the module augmentation**

At the top of `packages/ui/src/components/data-table.tsx` (after imports), add:

```ts
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    filterVariant?: "text" | "select" | "range" | "date";
    align?: "left" | "center" | "right";
    exportable?: boolean;
  }
}
```

**Step 2: Use `align` meta in cell rendering**

Where `TableCell` is rendered, read `column.columnDef.meta?.align` to apply text alignment class:
```tsx
<TableCell
  className={cn(
    cell.column.columnDef.meta?.align === "right" && "text-right",
    cell.column.columnDef.meta?.align === "center" && "text-center",
    // existing classes
  )}
>
```

Apply same to `TableHead`.

**Step 3: Update transactions columns to use `align: "right"` for amount**

In `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions/-transactions/transactions-columns.tsx`:

Find the `amount` column definition and add:
```ts
{
  accessorKey: "amount",
  meta: {
    label: "Valor",
    align: "right",
    filterVariant: "range",
    exportable: true,
  },
  // ...existing cell/header
}
```

**Step 4: Build check**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add packages/ui/src/components/data-table.tsx
git add apps/web/src/routes/...
git commit -m "feat(data-table): add typed ColumnMeta augmentation with label, filterVariant, align, exportable"
```

---

## Phase 4 — CLAUDE.md Updates

### Task 7: Update CLAUDE.md with new DataTable rules

**Files:**
- Modify: `/home/yorizel/Documents/montte-nx/CLAUDE.md`

**Step 1: Find the "Data Table Pattern" section**

Locate the section starting with `## Data Table Pattern`.

**Step 2: Add the new mandatory rules**

After the existing required props list, add:

```markdown
**Server-side tables (all tables with paginated oRPC queries) MUST use:**
- `manualSorting: true` — prevents TanStack Table from re-sorting server-paginated data
- `manualFiltering: true` — prevents TanStack Table from re-filtering server-filtered data

**Column definitions MUST be memoized:**
```tsx
// ❌ Recreated every render
const columns = buildTransactionColumns();

// ✅ Memoized
const columns = useMemo(() => buildTransactionColumns(), []);
// If builder takes reactive args, include them as deps
```

**Typed `ColumnMeta`** — use `meta` on column definitions for label, filterVariant, alignment, and exportable flag. The type is globally augmented in `data-table.tsx`.

**Column pinning** — pass `columnPinning` in `tableState` (persisted via localStorage). Sticky styles applied automatically by DataTable.

**Faceted models** — `getFacetedUniqueValues()` is available on all columns. Use `column.getFacetedUniqueValues()` in filter components to show value counts.
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): document manualSorting/manualFiltering, memoization, columnMeta, and column pinning requirements"
```

---

## Execution Checklist

- [ ] Task 1: Add `manualSorting` + `manualFiltering` to DataTable (`packages/ui`)
- [ ] Task 2: Memoize column definitions at all call sites
- [ ] Task 3: Add column pinning support to DataTable
- [ ] Task 4: Apply default column pinning to transactions table
- [ ] Task 5: Add faceted filter models to DataTable
- [ ] Task 6: Add typed `ColumnMeta` augmentation + use `align` in rendering
- [ ] Task 7: Update CLAUDE.md
