# DataTable Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor DataTable into a pure UI component — no internal storage logic — with all features always enabled, localStorage owned by call sites via `createLocalStorageState`, and sorting/filters controlled via URL search params at the route level.

**Architecture:** DataTable receives `tableState` (column order + visibility) and `onTableStateChange` as props — the call site creates the localStorage hook via `createLocalStorageState` at module level. Sorting and `columnFilters` become required controlled props, wired to TanStack Router `validateSearch` at each route. All boolean feature flags (`reorderColumns`, `reorderRows`, `enableRowSelection`, `storageKey`, `onColumnVisibilityChange`, `columnVisibility`) are removed.

**Tech Stack:** `foxact/create-local-storage-state`, `@tanstack/react-router` `validateSearch` + `useSearch`, `@dnd-kit`, `@tanstack/react-table`, Zod

---

## Task 1: Refactor `DataTable` component

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx`

### Step 1: Replace the props interface

Remove all optional feature flags and storage concerns. New interface:

```typescript
export type DataTableStoredState = {
  columnOrder: string[];
  columnVisibility: VisibilityState;
};

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId: (row: TData) => string;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  tableState: DataTableStoredState | null;
  onTableStateChange: (state: DataTableStoredState) => void;
  pagination?: DataTablePaginationProps;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (state: RowSelectionState) => void;
  renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactNode;
  groupBy?: (row: TData) => string;
  renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
}
```

Also add `OnChangeFn` to the `@tanstack/react-table` imports.

### Step 2: Rewrite the component body state section

Replace everything from the start of the function body through the `columnOrder` state with:

```typescript
export function DataTable<TData, TValue>({
  columns,
  data,
  getRowId,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  tableState,
  onTableStateChange,
  pagination,
  rowSelection: controlledRowSelection,
  onRowSelectionChange,
  renderActions,
  renderSubComponent,
  groupBy,
  renderGroupHeader,
}: DataTableProps<TData, TValue>) {
  const [internalRowSelection, setInternalRowSelection] =
    useState<RowSelectionState>({});

  const isControlled = controlledRowSelection !== undefined;
  const rowSelection = isControlled ? controlledRowSelection : internalRowSelection;
```

No `useLocalStorage`, no `useId`, no `instanceId`, no `lsPrefix`, no `storedColumnOrder`, no `storedColumnVisibility`.

### Step 3: Remove all feature-flag-derived booleans

Delete these lines entirely:
- `const useLocalVisibility = ...`
- `const effectiveColumnVisibility = useMemo(...)` — replace with direct read:

```typescript
const effectiveColumnVisibility: VisibilityState =
  tableState?.columnVisibility ?? {};
```

### Step 4: Update `handleColumnVisibilityChange`

```typescript
const handleColumnVisibilityChange = useCallback(
  (
    updaterOrValue:
      | VisibilityState
      | ((old: VisibilityState) => VisibilityState),
  ) => {
    const next =
      typeof updaterOrValue === "function"
        ? updaterOrValue(effectiveColumnVisibility)
        : updaterOrValue;
    onTableStateChange({
      columnOrder: columnOrder,
      columnVisibility: next,
    });
  },
  [effectiveColumnVisibility, onTableStateChange, columnOrder],
);
```

Note: `columnOrder` is used here — this callback must be defined after `columnOrder` state.

### Step 5: Remove `hasActionsColumn` flag and simplify `allColumns`

`__actions` column is always added (actions column always present):

```typescript
const allColumns = useMemo(() => {
  const base: ColumnDef<TData, TValue>[] = [...columns];
  const actionsCol: ColumnDef<TData, unknown> = {
    id: "__actions",
    header: () => null,
    cell: renderActions
      ? ({ row }) => (
          <div className="flex items-center justify-end gap-1">
            {renderActions({ row })}
          </div>
        )
      : undefined,
    enableSorting: false,
    enableHiding: false,
  };
  return [...base, actionsCol as ColumnDef<TData, TValue>];
}, [columns, renderActions]);
```

### Step 6: Simplify `columnOrder` state

No more stored order init from localStorage — read from `tableState` prop:

```typescript
const isFixedColumn = (id: string) =>
  id === "drag-handle" || id === "__actions";

const [columnOrder, setColumnOrder] = useState<string[]>(() => {
  const draggableIds = allColumns
    .filter((c) => !isFixedColumn(c.id ?? ""))
    .map((c) => c.id ?? "");
  if (tableState?.columnOrder) {
    return tableState.columnOrder.filter((id) => draggableIds.includes(id));
  }
  return draggableIds;
});

useEffect(() => {
  setColumnOrder((prev) => {
    const draggableIds = allColumns
      .filter((c) => !isFixedColumn(c.id ?? ""))
      .map((c) => c.id ?? "");
    const kept = prev.filter((id) => draggableIds.includes(id));
    const added = draggableIds.filter((id) => !prev.includes(id));
    return [...kept, ...added];
  });
}, [allColumns]);
```

### Step 7: Persist column order changes via `onTableStateChange`

Replace the `columnOrderMounted` ref + effect with a simpler effect that only fires after mount:

```typescript
const columnOrderMounted = useRef(false);
useEffect(() => {
  if (!columnOrderMounted.current) {
    columnOrderMounted.current = true;
    return;
  }
  onTableStateChange({
    columnOrder,
    columnVisibility: effectiveColumnVisibility,
  });
}, [columnOrder]);
```

### Step 8: Update `useReactTable` call

```typescript
const table = useReactTable({
  columns: allColumns,
  data,
  enableRowSelection: true,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getRowId: (originalRow) => getRowId(originalRow),
  getSortedRowModel: getSortedRowModel(),
  onColumnFiltersChange,
  onColumnVisibilityChange: handleColumnVisibilityChange,
  onRowSelectionChange: handleRowSelectionChange,
  onSortingChange,
  onColumnOrderChange: setColumnOrder,
  state: {
    columnFilters,
    columnVisibility: effectiveColumnVisibility,
    rowSelection,
    sorting,
    columnOrder,
  },
});
```

### Step 9: Update header rendering

`__actions` header always renders the `ColumnVisibilityToggle`. Remove all `onColumnVisibilityChange || useLocalVisibility` conditionals:

```typescript
if (header.column.id === "__actions") {
  return (
    <TableHead className="w-0" key={header.id}>
      <div className="flex items-center justify-end">
        <ColumnVisibilityToggle
          columnVisibility={effectiveColumnVisibility}
          onColumnVisibilityChange={handleColumnVisibilityChange}
          table={table}
        />
      </div>
    </TableHead>
  );
}
```

### Step 10: Clean up unused imports

Remove: `useLocalStorage` from `foxact/use-local-storage`, `useId`.
Keep: `useIsomorphicLayoutEffect`, `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`.

### Step 11: Verify typecheck passes

```bash
bun run typecheck --projects=packages/ui
```

Expected: no errors.

---

## Task 2: Update `categories.tsx`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

### Step 1: Add `validateSearch` to the route

```typescript
import { z } from "zod";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import type { SortingState, ColumnFiltersState } from "@tanstack/react-table";

const categoriesSearchSchema = z.object({
  sorting: z
    .array(z.object({ id: z.string(), desc: z.boolean() }))
    .optional()
    .default([]),
  columnFilters: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .optional()
    .default([]),
});

const [useCategoriesTableState] = createLocalStorageState<DataTableStoredState | null>(
  "montte:datatable:categories",
  null,
);

export const Route = createFileRoute(
  "/_authenticated/$slug/$teamSlug/_dashboard/categories",
)({
  validateSearch: categoriesSearchSchema,
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(orpc.categories.getAll.queryOptions({}));
  },
  component: CategoriesPage,
});
```

### Step 2: Wire search params and tableState in `CategoriesList`

```typescript
function CategoriesList({ filters }: CategoriesListProps) {
  const navigate = Route.useNavigate();
  const { sorting, columnFilters } = Route.useSearch();
  const [tableState, setTableState] = useCategoriesTableState();

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    navigate({ search: (prev) => ({ ...prev, sorting: next }) });
  };

  const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) => {
    const next =
      typeof updater === "function" ? updater(columnFilters) : updater;
    navigate({ search: (prev) => ({ ...prev, columnFilters: next }) });
  };

  // ... existing query + mutations ...

  return (
    <>
      <DataTable
        columns={columns}
        data={categories}
        getRowId={(row) => row.id}
        sorting={sorting as SortingState}
        onSortingChange={handleSortingChange}
        columnFilters={columnFilters as ColumnFiltersState}
        onColumnFiltersChange={handleColumnFiltersChange}
        tableState={tableState}
        onTableStateChange={setTableState}
        groupBy={(row) => row.type ?? "other"}
        renderGroupHeader={(key) => {
          if (key === "income") return "Receitas";
          if (key === "expense") return "Despesas";
          return "Outros";
        }}
        rowSelection={rowSelection}
        onRowSelectionChange={onRowSelectionChange}
        renderActions={({ row }) => { /* existing actions */ }}
      />
      {/* SelectionActionBar */}
    </>
  );
}
```

### Step 3: Verify typecheck

```bash
bun run typecheck --projects=apps/web
```

---

## Task 3: Update `transactions-list.tsx`

**Files:**
- Modify: `apps/web/src/features/transactions/ui/transactions-list.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx` (add validateSearch)

### Step 1: Add `validateSearch` to the transactions route

Find the transactions route file and add the same `categoriesSearchSchema` pattern with a `transactionsSearchSchema`. Check existing search params on this route first — it may already have some (filters are currently prop-based via `TransactionFilters`).

```typescript
const transactionsSearchSchema = z.object({
  // preserve existing search params
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

### Step 2: Add `createLocalStorageState` at module level in `transactions-list.tsx`

```typescript
import { createLocalStorageState } from "foxact/create-local-storage-state";
import type { DataTableStoredState } from "@packages/ui/components/data-table";

const [useTransactionsTableState] = createLocalStorageState<DataTableStoredState | null>(
  "montte:datatable:transactions",
  null,
);
```

### Step 3: Wire props in `TransactionsList`

Pass `sorting`, `onSortingChange`, `columnFilters`, `onColumnFiltersChange`, `tableState`, `onTableStateChange` to `<DataTable>`. Remove `storageKey` prop (no longer exists).

---

## Task 4: Update remaining call sites (bulk)

**Files** (each needs the same treatment):
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/tags.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/contacts.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/goals.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bills.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/members.tsx`
- `apps/web/src/features/billing/ui/billing-usage.tsx`
- `apps/web/src/features/billing/ui/billing-spend.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/insights/index.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/analytics/data-management/event-definitions.tsx`
- `apps/web/src/features/analytics/ui/event-catalog-table.tsx`

### Pattern for each route file

1. Add `validateSearch` with `sortingSchema` (can define once and import from a shared location in `features/` if the same shape)
2. Add `createLocalStorageState` at module level with unique key `"montte:datatable:<feature>"`
3. In the list component, read `sorting`/`columnFilters` from `Route.useSearch()`, create navigate handlers, read `tableState` from the hook
4. Pass all four new required props + `tableState`/`onTableStateChange` to `<DataTable>`
5. Remove `enableRowSelection` prop (no longer exists — row selection is always on)
6. Add `getRowId` if missing (`inventory`, `event-definitions` were missing it — use `(row) => row.id` or whatever the stable identifier is)

### Pattern for feature files (billing-usage, billing-spend, event-catalog-table)

These are not routes — they don't have access to `Route.useSearch()`. For these:
- `sorting` starts as `useState<SortingState>([])` — local state, not URL
- `columnFilters` starts as `useState<ColumnFiltersState>([])` — local state, not URL
- `tableState` from `createLocalStorageState` at module level
- Pass all props normally

### Step: After all files updated, typecheck everything

```bash
bun run typecheck
```

Expected: no errors across all packages.

---

## Task 5: Remove `editable-dashboard-grid.tsx` usage (analytics)

**Files:**
- Modify: `apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx`

This file uses DataTable too. Apply the same feature-file pattern (local useState for sorting/filters, createLocalStorageState for tableState).

---

## Task 6: Final cleanup

### Step 1: Delete unused exports from data-table.tsx

Remove any dead code left over from the refactor (e.g. `ColumnVisibilityToggle` if it was only used internally and is now always rendered).

### Step 2: Run full typecheck + lint

```bash
bun run typecheck
bun run check
```

### Step 3: Commit

```bash
git add -p
git commit -m "refactor(ui): simplify DataTable — all features always-on, storage at call site"
```
