# DataTable Composition Shell — MON-482

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a composition shell (`DataTableRoot`, `DataTableContent`, `DataTablePagination`, `DataTableEmptyState`, `DataTableSkeleton`) in `apps/web/src/components/data-table/` that wraps the existing `DataTable` from `@packages/ui` — eliminating per-page boilerplate while keeping existing usages untouched.

**Architecture:** `DataTableRoot` is a context provider that manages localStorage state via `storageKey` (column order/visibility/pinning + sorting + columnFilters when not URL-controlled). `DataTableContent` reads from context and renders `<DataTable>` from `@packages/ui`. `DataTableEmptyState` registers itself in context so `DataTableContent` hides when data is empty. `DataTableSkeleton` is a standalone component that generates skeleton rows from column definitions.

**Tech Stack:** React context, `foxact/use-local-storage` (dynamic key), `@tanstack/react-table` types, `@packages/ui/components/data-table` (existing component, not modified), Tailwind CSS, `@packages/ui/components/skeleton`

---

## Usage Pattern (target)

```tsx
// Before (per-page boilerplate)
const [useContactsTableState] = createLocalStorageState<DataTableStoredState | null>(
  "montte:datatable:contacts", null
);
// ... in component:
const [tableState, setTableState] = useContactsTableState();
if (data.length === 0) return <Empty>...</Empty>;
<DataTable
  columns={columns}
  data={data}
  getRowId={(row) => row.id}
  sorting={sorting}
  onSortingChange={handleSortingChange}
  columnFilters={columnFilters}
  onColumnFiltersChange={handleColumnFiltersChange}
  tableState={tableState}
  onTableStateChange={setTableState}
  pagination={{ currentPage, totalPages, totalCount, pageSize, onPageChange, onPageSizeChange }}
/>

// After (composition shell)
<DataTableRoot
  storageKey="montte:datatable:contacts"
  columns={columns}
  data={data}
  getRowId={(row) => row.id}
  sorting={sorting}
  onSortingChange={handleSortingChange}
  columnFilters={columnFilters}
  onColumnFiltersChange={handleColumnFiltersChange}
>
  <DataTableEmptyState>
    <Empty>...</Empty>
  </DataTableEmptyState>
  <DataTableContent />
</DataTableRoot>
<DataTablePagination
  currentPage={page}
  totalPages={totalPages}
  totalCount={total}
  pageSize={pageSize}
  onPageChange={handlePageChange}
  onPageSizeChange={handlePageSizeChange}
/>
```

---

## Task 1: Create context module

**Files:**
- Create: `apps/web/src/components/data-table/context.ts`

**What to build:**

```ts
import type {
  ColumnDef,
  ColumnFiltersState,
  OnChangeFn,
  Row,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import { createContext, useContext } from "react";

// Extended persisted state (superset of DataTableStoredState)
export type DataTablePersistedState = DataTableStoredState & {
  sorting?: SortingState;
  columnFilters?: ColumnFiltersState;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DataTableContextValue<TData = any, TValue = any> {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  getRowId: (row: TData) => string;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  tableState: DataTableStoredState | null;
  onTableStateChange: (state: DataTableStoredState) => void;
  hasEmptyState: boolean;
  registerEmptyState: () => void;
  unregisterEmptyState: () => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
  renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
  groupBy?: (row: TData) => string;
  renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
  getSubRows?: (row: TData) => TData[] | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DataTableContext = createContext<DataTableContextValue<any, any> | null>(null);

export function useDataTableContext<TData, TValue = unknown>(): DataTableContextValue<TData, TValue> {
  const ctx = useContext(DataTableContext);
  if (!ctx) throw new Error("useDataTableContext must be used within DataTableRoot");
  return ctx as DataTableContextValue<TData, TValue>;
}
```

**Step 1: Create file with above content**

**Step 2: Verify TypeScript compiles**

```bash
bun run typecheck 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add apps/web/src/components/data-table/context.ts
git commit -m "feat(data-table): add composition shell context"
```

---

## Task 2: Create DataTableRoot

**Files:**
- Create: `apps/web/src/components/data-table/data-table-root.tsx`

**What to build:**

```tsx
"use client";

import type { ColumnDef, ColumnFiltersState, OnChangeFn, Row, RowSelectionState, SortingState } from "@tanstack/react-table";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import { useLocalStorage } from "foxact/use-local-storage";
import { useCallback, useMemo, useState } from "react";
import { type DataTableContextValue, type DataTablePersistedState, DataTableContext } from "./context";

interface DataTableRootProps<TData, TValue> {
  children: React.ReactNode;
  storageKey: string;
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId: (row: TData) => string;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  columnFilters?: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  renderActions?: (props: { row: Row<TData> }) => React.ReactNode;
  renderExpandedRow?: (props: { row: Row<TData> }) => React.ReactNode;
  groupBy?: (row: TData) => string;
  renderGroupHeader?: (key: string, rows: Row<TData>[]) => React.ReactNode;
  getSubRows?: (row: TData) => TData[] | undefined;
}

export function DataTableRoot<TData, TValue>({
  children,
  storageKey,
  columns,
  data,
  getRowId,
  sorting: externalSorting,
  onSortingChange: externalOnSortingChange,
  columnFilters: externalColumnFilters,
  onColumnFiltersChange: externalOnColumnFiltersChange,
  rowSelection,
  onRowSelectionChange,
  renderActions,
  renderExpandedRow,
  groupBy,
  renderGroupHeader,
  getSubRows,
}: DataTableRootProps<TData, TValue>) {
  const [persisted, setPersisted] = useLocalStorage<DataTablePersistedState | null>(
    storageKey,
    null,
  );
  const [hasEmptyState, setHasEmptyState] = useState(false);

  const sorting: SortingState = externalSorting ?? persisted?.sorting ?? [];
  const columnFilters: ColumnFiltersState = externalColumnFilters ?? persisted?.columnFilters ?? [];

  const onSortingChange: OnChangeFn<SortingState> = useCallback(
    externalOnSortingChange ??
      ((updater) => {
        const next = typeof updater === "function" ? updater(sorting) : updater;
        setPersisted((prev) => ({ ...(prev ?? { columnOrder: [], columnVisibility: {} }), sorting: next }));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [externalOnSortingChange, sorting, setPersisted],
  );

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = useCallback(
    externalOnColumnFiltersChange ??
      ((updater) => {
        const next = typeof updater === "function" ? updater(columnFilters) : updater;
        setPersisted((prev) => ({ ...(prev ?? { columnOrder: [], columnVisibility: {} }), columnFilters: next }));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [externalOnColumnFiltersChange, columnFilters, setPersisted],
  );

  const tableState: DataTableStoredState | null = persisted
    ? {
        columnOrder: persisted.columnOrder ?? [],
        columnVisibility: persisted.columnVisibility ?? {},
        columnPinning: persisted.columnPinning,
      }
    : null;

  const onTableStateChange = useCallback(
    (state: DataTableStoredState) => {
      setPersisted((prev) => ({ ...(prev ?? {}), ...state }));
    },
    [setPersisted],
  );

  const registerEmptyState = useCallback(() => setHasEmptyState(true), []);
  const unregisterEmptyState = useCallback(() => setHasEmptyState(false), []);

  const value = useMemo<DataTableContextValue<TData, TValue>>(
    () => ({
      data,
      columns,
      getRowId,
      sorting,
      onSortingChange,
      columnFilters,
      onColumnFiltersChange,
      tableState,
      onTableStateChange,
      hasEmptyState,
      registerEmptyState,
      unregisterEmptyState,
      rowSelection,
      onRowSelectionChange,
      renderActions,
      renderExpandedRow,
      groupBy,
      renderGroupHeader,
      getSubRows,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      data, columns, getRowId, sorting, onSortingChange,
      columnFilters, onColumnFiltersChange, tableState, onTableStateChange,
      hasEmptyState, registerEmptyState, unregisterEmptyState,
      rowSelection, onRowSelectionChange, renderActions, renderExpandedRow,
      groupBy, renderGroupHeader, getSubRows,
    ],
  );

  return <DataTableContext.Provider value={value}>{children}</DataTableContext.Provider>;
}
```

**Note on `useCallback` with `??`**: The `??` inside `useCallback` is fine but the dependency array for the outer `useCallback` call needs to include `externalOnSortingChange`. Since the fallback function captures `sorting` via closure, `sorting` must be in deps. This is why the comment `// eslint-disable-next-line` is present — the eslint rule can't infer the conditional deps.

Actually, cleaner implementation — split into two separate callbacks:

```tsx
const handleSortingChange: OnChangeFn<SortingState> = useCallback(
  (updater) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setPersisted((prev) => ({ ...(prev ?? { columnOrder: [], columnVisibility: {} }), sorting: next }));
  },
  [sorting, setPersisted],
);

const onSortingChange = externalOnSortingChange ?? handleSortingChange;
```

Use this pattern for both sorting and columnFilters.

**Step 1: Create file**

**Step 2: Verify TypeScript**

```bash
bun run typecheck 2>&1 | head -30
```

**Step 3: Commit**

```bash
git add apps/web/src/components/data-table/data-table-root.tsx
git commit -m "feat(data-table): add DataTableRoot context provider"
```

---

## Task 3: Create DataTableContent

**Files:**
- Create: `apps/web/src/components/data-table/data-table-content.tsx`

**What to build:**

```tsx
"use client";

import { DataTable } from "@packages/ui/components/data-table";
import { useDataTableContext } from "./context";

export function DataTableContent<TData, TValue = unknown>() {
  const ctx = useDataTableContext<TData, TValue>();

  // When empty state slot is registered, hide table so empty state renders instead
  if (ctx.data.length === 0 && ctx.hasEmptyState) return null;

  return (
    <DataTable
      columns={ctx.columns}
      data={ctx.data}
      getRowId={ctx.getRowId}
      sorting={ctx.sorting}
      onSortingChange={ctx.onSortingChange}
      columnFilters={ctx.columnFilters}
      onColumnFiltersChange={ctx.onColumnFiltersChange}
      tableState={ctx.tableState}
      onTableStateChange={ctx.onTableStateChange}
      rowSelection={ctx.rowSelection}
      onRowSelectionChange={ctx.onRowSelectionChange}
      renderActions={ctx.renderActions}
      renderExpandedRow={ctx.renderExpandedRow}
      groupBy={ctx.groupBy}
      renderGroupHeader={ctx.renderGroupHeader}
      getSubRows={ctx.getSubRows}
    />
  );
}
```

**Step 1: Create file**

**Step 2: Verify TypeScript**

**Step 3: Commit**

```bash
git add apps/web/src/components/data-table/data-table-content.tsx
git commit -m "feat(data-table): add DataTableContent"
```

---

## Task 4: Create DataTableEmptyState

**Files:**
- Create: `apps/web/src/components/data-table/data-table-empty-state.tsx`

**What to build:**

```tsx
"use client";

import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useDataTableContext } from "./context";

interface DataTableEmptyStateProps {
  children: React.ReactNode;
}

export function DataTableEmptyState({ children }: DataTableEmptyStateProps) {
  const { data, registerEmptyState, unregisterEmptyState } = useDataTableContext();

  useIsomorphicLayoutEffect(() => {
    registerEmptyState();
    return unregisterEmptyState;
  }, [registerEmptyState, unregisterEmptyState]);

  if (data.length > 0) return null;
  return <>{children}</>;
}
```

**Why `useIsomorphicLayoutEffect`**: Registration must happen synchronously before first render so `DataTableContent` already knows `hasEmptyState = true` on the first paint (avoids flash of empty table).

**Step 1: Create file**

**Step 2: Verify TypeScript**

**Step 3: Commit**

```bash
git add apps/web/src/components/data-table/data-table-empty-state.tsx
git commit -m "feat(data-table): add DataTableEmptyState"
```

---

## Task 5: Create DataTablePagination

**Files:**
- Create: `apps/web/src/components/data-table/data-table-pagination.tsx`

**What to build:**

Standalone pagination — same UI as the internal `DataTablePagination` in `@packages/ui/components/data-table` (which is not exported). Copy the implementation and export it.

```tsx
"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@packages/ui/components/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { cn } from "@packages/ui/lib/utils";
import { useMemo } from "react";

export interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (currentPage <= 3) return [1, 2, 3, 4, 5];
  if (currentPage >= totalPages - 2)
    return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
  return Array.from({ length: 5 }, (_, i) => currentPage - 2 + i);
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: DataTablePaginationProps) {
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages || totalPages === 0;
  const hasSinglePage = totalPages <= 1;
  const pageNumbers = useMemo(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground hidden md:block">Exibindo</div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          {`Página ${currentPage} de ${totalPages}`}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Linhas por página
            </span>
            <Select
              onValueChange={(value) => onPageSizeChange(Number(value))}
              value={String(pageSize)}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent side="top">
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={isFirstPage || hasSinglePage}
                className={cn(
                  (isFirstPage || hasSinglePage) && "pointer-events-none opacity-50",
                )}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (!isFirstPage && !hasSinglePage) onPageChange(currentPage - 1);
                }}
              />
            </PaginationItem>
            {pageNumbers.map((pageNum) => (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  aria-disabled={hasSinglePage}
                  className={cn(hasSinglePage && "pointer-events-none opacity-50")}
                  href="#"
                  isActive={pageNum === currentPage}
                  onClick={(e) => {
                    e.preventDefault();
                    if (!hasSinglePage) onPageChange(pageNum);
                  }}
                >
                  {pageNum}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                aria-disabled={isLastPage || hasSinglePage}
                className={cn(
                  (isLastPage || hasSinglePage) && "pointer-events-none opacity-50",
                )}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (!isLastPage && !hasSinglePage) onPageChange(currentPage + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
```

**Step 1: Create file**

**Step 2: Verify TypeScript**

**Step 3: Commit**

```bash
git add apps/web/src/components/data-table/data-table-pagination.tsx
git commit -m "feat(data-table): add standalone DataTablePagination"
```

---

## Task 6: Create DataTableSkeleton

**Files:**
- Create: `apps/web/src/components/data-table/data-table-skeleton.tsx`

**What to build:**

```tsx
import type { ColumnDef } from "@tanstack/react-table";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@packages/ui/components/table";

interface DataTableSkeletonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<any, any>[];
  rows?: number;
}

export function DataTableSkeleton({ columns, rows = 5 }: DataTableSkeletonProps) {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table className="border-separate border-spacing-0">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            {/* checkbox */}
            <TableHead className="w-[40px] px-2">
              <Skeleton className="size-4" />
            </TableHead>
            {columns.map((_, i) => (
              <TableHead key={`skeleton-head-${i + 1}`}>
                <Skeleton className="h-4 w-24" />
              </TableHead>
            ))}
            {/* actions */}
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <TableRow key={`skeleton-row-${rowIdx + 1}`} className="bg-card">
              <TableCell className="w-[40px] px-2">
                <Skeleton className="size-4" />
              </TableCell>
              {columns.map((_, colIdx) => (
                <TableCell key={`skeleton-cell-${rowIdx + 1}-${colIdx + 1}`}>
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
              <TableCell className="w-0" />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 1: Create file**

**Step 2: Verify TypeScript**

**Step 3: Commit**

```bash
git add apps/web/src/components/data-table/data-table-skeleton.tsx
git commit -m "feat(data-table): add DataTableSkeleton"
```

---

## Final Verification

**Check all 6 files exist:**
```bash
ls apps/web/src/components/data-table/
```

Expected output:
```
context.ts
data-table-content.tsx
data-table-empty-state.tsx
data-table-pagination.tsx
data-table-root.tsx
data-table-skeleton.tsx
```

**Full typecheck passes:**
```bash
bun run typecheck
```

**Existing DataTable pages still work** — no changes to `@packages/ui/components/data-table.tsx` or any existing route files.

---

## Import Paths for Consumers

```ts
// Composition shell — always import from source (no barrel)
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";

// Existing (unchanged)
import { DataTable, type DataTableStoredState } from "@packages/ui/components/data-table";
```
