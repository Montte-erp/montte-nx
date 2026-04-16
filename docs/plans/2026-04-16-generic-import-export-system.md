# Generic Import/Export System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace category-specific import/export with a generic `ImportWizard` + `useExport` system any feature can compose.

**Architecture:** Import wizard is URL-driven Credenza (`?importOpen=true&importStep=upload|map|preview|confirm`) rendered conditionally by the feature page. Feature passes `ImportConfig<T>` to `<ImportWizard>`. Export is a `useExport` hook. `DefaultHeader` auto-renders ⋮ dropdown when `onImport`/`onExportCsv`/`onExportXlsx` props are present. Bulk import is a DBOS workflow — oRPC starts it and returns immediately; existing global `useJobNotifications` handles background progress toasts + cache invalidation via SSE.

**Stack:**
- TanStack Store (`new Store()`) — per-instance wizard state (rawData, mapping, mappedRows, dedupScores)
- TanStack Virtual — virtualized preview rows
- TanStack Query — `useSuspenseQuery` for dedup data, `useQuery` + `experimental_liveOptions` already in `useJobNotifications`
- DBOS — `ImportBatchWorkflow`: steps of 50, starts `DeriveKeywordsWorkflow` per category, publishes `IMPORT_BATCH` progress notifications
- `@f-o-t/csv` via `useCsvFile`, `@f-o-t/ofx` via `fileTypeHandlers` extensibility
- `@f-o-t/condition-evaluator` — server-side only, in `checkDuplicates` oRPC procedure; weighted `ConditionGroup` scoring, `scorePercentage` 0–1 result returned to client
- neverthrow — `fromPromise`, `fromThrowable` throughout
- zod — localStorage mapping validation, search schema

> **Not used (no fit):** TanStack Form (no form fields), TanStack Pacer (mapRows + dedup run once on proceed — not hot path), TanStack Table (virtualizer-only is correct for credenza preview), `batch()` (single store → single `setState` already atomic), foxact hooks (mapping persistence is imperative read/write at parse time, not reactive subscription)

---

## Task 1: Types

**Create:** `apps/web/src/features/import/types.ts`

```typescript
import type { ReactNode } from "react";
import type { ConditionGroup } from "@f-o-t/condition-evaluator";

export type RawData = { headers: string[]; rows: string[][] };

export type ColumnDef = {
  field: string;
  label: string;
  patterns: RegExp[];
  required?: boolean;
};

export type ImportConfig<T> = {
  featureKey: string;
  columns: ColumnDef[];
  template: {
    headers: readonly string[];
    rows: Record<string, string>[];
    filename: string;
  };
  /** Extra file parsers keyed by MIME type. e.g. OFX for transactions. */
  fileTypeHandlers?: Record<string, (file: File) => Promise<RawData>>;
  mapRows: (fieldRecords: Record<string, string>[]) => T[];
  isValid: (row: T) => boolean;
  previewColumns: { header: string; getValue: (row: T) => ReactNode }[];
  onBulkCreate: (rows: T[]) => Promise<void>;
  onSuccess: () => void;
  onClose: () => void;
  /**
   * Server-side dedup. Returns one score (0–1) per input row.
   * Called once, async, during map→preview transition.
   * Typically wraps a useMutation captured in categories.tsx.
   */
  dedup?: {
    checkDuplicates: (rows: T[]) => Promise<number[]>;
  };
};

export type ImportStep = "upload" | "map" | "preview" | "confirm";
export const IMPORT_STEPS = ["upload", "map", "preview", "confirm"] as const satisfies ImportStep[];
```

**Commit:** `feat(import): add generic import types`

---

## Task 2: Extend @packages/notifications

**Modify:** `packages/notifications/src/types.ts`

Add:
```typescript
IMPORT_BATCH: "import.batch",
```

Add to `NotificationPayloadMap`:
```typescript
"import.batch": { importId: string; created: number; total: number };
```

**Modify:** `packages/notifications/src/schema.ts`

Add `"progress"` to the status union:
```typescript
status: z.union([
  z.literal("started"),
  z.literal("progress"),
  z.literal("completed"),
  z.literal("failed"),
]),
```

**Modify:** `apps/web/src/features/notifications/use-job-notifications.ts`

Add `IMPORT_BATCH` handling inside the `useEffect`:
```typescript
if (data.type === NOTIFICATION_TYPES.IMPORT_BATCH && data.status === "completed") {
  queryClient.invalidateQueries({ queryKey: orpc.categories.getAll.queryKey() });
}
```

> Note: `data.status === "progress"` is already handled by the existing `toast.loading(data.message, { id: TOAST_ID })` branch (it shows the message directly — no special case needed).

**Commit:** `feat(notifications): add IMPORT_BATCH type and progress status`

---

## Task 3: column-mapper lib + tests

**Create:**
- `apps/web/src/features/import/lib/column-mapper.ts`
- `apps/web/__tests__/features/import/lib/column-mapper.test.ts`

**Tests first:**

```typescript
import { guessMapping, mappingStorageKey } from "@/features/import/lib/column-mapper";
import type { ColumnDef } from "@/features/import/types";

const DEFS: ColumnDef[] = [
  { field: "name", label: "Nome *", patterns: [/^(nome|name|categoria)$/i], required: true },
  { field: "type", label: "Tipo", patterns: [/^(tipo|type)$/i] },
];

describe("guessMapping", () => {
  it("maps known headers by regex", () => {
    expect(guessMapping(["nome", "tipo"], DEFS)).toEqual({ nome: "name", tipo: "type" });
  });
  it("marks unknown as __skip__", () => {
    expect(guessMapping(["xyz"], DEFS)["xyz"]).toBe("__skip__");
  });
  it("is case-insensitive", () => {
    expect(guessMapping(["NOME"], DEFS)["NOME"]).toBe("name");
  });
});

describe("mappingStorageKey", () => {
  it("is order-independent", () => {
    expect(mappingStorageKey("cat", ["a", "b"])).toBe(mappingStorageKey("cat", ["b", "a"]));
  });
  it("scopes by featureKey", () => {
    expect(mappingStorageKey("cat", ["a"])).not.toBe(mappingStorageKey("tx", ["a"]));
  });
});
```

Run: `npx vitest run apps/web/__tests__/features/import/lib/column-mapper.test.ts` → FAIL

**Implement:**

```typescript
import type { ColumnDef } from "../types";

export function guessMapping(headers: string[], columnDefs: ColumnDef[]) {
  return Object.fromEntries(
    headers.map((header) => {
      const match = columnDefs.find((def) => def.patterns.some((p) => p.test(header)));
      return [header, match ? match.field : "__skip__"];
    }),
  );
}

export function mappingStorageKey(featureKey: string, headers: string[]) {
  return `montte:${featureKey}:import:mapping:${[...headers].sort().join(",")}`;
}
```

Run → PASS. **Commit:** `feat(import): add column-mapper lib with tests`

---

## Task 4: map-rows lib + tests

**Create:**
- `apps/web/src/features/import/lib/map-rows.ts`
- `apps/web/__tests__/features/import/lib/map-rows.test.ts`

**Tests first:**

```typescript
import { applyMapping, getSampleValues } from "@/features/import/lib/map-rows";

const raw = {
  headers: ["nome", "tipo"],
  rows: [["Alimentação", "despesa"], ["", ""], ["  ", "  "]],
};

describe("applyMapping", () => {
  it("maps fields and drops empty rows", () => {
    const result = applyMapping(raw, { nome: "name", tipo: "type" });
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ name: "Alimentação", type: "despesa" });
  });
  it("omits __skip__ columns", () => {
    const result = applyMapping(raw, { nome: "name", tipo: "__skip__" });
    expect(result[0]).not.toHaveProperty("type");
  });
});

describe("getSampleValues", () => {
  it("joins up to 3 non-empty values", () => {
    expect(getSampleValues(raw, "nome")).toBe("Alimentação");
  });
});
```

Run → FAIL

**Implement:**

```typescript
import type { RawData } from "../types";

export function applyMapping(rawData: RawData, mapping: Record<string, string>) {
  const entries = rawData.headers
    .map((header, idx) => ({ field: mapping[header] ?? "__skip__", idx }))
    .filter(({ field }) => field !== "__skip__");

  return rawData.rows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) =>
      Object.fromEntries(entries.map(({ field, idx }) => [field, (row[idx] ?? "").trim()])),
    );
}

export function getSampleValues(rawData: RawData, header: string) {
  const idx = rawData.headers.indexOf(header);
  if (idx === -1) return "";
  return rawData.rows.slice(0, 3).map((r) => r[idx] ?? "").filter(Boolean).join(", ");
}
```

Run → PASS. **Commit:** `feat(import): add map-rows lib with tests`

---

## Task 5: dedup lib + tests

Client-side dedup lib is just the status classifier. All scoring runs server-side.

**Create:**
- `apps/web/src/features/import/lib/dedup.ts`
- `apps/web/__tests__/features/import/lib/dedup.test.ts`

**Tests first:**

```typescript
import { getDedupStatus } from "@/features/import/lib/dedup";

describe("getDedupStatus", () => {
  it("duplicate >= 0.9", () => expect(getDedupStatus(0.9)).toBe("duplicate"));
  it("possible >= 0.5",  () => expect(getDedupStatus(0.7)).toBe("possible"));
  it("new < 0.5",        () => expect(getDedupStatus(0.4)).toBe("new"));
  it("boundary 0.5",     () => expect(getDedupStatus(0.5)).toBe("possible"));
  it("boundary 0.0",     () => expect(getDedupStatus(0.0)).toBe("new"));
});
```

Run: `npx vitest run apps/web/__tests__/features/import/lib/dedup.test.ts` → FAIL

**Implement:**

```typescript
export function getDedupStatus(score: number) {
  if (score >= 0.9) return "duplicate" as const;
  if (score >= 0.5) return "possible" as const;
  return "new" as const;
}
```

Run → PASS. **Commit:** `feat(import): add dedup status classifier`

---

## Task 6: DBOS ImportBatchWorkflow

**Create:** `apps/web/src/integrations/dbos/workflows/import-batch.workflow.ts`

Pattern: follow `derive-keywords.workflow.ts` exactly — class with `@DBOS.workflow()` + `@DBOS.step()` decorators, `jobPublisher` for notifications, repositories for DB access.

Input (inline type, no alias):
```typescript
// passed from oRPC importBatch:
{
  importId: string;       // crypto.randomUUID() from oRPC
  teamId: string;
  organizationId: string;
  userId: string;
  stripeCustomerId: string | null;
  categories: Array<{ name, type, color, icon, keywords, subcategories }>;
}
```

Workflow steps:
1. `publishStep(notification)` — same as in DeriveKeywordsWorkflow
2. `batchStep(batch, offset)` — `@DBOS.step()`: creates categories in a DB transaction via repository (`createCategory`). Returns `{ created: { id, name, description }[] }`.
3. After each `batchStep`: publish `progress` notification `{ importId, created: offset + batch.length, total }`, then start `DeriveKeywordsWorkflow` for each parent category.
4. On complete: publish `completed` notification.
5. On error: publish `failed` notification, re-throw.

Workflow slices input into chunks of 50: `for (let i = 0; i < categories.length; i += 50)`.

Workflow ID: `import-batch-${teamId}-${importId}` — unique per import.

**Register** in `apps/web/src/integrations/dbos/workflows/index.ts` (same pattern as `DeriveKeywordsWorkflow`).

**Add to `runner.ts`:**
```typescript
export function startImportBatchWorkflow(input: /* infer from workflow class */): void {
  if (!registry.ImportBatchWorkflow) return;
  void DBOS.startWorkflow(registry.ImportBatchWorkflow, {
    workflowID: `import-batch-${input.teamId}-${input.importId}`,
  })
    .run(input)
    .catch((err) => logger.error({ err, teamId: input.teamId }, "Failed to start import-batch workflow"));
}
```

**Modify** `apps/web/src/integrations/orpc/router/categories.ts`:

1. **`importBatch` procedure** — replace inline loop with workflow:
   - Generate `importId = crypto.randomUUID()`
   - Call `startImportBatchWorkflow({ importId, teamId: context.teamId, organizationId: context.organizationId, userId: context.userId, stripeCustomerId: userRecord?.stripeCustomerId ?? null, categories: input.categories })`
   - Return `{ importId }` immediately

2. **Add `checkDuplicates` procedure** — server-side dedup scoring using `@f-o-t/condition-evaluator`:
   ```typescript
   export const checkDuplicates = protectedProcedure
     .input(z.object({ names: z.array(z.string().min(1)) }))
     .handler(async ({ context, input }) => {
       const existing = await listCategories(context.db, context.teamId, { includeArchived: false });
       const parents = existing.filter((c) => c.parentId === null);
       return input.names.map((name) => {
         if (parents.length === 0) return 0;
         const context = { data: { name: name.toLowerCase() } };
         return Math.max(
           ...parents.map((e) => {
             const group = {
               id: e.id,
               operator: "OR" as const,
               scoringMode: "weighted" as const,
               conditions: [
                 { id: `${e.id}-name`, type: "string" as const, field: "name",
                   operator: "ilike" as const, value: e.name.toLowerCase(),
                   options: { weight: 1.0 } },
               ],
             };
             const result = evaluateConditionGroup(group, context);
             return result.scorePercentage ?? (result.passed ? 1 : 0);
           }),
         );
       });
     });
   ```
   Add import: `import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";`
   Register in router as `checkDuplicates`.

**Commit:** `feat(import): add DBOS ImportBatchWorkflow + server-side checkDuplicates`

---

## Task 7: UploadStep component

**Create:** `apps/web/src/features/import/steps/upload-step.tsx`

Props (inline, no named interface): `config: ImportConfig<T>`, `stepBar: ReactNode`, `onParsed: (raw: RawData) => void`.

- Parses CSV/XLSX via `useCsvFile`/`useXlsxFile` in `useTransition` + `fromPromise`
- For `config.fileTypeHandlers`: check `config.fileTypeHandlers?.[file.type]` first, fallback to CSV/XLSX parsers; merge MIME types into dropzone `accept`
- Template sub-credenza via `useCredenza` — CSV+XLSX from `config.template`; `download(blob, filename)` via `useFileDownload`
- Error: `toast.error("Arquivo inválido ou corrompido.")` on parse failure

Pattern: generalize from `UploadStep` + `TemplateCredenza` in `category-import-credenza.tsx`.

**Commit:** `feat(import): add generic UploadStep`

---

## Task 8: MapStep component

**Create:** `apps/web/src/features/import/steps/map-step.tsx`

Props (inline): `config`, `rawData`, `mapping: Record<string,string>`, `savedMappingApplied`, `stepBar`, `onMappingChange`, `onProceed`, `onBack`, `onResetMapping`.

- Field options built from `config.columns` + `{ value: "__skip__", label: "Ignorar" }` prepended
- `canProceed`: every `config.columns.filter(c => c.required)` field appears in `Object.values(mapping)`
- On "Continuar": saves mapping to `localStorage.setItem(mappingStorageKey(config.featureKey, rawData.headers), JSON.stringify(mapping))`, then calls `onProceed(mapping)`
- "Mapeamento anterior aplicado" banner + `onResetMapping` button when `savedMappingApplied`

Pattern: generalize from `MapStep` in `category-import-credenza.tsx`.

**Commit:** `feat(import): add generic MapStep`

---

## Task 9: PreviewStep component

**Create:** `apps/web/src/features/import/steps/preview-step.tsx`

Props (inline): `config`, `rows`, `dedupScores: number[] | null`, `stepBar`, `onProceed`, `onBack`.

> `dedupScores` is pre-computed in ImportWizard (not here) — this prevents O(N×M) condition evaluations per virtualizer frame.

- Virtualizes rows with `useVirtualizer`
- Renders `config.previewColumns.map(col => col.getValue(row))` per row
- If `dedupScores !== null`: `getDedupStatus(dedupScores[virtualRow.index])` → badge (`destructive` = Duplicata, `secondary` = Possível, `outline` = Novo)
- Appends valid/invalid icon via `config.isValid(row)`
- `canProceed`: at least one valid row

Pattern: generalize from `PreviewStep` in `category-import-credenza.tsx`.

**Commit:** `feat(import): add generic PreviewStep`

---

## Task 10: ConfirmStep component

**Create:** `apps/web/src/features/import/steps/confirm-step.tsx`

Props (inline): `config`, `rows`, `stepBar`, `onBack`.

- Shows total/invalid/will-import summary
- Calls `config.onBulkCreate(validRows)` in `useTransition` + `fromPromise`
- On success: `config.onSuccess()` — wizard closes; DBOS workflow runs in background; global `useJobNotifications` handles progress toasts + cache invalidation automatically
- On error: `toast.error(msg)`
- Button disabled while `isPending`

> No SSE subscription here — `useJobNotifications` (already mounted in `_dashboard.tsx`) handles all `IMPORT_BATCH` notifications globally.

Pattern: generalize from `ConfirmStep` in `category-import-credenza.tsx`.

**Commit:** `feat(import): add generic ConfirmStep`

---

## Task 11: ImportWizard orchestrator

**Create:** `apps/web/src/features/import/import-wizard.tsx`

Renders `<Credenza open onOpenChange>` directly — not via `useCredenza` store (open state IS the URL).

**State** (per-instance TanStack Store):
```typescript
const [store] = useState(() =>
  new Store({
    rawData: null as RawData | null,
    mapping: {} as Record<string, string>,
    savedMappingApplied: false,
    mappedRows: [] as T[],
    dedupScores: null as number[] | null,
  })
);
```

**Props** (inline): `config: ImportConfig<T>`, `step: ImportStep`, `onStepChange: (s: ImportStep) => void`, `onClose: () => void`.

**Key behaviors:**

1. **F5 guard** (`useEffect`): if `step !== "upload"` and `store.state.rawData === null` → `onStepChange("upload")`

2. **On file parsed** (`handleParsed`):
   - Read `localStorage.getItem(mappingStorageKey(config.featureKey, raw.headers))`
   - Validate with `fromThrowable(JSON.parse)` + `z.record(z.string(), z.string()).safeParse(...)`
   - If valid saved mapping: `store.setState(s => ({ ...s, rawData: raw, mapping: saved, savedMappingApplied: true }))`
   - Else: `store.setState(s => ({ ...s, rawData: raw, mapping: guessMapping(raw.headers, config.columns), savedMappingApplied: false }))`
   - `onStepChange("map")`

3. **On map proceed** (`handleMapProceed(finalMapping)`): async, runs in `useTransition` + `fromPromise`
   - `applyMapping(rawData, finalMapping)` → `config.mapRows(fieldRecords)` → `rows`
   - Server-side dedup scores (called once, result stored — no per-render recomputation):
     ```typescript
     const scores = config.dedup
       ? await config.dedup.checkDuplicates(rows)
       : null;
     ```
   - `store.setState(s => ({ ...s, mappedRows: rows, dedupScores: scores }))`
   - `onStepChange("preview")`
   - "Continuar" button in MapStep disabled while `isPending`

4. **StepBar**: segments from `IMPORT_STEPS.indexOf(step)`

5. **Renders** active step component, passing relevant slice of store state as props. Use `useStore(store, s => s.rawData)` etc. for selector-based reading.

**Commit:** `feat(import): add ImportWizard orchestrator with TanStack Store`

---

## Task 12: useExport hook

**Create:** `apps/web/src/hooks/use-export.ts`

```typescript
export function useExport<T>({ data, filename, columns }: {
  data: T[];
  filename: string;
  columns: { label: string; getValue: (row: T) => string }[];
}) {
  const csv = useCsvFile();
  const xlsx = useXlsxFile();
  const { download } = useFileDownload();
  const headers = columns.map((c) => c.label);
  const buildRows = useCallback(
    () => data.map((row) => Object.fromEntries(columns.map((c) => [c.label, c.getValue(row)]))),
    [data, columns],
  );
  const exportCsv = useCallback(() => { download(csv.generate(buildRows(), headers), `${filename}.csv`); toast.success("Exportado."); }, [buildRows, csv, download, filename, headers]);
  const exportXlsx = useCallback(() => { download(xlsx.generate(buildRows(), headers), `${filename}.xlsx`); toast.success("Exportado."); }, [buildRows, xlsx, download, filename, headers]);
  return { exportCsv, exportXlsx };
}
```

**Commit:** `feat(import): add useExport hook`

---

## Task 13: DefaultHeader — import/export props

**Modify:** `apps/web/src/components/default-header.tsx`

Add optional props: `onImport?`, `onExportCsv?`, `onExportXlsx?`.

When any present: prepend ⋮ `DropdownMenu` before `actions`:
- `onImport` → "Importar" item (`<Upload />`)
- `onExportCsv`/`onExportXlsx` → "Exportar" submenu with CSV/XLSX items

Compose: `<div className="flex gap-2">{importExportDropdown}{actions}</div>`.

**Commit:** `feat(import): add import/export props to DefaultHeader`

---

## Task 14: Category import config + wire categories.tsx

**Create:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-config.ts`

```typescript
import type { ColumnDef, ImportConfig } from "@/features/import/types";
import { Badge } from "@packages/ui/components/badge";

export type MappedCategory = {
  name: string;
  type: "income" | "expense" | null;
  color: string | null;
  icon: string | null;
  keywords: string[] | null;
  subcategories: { name: string; keywords: string[] | null }[];
};

const COLUMN_DEFS: ColumnDef[] = [
  { field: "name",               label: "Nome *",                       patterns: [/^(nome|name|categoria|category)$/i], required: true },
  { field: "type",               label: "Tipo (receita/despesa)",        patterns: [/^(tipo|type)$/i] },
  { field: "color",              label: "Cor (hex)",                     patterns: [/^(cor|color)$/i] },
  { field: "icon",               label: "Ícone",                         patterns: [/^(icone|ícone|icon)$/i] },
  { field: "keywords",           label: "Palavras-chave (sep. por ;)",   patterns: [/^(palavras?.?chave|keywords?)$/i] },
  { field: "subcategory",        label: "Subcategoria",                  patterns: [/^(subcategoria|subcategory|sub)$/i] },
  { field: "subcategoryKeywords",label: "Palavras-chave (Sub)",          patterns: [/^(palavras?.?chave.*sub|sub.*keywords?)$/i] },
];

const TEMPLATE = {
  headers: ["nome","tipo","cor","icone","palavras-chave","subcategoria","palavras-chave-sub"] as const,
  rows: [
    { nome:"Alimentação", tipo:"despesa", cor:"#ef4444", icone:"utensils", "palavras-chave":"mercado;restaurante", subcategoria:"Supermercado", "palavras-chave-sub":"pao;leite" },
    { nome:"Alimentação", tipo:"despesa", cor:"#ef4444", icone:"utensils", "palavras-chave":"mercado;restaurante", subcategoria:"Restaurante",  "palavras-chave-sub":"almoco;jantar" },
    { nome:"Salário",     tipo:"receita", cor:"#22c55e", icone:"wallet",   "palavras-chave":"salario;pagamento",   subcategoria:"",             "palavras-chave-sub":"" },
  ],
  filename: "modelo-categorias",
};

function parseKeywords(raw: string) {
  const kws = raw.split(/[;,]/).map((k) => k.trim()).filter(Boolean);
  return kws.length > 0 ? kws : null;
}

export function buildMappedCategories(fieldRecords: Record<string, string>[]) {
  const map = new Map<string, MappedCategory>();
  for (const fields of fieldRecords) {
    const name = fields["name"] ?? "";
    if (!name) continue;
    const typeRaw = (fields["type"] ?? "").toLowerCase();
    const type = typeRaw === "receita" || typeRaw === "income" ? "income"
               : typeRaw === "despesa" || typeRaw === "expense" ? "expense"
               : null;
    if (!map.has(name))
      map.set(name, { name, type, color: fields["color"] || null, icon: fields["icon"] || null, keywords: parseKeywords(fields["keywords"] ?? ""), subcategories: [] });
    const cat = map.get(name)!;
    const subName = (fields["subcategory"] ?? "").trim();
    if (subName) {
      const sub = cat.subcategories.find((s) => s.name === subName);
      const subKw = parseKeywords(fields["subcategoryKeywords"] ?? "");
      if (sub) { if (subKw) sub.keywords = [...new Set([...(sub.keywords ?? []), ...subKw])]; }
      else cat.subcategories.push({ name: subName, keywords: subKw });
    }
  }
  return Array.from(map.values());
}

export function buildImportPayload(rows: MappedCategory[]) {
  return rows
    .filter((c) => c.type !== null)
    .map((c) => ({
      name: c.name, type: c.type as "income" | "expense",
      color: c.color, icon: c.icon, keywords: c.keywords,
      subcategories: c.subcategories.map((s) => ({ name: s.name, keywords: s.keywords ?? undefined })),
    }));
}

export function createCategoryImportConfig(
  onBulkCreate: ImportConfig<MappedCategory>["onBulkCreate"],
  onSuccess: () => void,
  onClose: () => void,
  checkDuplicates: (rows: MappedCategory[]) => Promise<number[]>,
): ImportConfig<MappedCategory> {
  return {
    featureKey: "categories",
    columns: COLUMN_DEFS,
    template: TEMPLATE,
    mapRows: buildMappedCategories,
    isValid: (row) => row.type !== null,
    previewColumns: [
      { header: "Nome", getValue: (c) => c.name },
      {
        header: "Tipo",
        getValue: (c) =>
          c.type === "income" ? <Badge variant="outline" className="text-green-600 border-green-600">Receita</Badge>
          : c.type === "expense" ? <Badge variant="destructive">Despesa</Badge>
          : <span className="text-sm text-muted-foreground">—</span>,
      },
      {
        header: "Subcategorias",
        getValue: (c) =>
          c.subcategories.length > 0 ? <Badge variant="secondary">{c.subcategories.length}</Badge>
          : <span className="text-sm text-muted-foreground">—</span>,
      },
    ],
    onBulkCreate,
    onSuccess,
    onClose,
    dedup: {
      checkDuplicates: (rows) => checkDuplicates(rows),
    },
  };
}
```

**Modify** `categories.tsx`:

1. Add to `categoriesSearchSchema` (avoid `import` reserved word — use `importOpen`):
   ```typescript
   importOpen: z.enum(["true"]).optional(),
   importStep: z.enum(["upload", "map", "preview", "confirm"]).catch("upload").default("upload"),
   ```

2. In `CategoriesPageContent`, read `const { importOpen, importStep, ...rest } = Route.useSearch()`.

3. Add mutations:
   ```typescript
   const importBatchMutation = useMutation(orpc.categories.importBatch.mutationOptions());
   const checkDupsMutation = useMutation(orpc.categories.checkDuplicates.mutationOptions());
   ```

4. `handleImport` → `navigate({ search: (prev) => ({ ...prev, importOpen: "true", importStep: "upload" }) })`.

5. Wrap `createCategoryImportConfig(...)` in `useMemo`:
   ```typescript
   const importConfig = useMemo(() =>
     createCategoryImportConfig(
       (rows) => importBatchMutation.mutateAsync({ categories: buildImportPayload(rows) }).then(() => undefined),
       () => navigate({ search: (prev) => ({ ...prev, importOpen: undefined, importStep: undefined }) }),
       () => navigate({ search: (prev) => ({ ...prev, importOpen: undefined, importStep: undefined }) }),
       (rows) => checkDupsMutation.mutateAsync({ names: rows.map((r) => r.name) }),
     ),
     // eslint-disable-next-line react-hooks/exhaustive-deps
     [],
   );
   ```

6. Render conditionally:
   ```tsx
   {importOpen === "true" && (
     <ImportWizard
       config={importConfig}
       step={importStep as ImportStep}
       onStepChange={(s) => navigate({ search: (prev) => ({ ...prev, importStep: s }), replace: true })}
       onClose={() => navigate({ search: (prev) => ({ ...prev, importOpen: undefined, importStep: undefined }) })}
     />
   )}
   ```

7. Replace `<DefaultHeader actions={<DropdownMenu...>}>` with `onImport={handleImport} onExportCsv={handleExport} onExportXlsx={handleExportXlsx}` props.

8. Export uses `useMutation` wrapping `queryClient.fetchQuery` (on-demand, full export with `includeArchived: true` — `useExport` hook doesn't fit since data isn't already in cache):
   ```typescript
   const exportMutation = useMutation({
     mutationFn: () => queryClient.fetchQuery(orpc.categories.exportAll.queryOptions({ input: {} })),
     meta: { skipGlobalInvalidation: true },
   });
   const { download } = useFileDownload();
   const csvFile = useCsvFile();
   const xlsxFile = useXlsxFile();
   const handleExportCsv = useCallback(async () => {
     const result = await fromPromise(exportMutation.mutateAsync(), (e) => e);
     if (result.isErr()) { toast.error("Erro ao exportar."); return; }
     const rows = buildExportRows(result.value);  // ← keep this function in category-import-config.ts
     download(csvFile.generate(rows, EXPORT_HEADERS), "categorias.csv");
   }, [exportMutation, download, csvFile]);
   ```
   Same pattern for XLSX with `xlsxFile.generate`.

9. Remove: `CategoryImportCredenza`, `exportCategoriesCsv`, `buildExportRows`, `EXPORT_HEADERS`, all `DropdownMenu*` imports.

**Commit:** `feat(import): wire categories to generic ImportWizard + URL state`

---

## Task 15: Delete old files

```bash
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/category-import-credenza.tsx"
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/use-category-import.tsx"
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/export-categories-csv.ts"
```

`bun run typecheck` — fix dangling imports.

**Commit:** `refactor(import): delete old category-specific import/export files`

---

## Task 16: Final verification

```bash
bun run typecheck
bun run test
```

Fix failures. **Commit** if needed.
