# DataTable Import/Export Block Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mover `DataTable` de `packages/ui` para `apps/web`, transformá-lo em um block auto-suficiente com export (CSV/XLSX) e import genérico baseado em `ColumnMeta`, eliminando todas as credenzas de import isoladas.

**Architecture:** `DataTable` sai de `packages/ui` e vai para `apps/web/src/components/data-table.tsx`. Por estar no app, pode usar `useCsvFile`, `useXlsxFile` e `useCredenza` diretamente — sem wrappers, sem context tricks. Props `exportConfig` e `importConfig` ativam botões na toolbar interna. `ImportCredenza` genérica segue o padrão UI/UX de `TransactionImportCredenza`.

**Tech Stack:** `@tanstack/react-table`, `@f-o-t/csv`, `xlsx`, `defineStepper`, `Stepper.Provider variant="line"`, `useCredenza`, `Dropzone`, `Combobox`, `useCsvFile`, `useXlsxFile`, `useTransition`

**Referência de UI/UX:** `apps/web/src/features/transactions/ui/transaction-import-credenza.tsx`

---

## Task 1: Mover `DataTable` de `packages/ui` para `apps/web`

**Files:**
- Copy: `packages/ui/src/components/data-table.tsx` → `apps/web/src/components/data-table.tsx`
- Update: 18 arquivos que importam de `@packages/ui/components/data-table`

### Step 1: Copiar o arquivo

```bash
cp packages/ui/src/components/data-table.tsx apps/web/src/components/data-table.tsx
```

### Step 2: Ajustar imports internos no arquivo copiado

O arquivo usa imports de `packages/ui` como `../lib/utils` e componentes relativos. Trocar para paths absolutos do app:

- `../lib/utils` → `@packages/ui/lib/utils`
- `./button` → `@packages/ui/components/button`
- `./checkbox` → `@packages/ui/components/checkbox`
- `./dropdown-menu` → `@packages/ui/components/dropdown-menu`
- `./pagination` → `@packages/ui/components/pagination`
- `./select` → `@packages/ui/components/select`
- `./table` → `@packages/ui/components/table`
- `./tooltip` → `@packages/ui/components/tooltip`

### Step 3: Atualizar os 18 arquivos que importam de `@packages/ui/components/data-table`

Substituir em todos:
```
@packages/ui/components/data-table  →  @/components/data-table
```

```bash
# Verificar todos os arquivos afetados:
grep -r "@packages/ui/components/data-table" apps/web/src --include="*.tsx" --include="*.ts" -l
```

Fazer o replace em cada arquivo (18 no total).

### Step 4: Verificar typecheck

```bash
bun run typecheck 2>&1 | head -40
```

### Step 5: Commit

```bash
git add apps/web/src/components/data-table.tsx
git add -u  # atualiza todos os arquivos modificados
git commit -m "refactor(data-table): move DataTable from packages/ui to apps/web"
```

---

## Task 2: Estender `ColumnMeta` + adicionar props `exportConfig` e `importConfig`

**Files:**
- Modify: `apps/web/src/components/data-table.tsx`

### Step 1: Adicionar `importable`, `required`, `fieldPatterns` ao `ColumnMeta`

Localizar o `declare module "@tanstack/react-table"` e adicionar os novos campos:

```typescript
interface ColumnMeta<TData extends RowData, TValue> {
  label?: string;
  filterVariant?: "text" | "select" | "range" | "date";
  align?: "left" | "center" | "right";
  exportable?: boolean;
  importable?: boolean;
  required?: boolean;
  fieldPatterns?: string[];  // ex: ["nome", "name"] para auto-detect no mapeamento
}
```

### Step 2: Adicionar tipos para export/import e o `ImportableColumn`

Após os imports, antes do bloco `// Types`:

```typescript
export type ImportableColumn = {
  key: string;
  label: string;
  required: boolean;
  fieldPatterns: string[];
};

export type ParsedRow = Record<string, string>;

export type ImportConfig<T extends ParsedRow = ParsedRow> = {
  label: string;
  onImport: (rows: T[]) => Promise<{ imported: number }>;
};
```

### Step 3: Adicionar `exportConfig` e `importConfig` à interface `DataTableProps`

```typescript
exportConfig?: { filename: string };
importConfig?: ImportConfig;
```

### Step 4: Verificar typecheck

```bash
bun run typecheck 2>&1 | head -30
```

### Step 5: Commit

```bash
git add apps/web/src/components/data-table.tsx
git commit -m "feat(data-table): extend ColumnMeta with importable/exportable fields and add config props"
```

---

## Task 3: Implementar `DataTableExportButton` dentro de `data-table.tsx`

**Files:**
- Modify: `apps/web/src/components/data-table.tsx`

### Step 1: Adicionar imports necessários no topo do arquivo

```typescript
import { generateFromObjects } from "@f-o-t/csv";
import { utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import { Download } from "lucide-react"; // já pode existir — verificar
import { DropdownMenuItem } from "@packages/ui/components/dropdown-menu";
```

### Step 2: Criar `DataTableExportButton` (antes do componente `DataTable`)

Recebe `data` e `columns` via props — sem context:

```typescript
function DataTableExportButton<TData, TValue>({
  filename,
  data,
  columns,
}: {
  filename: string;
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
}) {
  const exportableColumns = columns.filter((col) => col.meta?.exportable);

  function getRows() {
    return data.map((row) =>
      Object.fromEntries(
        exportableColumns.map((col) => {
          const key = "accessorKey" in col ? String(col.accessorKey) : (col.id ?? "");
          const label = col.meta?.label ?? key;
          // acessar o valor pelo accessorKey
          const value = key.split(".").reduce<unknown>((obj, k) => {
            if (obj && typeof obj === "object") return (obj as Record<string, unknown>)[k];
            return "";
          }, row as unknown);
          return [label, String(value ?? "")];
        }),
      ),
    );
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportCsv() {
    const headers = exportableColumns.map(
      (col) => col.meta?.label ?? ("accessorKey" in col ? String(col.accessorKey) : (col.id ?? "")),
    );
    downloadBlob(
      new Blob([generateFromObjects(getRows(), { headers })], {
        type: "text/csv;charset=utf-8;",
      }),
      `${filename}.csv`,
    );
  }

  function handleExportXlsx() {
    const headers = exportableColumns.map(
      (col) => col.meta?.label ?? ("accessorKey" in col ? String(col.accessorKey) : (col.id ?? "")),
    );
    const ws = xlsxUtils.json_to_sheet(getRows(), { header: headers });
    const wb = xlsxUtils.book_new();
    xlsxUtils.book_append_sheet(wb, ws, filename);
    downloadBlob(
      new Blob([xlsxWrite(wb, { type: "array", bookType: "xlsx" })], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${filename}.xlsx`,
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button tooltip="Exportar" variant="outline">
          <Download className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Exportar como</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleExportCsv}>CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={handleExportXlsx}>XLSX</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 3: Adicionar toolbar ao `return` do `DataTable`

No `return (` do componente `DataTable`, envolver em `<div>` e adicionar toolbar condicional:

```tsx
return (
  <div>
    {(exportConfig || importConfig) && (
      <div className="flex items-center justify-end gap-2 pb-2">
        {importConfig && (
          <DataTableImportButton
            columns={/* derivado de columns — ver Task 4 */}
            config={importConfig}
          />
        )}
        {exportConfig && (
          <DataTableExportButton
            filename={exportConfig.filename}
            data={data}
            columns={columns}
          />
        )}
      </div>
    )}
    <DndContext ...>
      {/* conteúdo existente sem alteração */}
    </DndContext>
    {pagination && <DataTablePagination {...pagination} />}
  </div>
);
```

### Step 4: Verificar typecheck

```bash
bun run typecheck 2>&1 | head -30
```

### Step 5: Commit

```bash
git add apps/web/src/components/data-table.tsx
git commit -m "feat(data-table): add built-in export button (CSV + XLSX)"
```

---

## Task 4: Criar `ImportCredenza` + `DataTableImportButton`

**Files:**
- Create: `apps/web/src/components/import-credenza.tsx`

### Step 1: Criar o arquivo completo

Segue exatamente o padrão UI/UX de `TransactionImportCredenza`:

```typescript
import {
  CredenzaBody, CredenzaDescription, CredenzaFooter,
  CredenzaHeader, CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
  Dropzone, DropzoneContent, DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { Combobox } from "@packages/ui/components/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@packages/ui/components/table";
import { defineStepper } from "@packages/ui/components/stepper";
import { Button } from "@packages/ui/components/button";
import {
  AlertTriangle, ChevronRight, FileSpreadsheet, FileText, Loader2,
} from "lucide-react";
import { Suspense, useTransition, useState } from "react";
import { toast } from "sonner";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import type { ImportConfig, ImportableColumn, ParsedRow } from "@/components/data-table";

const { Stepper, useStepper } = defineStepper(
  { id: "upload", title: "Arquivo" },
  { id: "mapping", title: "Colunas" },
  { id: "preview", title: "Prévia" },
  { id: "confirm", title: "Importar" },
);

type ImportStepperMethods = ReturnType<typeof useStepper>;
type RawData = { headers: string[]; rows: string[][] };
type ColumnMapping = Record<string, string>;

// ── StepIndicator ────────────────────────────────────────────────────────────

function StepIndicator({ methods }: { methods: ImportStepperMethods }) {
  const steps = methods.state.all;
  const currentIndex = methods.lookup.getIndex(methods.state.current.data.id);
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, idx) => (
        <div
          key={step.id}
          className={[
            "h-1 rounded-full transition-all duration-300 flex-1",
            idx === currentIndex ? "bg-primary"
              : idx < currentIndex ? "bg-primary/50"
              : "bg-muted",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ── StepLoadingFallback ──────────────────────────────────────────────────────

function StepLoadingFallback({ title }: { title: string }) {
  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>{title}</CredenzaTitle>
        <CredenzaDescription>Aguarde enquanto processamos...</CredenzaDescription>
      </CredenzaHeader>
      <CredenzaBody className="px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </CredenzaBody>
    </>
  );
}

// ── guessMapping ─────────────────────────────────────────────────────────────

function guessMapping(headers: string[], columns: ImportableColumn[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const col of columns) {
    const patterns = [
      col.key.toLowerCase(),
      col.label.toLowerCase(),
      ...col.fieldPatterns.map((p) => p.toLowerCase()),
    ];
    // tenta match exato primeiro, depois substring
    let idx = lower.findIndex((h) => patterns.includes(h));
    if (idx === -1) idx = lower.findIndex((h) => patterns.some((p) => h.includes(p)));
    if (idx !== -1) mapping[col.key] = headers[idx] ?? "";
  }
  return mapping;
}

// ── UploadStep ───────────────────────────────────────────────────────────────

function UploadStep({
  methods,
  config,
  columns,
  onReady,
}: {
  methods: ImportStepperMethods;
  config: ImportConfig;
  columns: ImportableColumn[];
  onReady: (raw: RawData) => void;
}) {
  const [isParsing, setIsParsing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | undefined>();
  const { parse: parseCsv, generate: generateCsv } = useCsvFile();
  const { parse: parseXlsx } = useXlsxFile();

  function handleTemplateDownload() {
    const headers = columns.map((c) => c.key);
    const exampleRow = Object.fromEntries(columns.map((c) => [c.key, ""]));
    const blob = generateCsv([exampleRow], headers);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo-${config.label.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function processFile(file: File) {
    setSelectedFile(file);
    setIsParsing(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const data = ext === "xlsx" || ext === "xls"
        ? await parseXlsx(file)
        : await parseCsv(file);
      onReady(data);
      methods.navigation.next();
    } catch {
      toast.error("Erro ao processar o arquivo. Verifique o formato.");
      setSelectedFile(undefined);
    } finally {
      setIsParsing(false);
    }
  }

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>Importar {config.label}</CredenzaTitle>
        <CredenzaDescription>Importe seus dados via arquivo CSV ou XLSX</CredenzaDescription>
      </CredenzaHeader>
      <CredenzaBody className="px-4">
        <div className="flex flex-col gap-4 w-full overflow-auto">
          <StepIndicator methods={methods} />
          <Dropzone
            accept={{
              "text/csv": [".csv"],
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            }}
            disabled={isParsing}
            maxFiles={1}
            onDrop={([file]) => { if (file) processFile(file); }}
            src={selectedFile ? [selectedFile] : undefined}
          >
            <DropzoneEmptyState>
              {isParsing ? (
                <Loader2 className="size-8 text-primary animate-spin" />
              ) : (
                <div className="flex flex-col gap-2 items-center">
                  <FileSpreadsheet className="size-8 text-muted-foreground" />
                  <p className="font-medium text-sm">Arraste e solte ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">
                    Suporta arquivos <strong>.CSV</strong> e <strong>.XLSX</strong>
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                      <FileSpreadsheet className="size-3.5 text-emerald-600" />
                      <span className="text-xs font-medium">CSV</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                      <FileText className="size-3.5 text-blue-600" />
                      <span className="text-xs font-medium">XLSX</span>
                    </div>
                  </div>
                </div>
              )}
            </DropzoneEmptyState>
            <DropzoneContent />
          </Dropzone>
        </div>
      </CredenzaBody>
      <CredenzaFooter>
        <Button className="w-full" onClick={handleTemplateDownload} size="sm" type="button" variant="outline">
          <FileSpreadsheet className="size-4" />
          Baixar modelo CSV
        </Button>
      </CredenzaFooter>
    </>
  );
}

// ── MappingStep ───────────────────────────────────────────────────────────────

function MappingStep({
  methods, raw, columns, mapping, onMappingChange, onApply,
}: {
  methods: ImportStepperMethods;
  raw: RawData;
  columns: ImportableColumn[];
  mapping: ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  onApply: (rows: ParsedRow[]) => void;
}) {
  const headerOptions = [
    { value: "__none__", label: "— Ignorar —" },
    ...raw.headers.map((h) => ({ value: h, label: h })),
  ];
  const requiredCols = columns.filter((c) => c.required);
  const optionalCols = columns.filter((c) => !c.required);
  const canProceed = requiredCols.every(
    (c) => mapping[c.key] && mapping[c.key] !== "__none__",
  );

  function handleApply() {
    const rows: ParsedRow[] = raw.rows.map((row) =>
      Object.fromEntries(
        columns.map((col) => {
          const header = mapping[col.key];
          if (!header || header === "__none__") return [col.key, ""];
          const idx = raw.headers.indexOf(header);
          return [col.key, idx >= 0 ? (row[idx] ?? "") : ""];
        }),
      ),
    );
    onApply(rows);
    methods.navigation.next();
  }

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>Mapear Colunas</CredenzaTitle>
        <CredenzaDescription>Relacione as colunas do arquivo com os campos do sistema</CredenzaDescription>
      </CredenzaHeader>
      <CredenzaBody className="px-4">
        <div className="flex flex-col gap-4">
          <StepIndicator methods={methods} />

          {/* Prévia das primeiras linhas do arquivo */}
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 border-b">
              <p className="text-xs font-medium text-muted-foreground">
                Prévia do arquivo ({raw.rows.length} linhas encontradas)
              </p>
            </div>
            <div className="overflow-auto max-h-24">
              <Table>
                <TableHeader>
                  <TableRow>
                    {raw.headers.map((h) => (
                      <TableHead className="text-xs whitespace-nowrap" key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {raw.rows.slice(0, 3).map((row, i) => (
                    <TableRow key={`preview-${i + 1}`}>
                      {row.map((cell, j) => (
                        <TableCell className="text-xs whitespace-nowrap" key={`cell-${i + 1}-${j + 1}`}>
                          {cell || "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Campos obrigatórios — grid 4 colunas */}
          {requiredCols.length > 0 && (
            <div className="grid gap-4 grid-cols-4">
              {requiredCols.map((col) => (
                <div className="flex flex-col gap-2" key={col.key}>
                  <label className="text-xs font-medium text-muted-foreground">
                    {col.label}
                    <span className="text-destructive ml-0.5">*</span>
                  </label>
                  <Combobox
                    className="w-full h-8 text-xs"
                    emptyMessage="Nenhuma coluna"
                    onValueChange={(v) =>
                      onMappingChange({ ...mapping, [col.key]: v === "__none__" ? "" : v })
                    }
                    options={headerOptions}
                    placeholder="Selecionar coluna..."
                    searchPlaceholder="Buscar coluna..."
                    value={mapping[col.key] || "__none__"}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Campos opcionais — grid 3 colunas */}
          {optionalCols.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {optionalCols.map((col) => (
                <div className="flex flex-col gap-2" key={col.key}>
                  <label className="text-xs font-medium text-muted-foreground">{col.label}</label>
                  <Combobox
                    className="w-full h-8 text-xs"
                    emptyMessage="Nenhuma coluna"
                    onValueChange={(v) =>
                      onMappingChange({ ...mapping, [col.key]: v === "__none__" ? "" : v })
                    }
                    options={headerOptions}
                    placeholder="— Ignorar —"
                    searchPlaceholder="Buscar coluna..."
                    value={mapping[col.key] || "__none__"}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </CredenzaBody>
      <CredenzaFooter>
        <div className="flex gap-2">
          <Button className="flex-none" onClick={() => methods.navigation.prev()} type="button" variant="outline">
            Voltar
          </Button>
          <Button className="flex-1" disabled={!canProceed} onClick={handleApply} type="button">
            Aplicar mapeamento
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CredenzaFooter>
    </>
  );
}

// ── PreviewStep ───────────────────────────────────────────────────────────────

function PreviewStep({
  methods, rows, columns,
}: {
  methods: ImportStepperMethods;
  rows: ParsedRow[];
  columns: ImportableColumn[];
}) {
  const visibleColumns = columns.filter(
    (c) => c.required || rows.some((r) => r[c.key]),
  );

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>Prévia dos Dados</CredenzaTitle>
        <CredenzaDescription>{rows.length} linha(s) encontrada(s) no arquivo</CredenzaDescription>
      </CredenzaHeader>
      <CredenzaBody className="px-4">
        <div className="flex flex-col gap-4 w-full">
          <StepIndicator methods={methods} />
          <div className="overflow-auto max-h-52 rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map((col) => (
                    <TableHead className="text-xs p-2" key={col.key}>{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={`row-${i + 1}`}>
                    {visibleColumns.map((col) => (
                      <TableCell className="p-2 text-xs" key={col.key}>
                        {row[col.key] || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell className="py-6 text-center text-xs text-muted-foreground" colSpan={visibleColumns.length}>
                      Nenhum dado para importar
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CredenzaBody>
      <CredenzaFooter>
        <div className="flex gap-2">
          <Button className="flex-none" onClick={() => methods.navigation.prev()} type="button" variant="outline">
            Voltar
          </Button>
          <Button
            className="flex-1"
            disabled={rows.length === 0}
            onClick={() => methods.navigation.next()}
            type="button"
          >
            Continuar
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </CredenzaFooter>
    </>
  );
}

// ── ConfirmStep ───────────────────────────────────────────────────────────────

function ConfirmStep({
  rows, config, onClose,
}: {
  rows: ParsedRow[];
  config: ImportConfig;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleImport() {
    startTransition(async () => {
      try {
        const result = await config.onImport(rows);
        toast.success(`${result.imported} item(s) importado(s) com sucesso.`);
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erro ao importar. Tente novamente.");
      }
    });
  }

  return (
    <>
      <CredenzaHeader>
        <CredenzaTitle>Confirmar Importação</CredenzaTitle>
        <CredenzaDescription>Revise o resumo antes de importar</CredenzaDescription>
      </CredenzaHeader>
      <CredenzaBody className="px-4">
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border overflow-hidden">
            <div className="bg-muted/40 px-4 py-2.5 border-b">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
            </div>
            <div className="divide-y">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Total no arquivo</span>
                <span className="text-sm font-medium">{rows.length}</span>
              </div>
              <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                <span className="text-sm font-medium">Serão importados</span>
                <span className="text-sm font-bold text-primary">{rows.length}</span>
              </div>
            </div>
          </div>
          {rows.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-700">Não há dados para importar.</p>
            </div>
          )}
        </div>
      </CredenzaBody>
      <CredenzaFooter>
        <div className="flex gap-2">
          <Button className="flex-none" disabled={isPending} onClick={onClose} type="button" variant="outline">
            Cancelar
          </Button>
          <Button
            className="flex-1"
            disabled={isPending || rows.length === 0}
            onClick={handleImport}
            type="button"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Importar {rows.length} item(s)
          </Button>
        </div>
      </CredenzaFooter>
    </>
  );
}

// ── ImportWizard ──────────────────────────────────────────────────────────────

function ImportWizard({
  methods, columns, config, onClose,
}: {
  methods: ImportStepperMethods;
  columns: ImportableColumn[];
  config: ImportConfig;
  onClose: () => void;
}) {
  const currentId = methods.state.current.data.id;
  const [rawData, setRawData] = useState<RawData | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>(() =>
    Object.fromEntries(columns.map((c) => [c.key, ""])),
  );
  const [rows, setRows] = useState<ParsedRow[]>([]);

  function handleReady(data: RawData) {
    setRawData(data);
    setMapping((prev) => ({ ...prev, ...guessMapping(data.headers, columns) }));
  }

  return (
    <>
      {currentId === "upload" && (
        <UploadStep methods={methods} config={config} columns={columns} onReady={handleReady} />
      )}
      {currentId === "mapping" && rawData && (
        <MappingStep
          methods={methods}
          raw={rawData}
          columns={columns}
          mapping={mapping}
          onMappingChange={setMapping}
          onApply={setRows}
        />
      )}
      {currentId === "preview" && (
        <Suspense fallback={<StepLoadingFallback title="Prévia dos Dados" />}>
          <PreviewStep methods={methods} rows={rows} columns={columns} />
        </Suspense>
      )}
      {currentId === "confirm" && (
        <Suspense fallback={<StepLoadingFallback title="Confirmar Importação" />}>
          <ConfirmStep rows={rows} config={config} onClose={onClose} />
        </Suspense>
      )}
    </>
  );
}

// ── Exportação pública ────────────────────────────────────────────────────────

export function ImportCredenza({
  columns, config, onClose,
}: {
  columns: ImportableColumn[];
  config: ImportConfig;
  onClose: () => void;
}) {
  return (
    <Stepper.Provider variant="line">
      {({ methods }) => (
        <ImportWizard methods={methods} columns={columns} config={config} onClose={onClose} />
      )}
    </Stepper.Provider>
  );
}
```

### Step 2: Adicionar `DataTableImportButton` ao final de `data-table.tsx`

```typescript
// Em apps/web/src/components/data-table.tsx — adicionar após DataTableExportButton

import { useCredenza } from "@/hooks/use-credenza";
import { ImportCredenza } from "@/components/import-credenza";
import { Upload } from "lucide-react";

function DataTableImportButton<TData, TValue>({
  columns,
  config,
}: {
  columns: ColumnDef<TData, TValue>[];
  config: ImportConfig;
}) {
  const { openCredenza, closeCredenza } = useCredenza();

  const importableColumns: ImportableColumn[] = columns
    .filter((col) => col.meta?.importable)
    .map((col) => ({
      key: "accessorKey" in col ? String(col.accessorKey) : (col.id ?? ""),
      label: col.meta?.label ?? ("accessorKey" in col ? String(col.accessorKey) : (col.id ?? "")),
      required: col.meta?.required ?? false,
      fieldPatterns: col.meta?.fieldPatterns ?? [],
    }));

  function handleOpen() {
    openCredenza({
      renderChildren: () => (
        <ImportCredenza
          columns={importableColumns}
          config={config}
          onClose={closeCredenza}
        />
      ),
    });
  }

  return (
    <Button tooltip="Importar" variant="outline" onClick={handleOpen}>
      <Upload className="size-4" />
    </Button>
  );
}
```

### Step 3: Verificar typecheck

```bash
bun run typecheck 2>&1 | head -30
```

### Step 4: Commit

```bash
git add apps/web/src/components/import-credenza.tsx
git add apps/web/src/components/data-table.tsx
git commit -m "feat(data-table): add ImportCredenza and DataTableImportButton"
```

---

## Task 5: Migrar serviços (proof of concept)

**Files:**
- Modify: `apps/web/src/features/services/ui/services-columns.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/erp/services.tsx`
- Delete: `apps/web/src/features/services/ui/service-import-credenza.tsx`
- Delete: `apps/web/src/features/services/utils/export-services-csv.ts`

### Step 1: Verificar se `orpc.services.bulkCreate` existe

```bash
grep -r "bulkCreate" apps/web/src/integrations/orpc/router/services* 2>/dev/null || echo "não existe"
```

Se não existir, criar a procedure no router antes de continuar.

### Step 2: Adicionar `meta` às colunas de serviços

Em `services-columns.tsx`:

```typescript
export function buildServiceColumns(): ColumnDef<ServiceRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Nome",
      meta: {
        label: "Nome",
        exportable: true,
        importable: true,
        required: true,
        fieldPatterns: ["nome", "name", "servico", "service"],
      },
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "basePrice",
      header: "Preço padrão",
      meta: {
        label: "Preço padrão",
        exportable: true,
        importable: true,
        required: true,
        fieldPatterns: ["preco", "price", "valor", "value", "baseprice"],
      },
      cell: ({ row }) => <span>{format(of(row.original.basePrice, "BRL"), "pt-BR")}</span>,
    },
    {
      accessorKey: "description",
      header: "Descrição",
      meta: {
        label: "Descrição",
        exportable: true,
        importable: true,
        fieldPatterns: ["descricao", "description", "obs"],
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.description ?? "—"}</span>
      ),
    },
    {
      accessorKey: "categoryName",
      header: "Categoria",
      meta: { label: "Categoria", exportable: true },
      // cell existente
    },
    {
      accessorKey: "tagName",
      header: "Centro de Custo",
      meta: { label: "Centro de Custo", exportable: true },
      // cell existente
    },
  ];
}
```

### Step 3: Atualizar `services.tsx`

Remover: `ServiceImportCredenza`, `exportServicesCsv`, ícones `Download`, `Upload`

Adicionar `bulkCreate` mutation e `importConfig` dentro de `ServicesList`:

```typescript
const bulkCreateMutation = useMutation(
  orpc.services.bulkCreate.mutationOptions({
    onSuccess: (data) => toast.success(`${data.created} serviço(s) importado(s).`),
    onError: (e) => toast.error(e.message || "Erro ao importar serviços."),
  }),
);

const importConfig: ImportConfig = {
  label: "Serviços",
  onImport: async (rows) => {
    const result = await bulkCreateMutation.mutateAsync({
      services: rows.map((r) => ({
        name: r.name ?? "",
        basePrice: r.basePrice ?? "0",
        description: r.description || null,
      })),
    });
    return { imported: result.created };
  },
};
```

Atualizar `<DataTable>`:

```tsx
<DataTable
  columns={columns}
  data={filtered}
  getRowId={(row) => row.id}
  sorting={sorting}
  onSortingChange={setSorting}
  columnFilters={columnFilters}
  onColumnFiltersChange={setColumnFilters}
  tableState={tableState}
  onTableStateChange={setTableState}
  exportConfig={{ filename: "servicos" }}
  importConfig={importConfig}
  renderActions={({ row }) => (/* igual ao existente */)}
/>
```

### Step 4: Deletar arquivos obsoletos

```bash
rm apps/web/src/features/services/ui/service-import-credenza.tsx
rm apps/web/src/features/services/utils/export-services-csv.ts
```

### Step 5: Typecheck final

```bash
bun run typecheck 2>&1 | head -40
```

### Step 6: Commit

```bash
git add -A
git commit -m "feat(services): migrate import/export to DataTable block pattern"
```

---

## Fora do escopo (issues separadas)

- Migração de bank-accounts, credit-cards, categories, inventory — mesma mecânica
- `TransactionImportCredenza` — fica como está (OFX, duplicate scoring, edição inline)
- `bulkActions` prop no DataTable
- `packages/ui/data-table.tsx` pode ser deletado após todas as migrações

---

## Referências

- `packages/ui/src/components/data-table.tsx` — origem do arquivo a mover
- `apps/web/src/features/transactions/ui/transaction-import-credenza.tsx` — referência UI/UX
- `apps/web/src/hooks/use-credenza.tsx` — `openCredenza`
- `apps/web/src/hooks/use-csv-file.ts` — parse + generate CSV
- `apps/web/src/hooks/use-xlsx-file.ts` — parse + generate XLSX
- `apps/web/src/features/services/ui/service-import-credenza.tsx` — a ser deletado
- `apps/web/src/features/services/utils/export-services-csv.ts` — a ser deletado
