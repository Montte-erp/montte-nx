# Data Table Refactor Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the duplicated data-view/data-table into atomic composable pieces — a URL-paginated DataTable for routes and a virtualized DataTable for the import wizard.

**Architecture:**
- `packages/ui/data-table.tsx` stays as a dumb primitive; gets `toolbar` + `toolbarActions` slots.
- `data-view/data-table.tsx` wraps it, adds URL pagination (reads `page`/`pageSize` from URL via `useSearch({ strict: false })`, navigates on change), export and import buttons.
- `data-view/data-table-virtual.tsx` is a new lightweight virtualized table (TanStack Virtual, no pagination, no DnD, no selection) for the import wizard's MappingBody.
- Shared types extracted to `data-view/data-table-types.ts` to avoid circular deps.

**Tech Stack:** TanStack Router (`useSearch`, `useNavigate`), TanStack Virtual (`useVirtualizer`), TanStack Table, DnD Kit, `@packages/ui/components/data-table`

---

## Task 1 — Add `toolbar` and `toolbarActions` to packages/ui DataTable

**Files:**
- Modify: `packages/ui/src/components/data-table.tsx`

**Step 1:** Add two new optional props to `DataTableProps`:
```typescript
toolbar?: React.ReactNode;
toolbarActions?: React.ReactNode;
```

**Step 2:** Add the toolbar bar to the render output (above the DndContext), replacing the `ColumnVisibilityToggle` in the `__actions` header:
```tsx
<div className="flex items-center gap-4 px-4 py-2.5 bg-background border border-border rounded-lg">
  <div className="flex-1 min-w-0">{toolbar}</div>
  <div className="flex items-center gap-2 shrink-0">
    {toolbarActions}
    <ColumnVisibilityToggle
      columnVisibility={effectiveColumnVisibility}
      onColumnVisibilityChange={handleColumnVisibilityChange}
      table={table}
    />
  </div>
</div>
```

**Step 3:** In `DataTableHeaderRow`, change the `__actions` column handler from rendering `ColumnVisibilityToggle` to returning an empty `<TableHead className="w-0" key={header.id} />` (matches data-view version).

**Step 4:** Remove `effectiveColumnVisibility` and `onColumnVisibilityChange` params from `DataTableHeaderRow` since it no longer needs them.

**Step 5:** Export `DataTableProps` (add `export` keyword) so data-view can extend it.

**Step 6:** Run typecheck:
```bash
bun run typecheck
```
Expected: no new errors.

**Step 7:** Commit:
```bash
git add packages/ui/src/components/data-table.tsx
git commit -m "feat(ui): add toolbar/toolbarActions slots to DataTable"
```

---

## Task 2 — Extract shared types to data-table-types.ts

**Files:**
- Create: `apps/web/src/features/data-view/data-table-types.ts`

**Step 1:** Create the file with types currently defined in `data-view/data-table.tsx`:
```typescript
export type ImportableColumn = {
  key: string;
  label: string;
  required: boolean;
  fieldPatterns: string[];
  editType?: "text" | "money" | "combobox";
  editOptions?: { value: string; label: string }[];
};

export type ParsedRow = Record<string, string>;

export type ImportConfig<T extends ParsedRow = ParsedRow> = {
  label: string;
  onImport: (rows: T[]) => Promise<{ imported: number }>;
};
```

**Step 2:** Update `import-credenza.tsx` to import from the new file:
```typescript
// Before:
import type { ImportConfig, ImportableColumn, ParsedRow } from "@/features/data-view/data-table";
// After:
import type { ImportConfig, ImportableColumn, ParsedRow } from "@/features/data-view/data-table-types";
```

**Step 3:** Run typecheck. Commit:
```bash
git add apps/web/src/features/data-view/data-table-types.ts apps/web/src/features/data-view/import-credenza.tsx
git commit -m "refactor(data-view): extract import types to data-table-types"
```

---

## Task 3 — Extract DataTableExportButton

**Files:**
- Create: `apps/web/src/features/data-view/data-table-export.tsx`

**Step 1:** Move `DataTableExportButton` component from `data-view/data-table.tsx` to the new file. Keep all its imports (xlsx, @f-o-t/csv, useFileDownload, DropdownMenu components).

```typescript
import type { ColumnDef } from "@tanstack/react-table";
// ... other imports

export function DataTableExportButton<TData, TValue>({
  filename,
  data,
  columns,
}: {
  filename: string;
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
}) { ... }
```

**Step 2:** Delete `DataTableExportButton` from `data-view/data-table.tsx`. Add import:
```typescript
import { DataTableExportButton } from "./data-table-export";
```

**Step 3:** Typecheck. Commit:
```bash
git add apps/web/src/features/data-view/data-table-export.tsx apps/web/src/features/data-view/data-table.tsx
git commit -m "refactor(data-view): extract DataTableExportButton"
```

---

## Task 4 — Extract DataTableImportButton

**Files:**
- Create: `apps/web/src/features/data-view/data-table-import.tsx`

**Step 1:** Move `DataTableImportButton` to the new file. It imports from `./data-table-types` (not `./data-table` — avoids circular dep):
```typescript
import type { ColumnDef } from "@tanstack/react-table";
import type { ImportableColumn, ImportConfig } from "./data-table-types";
import { ImportCredenza } from "./import-credenza";
import { useCredenza } from "@/hooks/use-credenza";
// ... button imports

export function DataTableImportButton<TData, TValue>({
  columns,
  config,
}: {
  columns: ColumnDef<TData, TValue>[];
  config: ImportConfig;
}) { ... }
```

**Step 2:** Delete `DataTableImportButton` from `data-view/data-table.tsx`. Add import:
```typescript
import { DataTableImportButton } from "./data-table-import";
```

**Step 3:** Typecheck. Commit:
```bash
git add apps/web/src/features/data-view/data-table-import.tsx apps/web/src/features/data-view/data-table.tsx
git commit -m "refactor(data-view): extract DataTableImportButton"
```

---

## Task 5 — Rewrite data-view/data-table.tsx as thin wrapper with URL pagination

**Files:**
- Rewrite: `apps/web/src/features/data-view/data-table.tsx`

**Step 1:** Rewrite the file. It now:
- Imports `DataTable as BaseDataTable` + `DataTableProps as BaseProps` + `DataTableStoredState` from `@packages/ui/components/data-table`
- Re-exports `DataTableStoredState`
- Augments ColumnMeta with data-view-specific fields only (`importable`, `required`, `fieldPatterns`, `editType`, `editOptions`)
- Re-exports types from `./data-table-types`
- Defines a new `DataTable` that wraps `BaseDataTable` with URL pagination + toolbar

```typescript
"use client";

import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSearch } from "@tanstack/react-router";
import {
  DataTable as BaseDataTable,
  type DataTableProps as BaseProps,
  type DataTableStoredState,
} from "@packages/ui/components/data-table";
import type { ColumnDef, Row, RowData } from "@tanstack/react-table";
import { DataTableExportButton } from "./data-table-export";
import { DataTableImportButton } from "./data-table-import";
import type { ImportConfig } from "./data-table-types";

export type { DataTableStoredState };
export type { ImportableColumn, ParsedRow, ImportConfig } from "./data-table-types";

declare module "@tanstack/react-table" {
  // oxlint-ignore @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    importable?: boolean;
    required?: boolean;
    fieldPatterns?: string[];
    editType?: "text" | "money" | "combobox";
    editOptions?: { value: string; label: string }[];
  }
}

interface DataTableProps<TData, TValue>
  extends Omit<BaseProps<TData, TValue>, "toolbar" | "toolbarActions" | "pagination"> {
  total?: number;
  defaultPageSize?: number;
  renderToolbar?: React.ReactNode;
  exportConfig?: { filename: string };
  importConfig?: ImportConfig;
}

export function DataTable<TData, TValue>({
  total,
  defaultPageSize = 20,
  renderToolbar,
  exportConfig,
  importConfig,
  columns,
  data,
  ...rest
}: DataTableProps<TData, TValue>) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? defaultPageSize;
  const totalPages = total != null ? Math.ceil(total / pageSize) : undefined;

  const pagination =
    total != null
      ? {
          currentPage: page,
          pageSize,
          totalPages: totalPages ?? 1,
          totalCount: total,
          onPageChange: (p: number) =>
            navigate({ search: (prev) => ({ ...prev, page: p }), replace: true }),
          onPageSizeChange: (s: number) =>
            navigate({ search: (prev) => ({ ...prev, pageSize: s, page: 1 }), replace: true }),
        }
      : undefined;

  return (
    <BaseDataTable
      {...rest}
      columns={columns}
      data={data}
      pagination={pagination}
      toolbar={renderToolbar}
      toolbarActions={
        importConfig || exportConfig ? (
          <>
            {importConfig && (
              <DataTableImportButton columns={columns} config={importConfig} />
            )}
            {exportConfig && (
              <DataTableExportButton
                columns={columns}
                data={data}
                filename={exportConfig.filename}
              />
            )}
          </>
        ) : undefined
      }
    />
  );
}
```

**Step 2:** Update the 3 call sites that used `pagination={}` to pass `total` instead:

`apps/web/src/features/transactions/ui/transactions-list.tsx`:
```tsx
// Remove: pagination={{ currentPage, onPageChange, onPageSizeChange, pageSize, totalCount, totalPages }}
// Add:
total={result.total}
```
Remove all the manual `onPageChange`/`onPageSizeChange`/`page`/`pageSize` state/handlers derived from URL — DataTable now owns this.

`apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx`:
Same pattern — remove `pagination={{...}}`, add `total={result.totalCount}`.

`apps/web/src/features/analytics/ui/editable-dashboard-grid.tsx`:
This one does client-side pagination inside a credenza (not URL-based). Keep its `pagination` prop working by passing it through as `_pagination` or handle it separately. **NOTE:** This is a special case — discuss with team whether to migrate or leave as-is.

**Step 3:** Typecheck. Commit:
```bash
git add apps/web/src/features/data-view/data-table.tsx \
  apps/web/src/features/transactions/ui/transactions-list.tsx \
  apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/credit-cards.tsx
git commit -m "refactor(data-view): thin DataTable wrapper with URL pagination"
```

---

## Task 6 — Create DataTableVirtual

**Files:**
- Create: `apps/web/src/features/data-view/data-table-virtual.tsx`

**Step 1:** Create a virtualized table component. Features:
- `useVirtualizer` from `@tanstack/react-virtual` for row virtualization
- `useReactTable` with `getCoreRowModel` only (no sorting, no filtering row models)
- No DnD, no selection checkboxes, no pagination
- Column `meta.rawHeader?: boolean` — when true, renders the column's `header` function output directly as the full `<TableHead>` content (no sort button wrapper). Used by import wizard for Combobox headers.
- `maxHeight?: number` prop (default 360) for the virtualized scroll area

```typescript
"use client";

import * as React from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef, type RowData } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@packages/ui/components/table";
import { cn } from "@packages/ui/lib/utils";

declare module "@tanstack/react-table" {
  // oxlint-ignore @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    rawHeader?: boolean;
  }
}

interface DataTableVirtualProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  getRowId: (row: TData, index: number) => string;
  maxHeight?: number;
}

export function DataTableVirtual<TData, TValue>({
  columns,
  data,
  getRowId,
  maxHeight = 360,
}: DataTableVirtualProps<TData, TValue>) {
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
  });

  const { rows } = table.getRowModel();
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  return (
    <div className="overflow-auto rounded-md border">
      <Table className="border-separate border-spacing-0">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
              {headerGroup.headers.map((header) => {
                const raw = header.column.columnDef.meta?.rawHeader;
                return (
                  <TableHead
                    key={header.id}
                    className="p-0 min-w-[160px] text-xs font-medium"
                  >
                    {raw
                      ? flexRender(header.column.columnDef.header, header.getContext())
                      : (
                        <span className="px-2">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
      </Table>
      <div ref={parentRef} className="overflow-auto" style={{ maxHeight }}>
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                className={cn("flex border-b", virtualRow.index % 2 !== 0 && "bg-muted/20")}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualRow.size,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row?.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="flex items-center"
                    style={{ minWidth: 160, flex: "0 0 160px" }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

**Step 2:** Typecheck. Commit:
```bash
git add apps/web/src/features/data-view/data-table-virtual.tsx
git commit -m "feat(data-view): add DataTableVirtual for virtualized import table"
```

---

## Task 7 — Rewrite MappingBody in import-credenza to use DataTableVirtual

**Files:**
- Modify: `apps/web/src/features/data-view/import-credenza.tsx`

**Step 1:** Import `DataTableVirtual` from `./data-table-virtual`.

**Step 2:** Rewrite `MappingBody` to build columns from `raw.headers` using `DataTableVirtual`. Each column:
- `id`: the raw file header string
- `meta.rawHeader: true`
- `header`: a `Combobox` for mapping selection (same logic as current `getDestKeyForSource` / `handleMappingSelect`)
- `cell`: renders `EditCell` for the mapped field (looks up `col` from columns by mapping)

```typescript
function buildMappingColumns(
  raw: RawData,
  columns: ImportableColumn[],
  mapping: ColumnMapping,
  onMappingChange: (m: ColumnMapping) => void,
  editingCell: { colKey: string; rowIdx: number } | null,
  onActivate: (rowIdx: number, colKey: string) => void,
  onDeactivate: () => void,
  onCellChange: (rowIdx: number, colKey: string, value: string) => void,
): ColumnDef<ParsedRow, string>[] {
  const destOptions = [
    { value: "__none__", label: "— Ignorar coluna —" },
    ...columns.map((c) => ({
      value: c.key,
      label: c.required ? `${c.label} *` : c.label,
    })),
  ];

  return raw.headers.map((header) => ({
    id: header,
    meta: { rawHeader: true },
    header: () => {
      const destKey =
        Object.entries(mapping).find(([, src]) => src === header)?.[0] ?? "__none__";
      return (
        <Combobox
          className="h-10 w-full justify-start rounded-none border-0 bg-transparent px-2 text-xs font-medium shadow-none"
          emptyMessage="Nenhum campo"
          onValueChange={(v) => {
            const next = { ...mapping };
            for (const key of Object.keys(next)) {
              if (next[key] === header) next[key] = "";
            }
            if (v !== "__none__") next[v] = header;
            onMappingChange(next);
          }}
          options={destOptions}
          placeholder={header}
          renderSelected={() => <span className="truncate">{header}</span>}
          searchPlaceholder="Buscar campo..."
          value={destKey}
        />
      );
    },
    accessorFn: (row) => row[columns.find((c) => mapping[c.key] === header)?.key ?? ""] ?? "",
    cell: ({ row, getValue }) => {
      const destKey = Object.entries(mapping).find(([, src]) => src === header)?.[0];
      const col = columns.find((c) => c.key === destKey);
      const rowIdx = row.index;
      const value = getValue();
      if (!col) return <span className="px-2 text-xs text-muted-foreground">—</span>;
      const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colKey === col.key;
      return (
        <EditCell
          col={col}
          isEditing={isEditing}
          value={value}
          onActivate={() => onActivate(rowIdx, col.key)}
          onChange={(v) => onCellChange(rowIdx, col.key, v)}
          onDeactivate={onDeactivate}
        />
      );
    },
  }));
}
```

**Step 3:** Update `MappingBody` to use `DataTableVirtual` with `buildMappingColumns`. Remove the raw `useVirtualizer` + custom table markup. The component simplifies significantly.

**Step 4:** Remove now-unused imports: `useVirtualizer`, `useRef` (if no longer needed), `Table`, `TableHead`, `TableHeader`, `TableRow` from import-credenza.

**Step 5:** Typecheck. Commit:
```bash
git add apps/web/src/features/data-view/import-credenza.tsx
git commit -m "refactor(import-credenza): MappingBody uses DataTableVirtual"
```

---

## Task 8 — Delete the duplicated packages/ui DataTable internals from data-view

**Files:**
- Verify: `apps/web/src/features/data-view/data-table.tsx` no longer contains duplicated sub-components

After Task 5, the data-view `data-table.tsx` is a thin wrapper and should contain no copies of:
- `SortableHeaderCell`
- `DataTableHeaderRow`
- `DataTableBodyRow` / `DataTableBodyRows`
- `DataTablePagination`
- `ColumnVisibilityToggle`

**Step 1:** Confirm the file is clean — run:
```bash
wc -l apps/web/src/features/data-view/data-table.tsx
```
Expected: under 80 lines.

**Step 2:** Final typecheck + lint:
```bash
bun run typecheck && bun run check
```

**Step 3:** Final commit:
```bash
git add -A
git commit -m "refactor(data-view): complete data-table atomic composition refactor"
```

---

## File Map After Completion

```
packages/ui/src/components/
└── data-table.tsx                    # primitive table + toolbar/toolbarActions slots

apps/web/src/features/data-view/
├── data-table.tsx                    # ~80 lines — URL-paginated wrapper
├── data-table-virtual.tsx            # virtualized table for import
├── data-table-export.tsx             # DataTableExportButton
├── data-table-import.tsx             # DataTableImportButton
├── data-table-types.ts               # ImportableColumn, ParsedRow, ImportConfig
└── import-credenza.tsx               # MappingBody uses DataTableVirtual
```

## Call Site Impact

| File | Change |
|------|--------|
| `transactions-list.tsx` | Remove `pagination={{...}}` → add `total={result.total}` |
| `credit-cards.tsx` | Remove `pagination={{...}}` → add `total={result.totalCount}` |
| `analytics/editable-dashboard-grid.tsx` | Special case — discuss; may need separate handling |
| All other 16 consumers | No change needed |
