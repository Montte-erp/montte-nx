# DataTable Native Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a self-contained `DataTableImportButton` to the toolbar that opens a Popover wizard — dropzone → column mapping → virtualized preview with row selection/ignore/bulk actions → confirm — following the UX of `statement-import-credenza.tsx` but generic for any DataTable.

**Architecture:** Single file `data-table-import.tsx` in `apps/web/src/components/data-table/`. All state (step, rawData, mapping, rows, selectedIndices, ignoredIndices) is local to `DataTableImportButton`. Importable columns are derived from `useDataTable().table` at runtime. Caller injects domain logic via `DataTableImportConfig` (parseFile, onImport, validateRow, renderBulkActions). No changes to `DataTableRoot` context beyond adding `importIgnore` to `ColumnMeta`.

**Tech Stack:** `@packages/ui` primitives (Popover, Dropzone, Button, Combobox, Input, Checkbox, Badge, Tooltip), `@tanstack/react-virtual`, `useDataTable()` from `./data-table-root`, `useCsvFile`/`useXlsxFile` from `@/hooks/` (injected by caller via `parseFile`).

---

## Reference files

- `apps/web/src/components/data-table/data-table-root.tsx` — ColumnMeta, useDataTable
- `apps/web/src/components/data-table/data-table-export.tsx` — pattern to follow for toolbar button
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx` — UX reference (preview step, ignore, bulk actions, inline editing)

---

## Task 1 — Add `importIgnore` to `ColumnMeta`

**Files:**
- Modify: `apps/web/src/components/data-table/data-table-root.tsx`

### Step 1: Add `importIgnore` to the ColumnMeta declaration block

Find the `declare module "@tanstack/react-table"` block (around line 61). Inside `ColumnMeta`, add:

```ts
importIgnore?: boolean;
```

### Step 2: Commit

```bash
git add apps/web/src/components/data-table/data-table-root.tsx
git commit -m "feat(data-table): add importIgnore to ColumnMeta"
```

---

## Task 2 — Types + utilities in `data-table-import.tsx`

**Files:**
- Create: `apps/web/src/components/data-table/data-table-import.tsx`

### Step 1: Create the file with imports, types, and utilities

```tsx
import { useRef, useState, useTransition } from "react";
import type React from "react";
import { AlertTriangle, FileSpreadsheet, Loader2, Undo2, Upload, X } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import {
  Dropzone,
  DropzoneContent,
  DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { Input } from "@packages/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@packages/ui/components/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import { useDataTable } from "./data-table-root";

// ─── Types ───────────────────────────────────────────────────────────────────

export type RawImportData = {
  headers: string[];
  rows: string[][];
};

type ImportStep = "upload" | "map" | "preview" | "confirm";

type ImportRow = Record<string, string> & { __errors?: string[] };

export interface DataTableImportConfig {
  /** Caller parses file → raw table. Bring useCsvFile/useXlsxFile/OFX here. */
  parseFile: (file: File) => Promise<RawImportData>;
  /** Called with non-ignored selected rows on confirm. */
  onImport: (rows: Record<string, string>[]) => Promise<void>;
  /** react-dropzone accept map. */
  accept?: Record<string, string[]>;
  /** Optional per-row validation. Return error strings or null. */
  validateRow?: (row: Record<string, string>) => string[] | null;
  /** Render extra bulk action buttons when rows are selected in preview. */
  renderBulkActions?: (props: {
    selectedRows: Record<string, string>[];
    selectedIndices: Set<number>;
    rows: Record<string, string>[];
    onRowsChange: (rows: Record<string, string>[]) => void;
    onClearSelection: () => void;
  }) => React.ReactNode;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const DEFAULT_ACCEPT = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMatch(
  fileHeaders: string[],
  cols: Array<{ key: string; label: string }>,
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const col of cols) {
    const normLabel = normalize(col.label);
    const normKey = normalize(col.key);
    const match = fileHeaders.find((h) => {
      const normH = normalize(h);
      return (
        normH === normLabel ||
        normH === normKey ||
        normH.includes(normLabel) ||
        normLabel.includes(normH) ||
        normH.includes(normKey) ||
        normKey.includes(normH)
      );
    });
    if (match) mapping[col.key] = match;
  }
  return mapping;
}

function applyMapping(
  rawData: RawImportData,
  mapping: Record<string, string>,
  cols: Array<{ key: string; label: string }>,
  validateRow?: DataTableImportConfig["validateRow"],
): ImportRow[] {
  return rawData.rows.map((row) => {
    const record: Record<string, string> = {};
    for (const col of cols) {
      const fileHeader = mapping[col.key];
      if (!fileHeader) continue;
      const idx = rawData.headers.indexOf(fileHeader);
      record[col.key] = idx >= 0 ? (row[idx] ?? "") : "";
    }
    const errors = validateRow?.(record) ?? null;
    if (errors?.length) return { ...record, __errors: errors };
    return record;
  });
}
```

### Step 2: Commit

```bash
git add apps/web/src/components/data-table/data-table-import.tsx
git commit -m "feat(data-table): add import types and utilities"
```

---

## Task 3 — Step progress bar + Upload step

**Files:**
- Modify: `apps/web/src/components/data-table/data-table-import.tsx`

### Step 1: Add `ImportStepBar`

```tsx
const STEPS: ImportStep[] = ["upload", "map", "preview", "confirm"];

function ImportStepBar({ current }: { current: ImportStep }) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((_, i) => (
        <div
          key={`step-${i + 1}`}
          className={[
            "h-1 rounded-full flex-1 transition-all",
            i === idx ? "bg-primary" : i < idx ? "bg-primary/40" : "bg-muted",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
```

### Step 2: Add `UploadStep`

```tsx
function UploadStep({
  importConfig,
  onParsed,
}: {
  importConfig: DataTableImportConfig;
  onParsed: (data: RawImportData) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File>();

  function handleDrop([file]: File[]) {
    if (!file) return;
    setSelectedFile(file);
    startTransition(async () => {
      try {
        const data = await importConfig.parseFile(file);
        onParsed(data);
      } catch {
        toast.error("Erro ao processar o arquivo.");
        setSelectedFile(undefined);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">Importar dados</p>
        <p className="text-xs text-muted-foreground">
          Selecione um arquivo para começar
        </p>
      </div>
      <Dropzone
        accept={importConfig.accept ?? DEFAULT_ACCEPT}
        disabled={isPending}
        maxFiles={1}
        onDrop={handleDrop}
        src={selectedFile ? [selectedFile] : undefined}
      >
        <DropzoneEmptyState>
          {isPending ? (
            <Loader2 className="size-8 text-primary animate-spin" />
          ) : (
            <>
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Arraste ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">CSV · XLSX</p>
            </>
          )}
        </DropzoneEmptyState>
        <DropzoneContent />
      </Dropzone>
    </div>
  );
}
```

### Step 3: Commit

```bash
git commit -m "feat(data-table): add ImportStepBar and UploadStep"
```

---

## Task 4 — MapStep

**Files:**
- Modify: `apps/web/src/components/data-table/data-table-import.tsx`

### Step 1: Add `MapStep`

```tsx
function MapStep({
  rawData,
  importableColumns,
  mapping,
  onMappingChange,
  onNext,
  onBack,
}: {
  rawData: RawImportData;
  importableColumns: Array<{ key: string; label: string }>;
  mapping: Record<string, string>;
  onMappingChange: (m: Record<string, string>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const headerOptions = [
    { value: "__none__", label: "— Não mapear —" },
    ...rawData.headers.map((h) => ({ value: h, label: h })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">Mapeie as colunas</p>
        <p className="text-xs text-muted-foreground">
          {rawData.rows.length} linha(s) · {rawData.headers.length} colunas
          detectadas
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-[9rem_1fr] items-center gap-2 px-1 pb-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Campo
          </span>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Coluna do arquivo
          </span>
        </div>

        {importableColumns.map((col) => {
          const mapped = mapping[col.key];
          const headerIdx = mapped ? rawData.headers.indexOf(mapped) : -1;
          const sample =
            headerIdx >= 0
              ? rawData.rows
                  .slice(0, 3)
                  .map((r) => r[headerIdx])
                  .filter(Boolean)
                  .join(", ")
              : null;

          return (
            <div
              key={col.key}
              className="grid grid-cols-[9rem_1fr] items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2"
            >
              <span className="pt-1 text-sm font-medium">{col.label}</span>
              <div className="flex flex-col gap-1 min-w-0">
                <Combobox
                  options={headerOptions}
                  value={mapping[col.key] ?? "__none__"}
                  onValueChange={(v) =>
                    onMappingChange({
                      ...mapping,
                      [col.key]: v === "__none__" ? "" : v,
                    })
                  }
                />
                {sample && (
                  <p className="truncate px-1 text-xs text-muted-foreground">
                    {sample}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button onClick={onBack} type="button" variant="outline">
          Voltar
        </Button>
        <Button className="flex-1" onClick={onNext} type="button">
          Continuar
        </Button>
      </div>
    </div>
  );
}
```

### Step 2: Commit

```bash
git commit -m "feat(data-table): add MapStep with auto-match"
```

---

## Task 5 — PreviewStep (virtualized, full statement-import UX)

**Files:**
- Modify: `apps/web/src/components/data-table/data-table-import.tsx`

This is the most complex step. Follows `statement-import-credenza.tsx` PreviewStep closely.

### Step 1: Add `PreviewStep`

```tsx
function PreviewStep({
  importableColumns,
  rows,
  onRowsChange,
  validateRow,
  renderBulkActions,
  onNext,
  onBack,
}: {
  importableColumns: Array<{ key: string; label: string }>;
  rows: ImportRow[];
  onRowsChange: (rows: ImportRow[]) => void;
  validateRow?: DataTableImportConfig["validateRow"];
  renderBulkActions?: DataTableImportConfig["renderBulkActions"];
  onNext: () => void;
  onBack: () => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [ignoredIndices, setIgnoredIndices] = useState<Set<number>>(new Set());
  const [editingCell, setEditingCell] = useState<{
    rowIdx: number;
    colKey: string;
  } | null>(null);
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const validRows = rows.filter((r) => !r.__errors?.length);
  const errorRows = rows.filter((r) => r.__errors?.length);

  const displayRows = showErrorsOnly
    ? rows.map((r, i) => ({ row: r, originalIndex: i })).filter(({ row }) => row.__errors?.length)
    : rows.map((r, i) => ({ row: r, originalIndex: i }));

  const virtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 8,
  });

  // Selectable = valid + not ignored
  const selectableIndices = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => !r.__errors?.length && !ignoredIndices.has(i))
    .map(({ i }) => i);

  const allSelected =
    selectableIndices.length > 0 &&
    selectableIndices.every((i) => selectedIndices.has(i));
  const someSelected = selectableIndices.some((i) => selectedIndices.has(i));
  const isIndeterminate = someSelected && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIndices(new Set());
      return;
    }
    setSelectedIndices(new Set(selectableIndices));
  }

  function toggleRow(idx: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function ignoreRows(indices: Iterable<number>) {
    const arr = [...indices];
    setIgnoredIndices((prev) => {
      const next = new Set(prev);
      for (const i of arr) next.add(i);
      return next;
    });
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      for (const i of arr) next.delete(i);
      return next;
    });
  }

  function unignoreRow(idx: number) {
    setIgnoredIndices((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  }

  function commitEdit(rowIdx: number, colKey: string, value: string) {
    const updated = rows.map((r, i) => {
      if (i !== rowIdx) return r;
      const newRow = { ...r, [colKey]: value };
      const errors = validateRow?.(newRow) ?? null;
      return errors?.length ? { ...newRow, __errors: errors } : newRow;
    });
    onRowsChange(updated);
    setEditingCell(null);
  }

  // Rows that will actually be imported: valid + not ignored
  const importableCount = selectableIndices.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Revise os dados</p>
          <p className="text-xs text-muted-foreground">
            {validRows.length} válidos
            {errorRows.length > 0 && ` · ${errorRows.length} com erro`}
          </p>
        </div>
        {errorRows.length > 0 && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={!showErrorsOnly ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setShowErrorsOnly(false)}
              type="button"
            >
              Todos
            </Button>
            <Button
              size="sm"
              variant={showErrorsOnly ? "secondary" : "ghost"}
              className="h-7 text-xs"
              onClick={() => setShowErrorsOnly(true)}
              type="button"
            >
              Com erro
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        {/* Header */}
        <div className="grid items-center gap-2 border-b bg-muted/50 px-3 py-2"
          style={{ gridTemplateColumns: `2rem repeat(${importableColumns.length}, minmax(0, 1fr)) 2rem` }}>
          <Checkbox
            checked={isIndeterminate ? "indeterminate" : allSelected}
            onCheckedChange={toggleSelectAll}
            aria-label="Selecionar todos"
          />
          {importableColumns.map((col) => (
            <span key={col.key} className="text-xs font-medium text-muted-foreground truncate">
              {col.label}
            </span>
          ))}
          <span />
        </div>

        {/* Virtualized rows */}
        <div ref={parentRef} className="h-56 overflow-auto">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const { row, originalIndex } = displayRows[virtualRow.index];
              const hasErrors = !!row.__errors?.length;
              const isIgnored = ignoredIndices.has(originalIndex);
              const isSelected = selectedIndices.has(originalIndex);

              const rowEl = (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={(el) => { if (el) virtualizer.measureElement(el); }}
                  className={[
                    "grid items-center gap-2 border-b px-3 h-10",
                    hasErrors || isIgnored ? "opacity-50" : "",
                    isIgnored ? "line-through bg-muted/30" : "",
                    isSelected ? "bg-primary/5" : "",
                  ].filter(Boolean).join(" ")}
                  style={{
                    position: "absolute",
                    top: 0, left: 0, width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                    gridTemplateColumns: `2rem repeat(${importableColumns.length}, minmax(0, 1fr)) 2rem`,
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={hasErrors || isIgnored}
                    onCheckedChange={() => {
                      if (!hasErrors && !isIgnored) toggleRow(originalIndex);
                    }}
                    aria-label="Selecionar linha"
                  />

                  {importableColumns.map((col) => {
                    const isEditing =
                      editingCell?.rowIdx === originalIndex &&
                      editingCell?.colKey === col.key;
                    const cellValue = row[col.key] ?? "";

                    return isEditing ? (
                      <Input
                        key={col.key}
                        autoFocus
                        className="h-7 text-xs py-0"
                        defaultValue={cellValue}
                        onBlur={(e) => commitEdit(originalIndex, col.key, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            commitEdit(originalIndex, col.key, e.currentTarget.value);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                      />
                    ) : (
                      <span
                        key={col.key}
                        className={[
                          "text-xs truncate",
                          !hasErrors && !isIgnored
                            ? "cursor-text hover:underline hover:decoration-dotted"
                            : "",
                        ].join(" ")}
                        onClick={() => {
                          if (!hasErrors && !isIgnored)
                            setEditingCell({ rowIdx: originalIndex, colKey: col.key });
                        }}
                      >
                        {cellValue || <span className="text-muted-foreground/40">—</span>}
                      </span>
                    );
                  })}

                  {/* Action cell */}
                  <span className="flex items-center justify-end">
                    {hasErrors ? (
                      <AlertTriangle className="size-3.5 text-destructive" />
                    ) : isIgnored ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-foreground"
                        onClick={() => unignoreRow(originalIndex)}
                        type="button"
                        aria-label="Desfazer ignorar"
                      >
                        <Undo2 className="size-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-destructive"
                        onClick={() => ignoreRows([originalIndex])}
                        type="button"
                        aria-label="Ignorar linha"
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </span>
                </div>
              );

              // Wrap invalid rows in tooltip
              if (hasErrors && row.__errors?.length) {
                return (
                  <TooltipProvider key={`tooltip-${originalIndex}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>{rowEl}</TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs font-medium mb-1">
                          Não pode ser importado:
                        </p>
                        <ul className="list-disc list-inside text-xs">
                          {row.__errors.map((e) => <li key={e}>{e}</li>)}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              }

              return rowEl;
            })}
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIndices.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-xs font-medium tabular-nums shrink-0">
            {selectedIndices.size} de {importableCount} selecionadas
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setSelectedIndices(new Set())}
            type="button"
          >
            <X className="size-3.5" />
            Limpar
          </Button>
          <div className="h-4 w-px bg-border" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => ignoreRows(selectedIndices)}
            type="button"
          >
            Ignorar selecionadas
          </Button>
          {renderBulkActions?.({
            selectedRows: [...selectedIndices].map((i) => rows[i]),
            selectedIndices,
            rows,
            onRowsChange,
            onClearSelection: () => setSelectedIndices(new Set()),
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={onBack} type="button" variant="outline">
          Voltar
        </Button>
        <Button
          className="flex-1"
          disabled={importableCount === 0}
          onClick={() => onNext()}
          type="button"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
}
```

### Step 2: Commit

```bash
git commit -m "feat(data-table): add virtualized PreviewStep with selection and bulk actions"
```

---

## Task 6 — ConfirmStep

**Files:**
- Modify: `apps/web/src/components/data-table/data-table-import.tsx`

### Step 1: Add `ConfirmStep`

```tsx
function ConfirmStep({
  rows,
  ignoredIndices,
  onImport,
  onBack,
}: {
  rows: ImportRow[];
  ignoredIndices: Set<number>;
  onImport: () => Promise<void>;
  onBack: () => void;
}) {
  const [isPending, setIsPending] = useState(false);

  const totalCount = rows.length;
  const errorCount = rows.filter((r) => r.__errors?.length).length;
  const ignoredCount = ignoredIndices.size;
  const importCount = totalCount - errorCount - ignoredCount;

  async function handleImport() {
    setIsPending(true);
    try {
      await onImport();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-medium">Tudo certo?</p>
        <p className="text-xs text-muted-foreground">
          Confirme para importar os dados
        </p>
      </div>

      <div className="rounded-xl border overflow-hidden divide-y">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-sm text-muted-foreground">Total no arquivo</span>
          <span className="text-sm font-medium">{totalCount}</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">
              Com erro (ignoradas)
            </span>
            <span className="text-sm font-medium text-destructive">
              {errorCount}
            </span>
          </div>
        )}
        {ignoredCount > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-muted-foreground">
              Ignoradas manualmente
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {ignoredCount}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">Serão importadas</span>
          <span className="text-sm font-bold text-primary">{importCount}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          disabled={isPending}
          onClick={onBack}
          type="button"
          variant="outline"
        >
          Voltar
        </Button>
        <Button
          className="flex-1"
          disabled={isPending || importCount === 0}
          onClick={handleImport}
          type="button"
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Importar {importCount} linha(s)
        </Button>
      </div>
    </div>
  );
}
```

### Step 2: Commit

```bash
git commit -m "feat(data-table): add ConfirmStep"
```

---

## Task 7 — `DataTableImportButton` (main orchestrator)

**Files:**
- Modify: `apps/web/src/components/data-table/data-table-import.tsx`

This ties everything together. State lives here. Derives importable columns from table context.

### Step 1: Add `DataTableImportButton`

```tsx
export function DataTableImportButton({
  importConfig,
}: {
  importConfig: DataTableImportConfig;
}) {
  const { table } = useDataTable();

  // Derive importable columns from table column defs
  const importableColumns = table
    .getAllColumns()
    .filter(
      (col) =>
        col.id !== "__select" &&
        col.id !== "__actions" &&
        !col.columnDef.meta?.importIgnore,
    )
    .map((col) => ({
      key: String(
        (col.columnDef as { accessorKey?: string }).accessorKey ?? col.id,
      ),
      label: col.columnDef.meta?.label ?? col.id,
    }))
    .filter((c) => c.key);

  // ── State ──────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>("upload");
  const [rawData, setRawData] = useState<RawImportData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [ignoredIndices, setIgnoredIndices] = useState<Set<number>>(new Set());

  function reset() {
    setStep("upload");
    setRawData(null);
    setMapping({});
    setRows([]);
    setIgnoredIndices(new Set());
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  // ── Step transitions ───────────────────────────────────────────────────

  function handleParsed(data: RawImportData) {
    setRawData(data);
    setMapping(autoMatch(data.headers, importableColumns));
    setStep("map");
  }

  function handleMappingConfirmed() {
    if (!rawData) return;
    const mapped = applyMapping(
      rawData,
      mapping,
      importableColumns,
      importConfig.validateRow,
    );
    setRows(mapped);
    setStep("preview");
  }

  async function handleImport() {
    const toImport = rows
      .filter((r, i) => !r.__errors?.length && !ignoredIndices.has(i))
      .map(({ __errors: _e, ...rest }) => rest as Record<string, string>);

    await importConfig.onImport(toImport);
    toast.success(`${toImport.length} linha(s) importada(s) com sucesso.`);
    handleOpenChange(false);
  }

  // ── Popover width per step ─────────────────────────────────────────────
  const popoverWidth =
    step === "preview" ? "w-[680px]" : step === "map" ? "w-[520px]" : "w-[380px]";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button size="icon-sm" tooltip="Importar dados" variant="outline">
          <Upload />
          <span className="sr-only">Importar dados</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={`${popoverWidth} p-4 flex flex-col gap-4`}
        sideOffset={8}
      >
        <ImportStepBar current={step} />

        {step === "upload" && (
          <UploadStep importConfig={importConfig} onParsed={handleParsed} />
        )}

        {step === "map" && rawData && (
          <MapStep
            rawData={rawData}
            importableColumns={importableColumns}
            mapping={mapping}
            onMappingChange={setMapping}
            onNext={handleMappingConfirmed}
            onBack={() => setStep("upload")}
          />
        )}

        {step === "preview" && (
          <PreviewStep
            importableColumns={importableColumns}
            rows={rows}
            onRowsChange={setRows}
            validateRow={importConfig.validateRow}
            renderBulkActions={importConfig.renderBulkActions}
            onNext={() => setStep("confirm")}
            onBack={() => setStep("map")}
          />
        )}

        {step === "confirm" && (
          <ConfirmStep
            rows={rows}
            ignoredIndices={ignoredIndices}
            onImport={handleImport}
            onBack={() => setStep("preview")}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
```

> **Note:** `ignoredIndices` needs to be shared between `PreviewStep` and `ConfirmStep`. Pass a ref or lift it up. Simplest fix: lift `ignoredIndices` state into `DataTableImportButton` and pass it down as props + setter.

Update `PreviewStep` signature to accept:
```ts
ignoredIndices: Set<number>;
onIgnoredIndicesChange: (s: Set<number>) => void;
```
And remove internal `ignoredIndices`/`setIgnoredIndices` state from `PreviewStep`. Use the passed props instead.

### Step 2: Commit

```bash
git commit -m "feat(data-table): add DataTableImportButton orchestrator"
```

---

## Task 8 — Wire into a page (transactions example)

Find the transactions page that uses the new `DataTableRoot`:

```bash
grep -rl "DataTableRoot\|DataTableToolbar" apps/web/src/routes/_authenticated --include="*.tsx" | head -5
```

### Step 1: Add imports

```tsx
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { DataTableImportButton } from "@/components/data-table/data-table-import";
import type { DataTableImportConfig } from "@/components/data-table/data-table-import";
```

### Step 2: Build `importConfig` in the component

```tsx
const { parse: parseCsv } = useCsvFile();
const { parse: parseXlsx } = useXlsxFile();

const importConfig: DataTableImportConfig = {
  accept: {
    "text/csv": [".csv"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-excel": [".xls"],
  },
  async parseFile(file) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") return parseCsv(file);
    if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
    throw new Error("Formato não suportado. Use CSV ou XLSX.");
  },
  async onImport(rows) {
    // rows: Record<string, string>[] with accessorKeys as keys
    // map to your domain type, call your mutation
    await importMutation.mutateAsync({ rows });
  },
};
```

### Step 3: Add button to toolbar

```tsx
<DataTableToolbar>
  {/* existing children */}
  <DataTableImportButton importConfig={importConfig} />
</DataTableToolbar>
```

### Step 4: Commit

```bash
git commit -m "feat(transactions): add native DataTable import button"
```

---

## Acceptance Checklist

- [ ] Import button appears in toolbar, triggers popover
- [ ] Popover closes → state fully resets
- [ ] Step bar progresses through 4 steps
- [ ] Upload: file drop → parse → auto-map → go to map step
- [ ] Map: sample values shown, user can override combobox per column
- [ ] Preview: rows virtualized (test 500+ rows)
- [ ] Preview: checkboxes work (toggle, select all, indeterminate)
- [ ] Preview: click cell → inline Input; Enter/blur commits; Escape cancels
- [ ] Preview: X button ignores row (strikethrough); ↩ unignores
- [ ] Preview: bulk bar appears when ≥1 row selected
- [ ] Preview: "Ignorar selecionadas" bulk action works
- [ ] Preview: `renderBulkActions` slot renders caller-injected buttons
- [ ] Preview: `validateRow` errors shown as tooltip on row (AlertTriangle icon)
- [ ] Preview: "Com erro" filter toggle shows only invalid rows
- [ ] Confirm: counts (total, errors, ignored, will import) are correct
- [ ] Confirm: `onImport` called with non-ignored non-error rows only
- [ ] `meta.importIgnore: true` on a column excludes it from mapping + preview
- [ ] TypeScript: no `as` casts, no unused variables, no `_` prefixed params
