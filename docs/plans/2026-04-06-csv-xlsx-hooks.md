# CSV & XLSX Web App Hooks Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create two reusable web app hooks — `useCsvFile` and `useXlsxFile` — that standardize file reading and parsing. Then refactor `useStatementImport` and `PreviewStep` to use the right foxact primitives throughout.

**Architecture:** Hooks live in `apps/web/src/hooks/`. `useStatementImport` uses `useLocalStorage` (foxact) for mapping persistence and `useDebouncedCallback` (pacer) for the duplicate-check network call. `PreviewStep` uses `useSet` (foxact) for `selectedIndices` — replacing manual `new Set()` mutation patterns. `useDebouncedState` handles the transient bulk-action inputs.

**Tech Stack:** `@f-o-t/csv`, `xlsx`, `foxact/use-local-storage`, `foxact/use-set`, `foxact/use-debounced-state`, `useDebouncedCallback` from `@tanstack/react-pacer`

---

### Task 1: Create `useCsvFile`

**Files:**

- Create: `apps/web/src/hooks/use-csv-file.ts`

```typescript
import { parseBufferOrThrow } from "@f-o-t/csv";

export type CsvData = {
   headers: string[];
   rows: string[][];
};

function parseCsvBuffer(buffer: ArrayBuffer): CsvData {
   const doc = parseBufferOrThrow(new Uint8Array(buffer), {
      hasHeaders: true,
      trimFields: true,
   });
   return {
      headers: doc.headers ?? [],
      rows: doc.rows.map((r) => r.fields),
   };
}

export function useCsvFile() {
   function readFile(file: File): Promise<CsvData> {
      return new Promise((resolve, reject) => {
         const reader = new FileReader();
         reader.onload = (ev) => {
            try {
               const buffer = ev.target?.result;
               if (!(buffer instanceof ArrayBuffer))
                  throw new Error("read error");
               resolve(parseCsvBuffer(buffer));
            } catch (err) {
               reject(err);
            }
         };
         reader.onerror = () => reject(new Error("Falha ao ler arquivo CSV"));
         reader.readAsArrayBuffer(file);
      });
   }

   return { parse: parseCsvBuffer, readFile };
}
```

**Commit:**

```bash
git add apps/web/src/hooks/use-csv-file.ts
git commit -m "feat(hooks): add useCsvFile hook"
```

---

### Task 2: Create `useXlsxFile`

**Files:**

- Create: `apps/web/src/hooks/use-xlsx-file.ts`

```typescript
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";

export type XlsxData = {
   headers: string[];
   rows: string[][];
};

function parseXlsxBuffer(buffer: ArrayBuffer): XlsxData {
   const wb = xlsxRead(buffer, { type: "array" });
   const ws = wb.Sheets[wb.SheetNames[0]];
   if (!ws) throw new Error("Planilha vazia");
   const data = xlsxUtils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
   });
   if (data.length < 2) throw new Error("Planilha sem dados");
   return {
      headers: (data[0] as unknown[]).map(String),
      rows: (data.slice(1) as unknown[][])
         .filter((r) => r.some((c) => String(c).trim() !== ""))
         .map((r) => r.map(String)),
   };
}

export function useXlsxFile() {
   function readFile(file: File): Promise<XlsxData> {
      return new Promise((resolve, reject) => {
         const reader = new FileReader();
         reader.onload = (ev) => {
            try {
               const buffer = ev.target?.result;
               if (!(buffer instanceof ArrayBuffer))
                  throw new Error("read error");
               resolve(parseXlsxBuffer(buffer));
            } catch (err) {
               reject(err);
            }
         };
         reader.onerror = () => reject(new Error("Falha ao ler planilha"));
         reader.readAsArrayBuffer(file);
      });
   }

   return { parse: parseXlsxBuffer, readFile };
}
```

**Commit:**

```bash
git add apps/web/src/hooks/use-xlsx-file.ts
git commit -m "feat(hooks): add useXlsxFile hook"
```

---

### Task 3: Refactor `useStatementImport` — CSV/XLSX hooks + localStorage + debounce

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts`

#### 3a — Use `useCsvFile` / `useXlsxFile`

Add imports:

```typescript
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
```

Inside `useStatementImport`:

```typescript
const csv = useCsvFile();
const xlsx = useXlsxFile();
```

In `parseFile`, replace the inline parse calls:

```typescript
// before
const raw =
   ext === "xlsx" || ext === "xls" ? parseXlsx(buffer) : parseCsv(buffer);

// after
const raw =
   ext === "xlsx" || ext === "xls" ? xlsx.parse(buffer) : csv.parse(buffer);
```

Delete the now-unused module-level `parseCsv` and `parseXlsx` functions and their `@f-o-t/csv` / `xlsx` imports.

#### 3b — Use `useLocalStorage` for mapping persistence

`useLocalStorage` (dynamic key) is correct — the key changes per file based on header fingerprint. **However**, reading the foxact state value inside an async callback (`parseFile`) is a stale closure — the state won't have updated yet after `setRawData`. Solution: read directly from `localStorage` in the callback for the initial load (we already have the key), use foxact's setter only for writes.

```typescript
import { useLocalStorage } from "foxact/use-local-storage";
```

Inside `useStatementImport` (the key can be a stable placeholder when no file is loaded):

```typescript
const [, setSavedMapping] = useLocalStorage<ColumnMapping>(
   rawData
      ? mappingStorageKey(rawData.headers)
      : "montte:import:mapping:__none__",
   undefined,
   {
      serializer: JSON.stringify,
      deserializer: JSON.parse,
   },
);
```

> We only need the setter from this hook — the read happens directly from `localStorage` in `parseFile` (correct value, no stale closure). The setter handles SSR-safe writes and cross-tab sync.

In `parseFile`, replace the raw `localStorage.getItem`:

```typescript
// still reads directly — correct at call time
const stored = localStorage.getItem(mappingStorageKey(raw.headers));
const prior: ColumnMapping | null = stored ? JSON.parse(stored) : null;
if (prior) {
   setMapping((prev) => ({ ...prev, ...prior }));
   setSavedMappingApplied(true);
} else {
   setMapping((prev) => ({ ...prev, ...guessColumns(raw.headers) }));
}
```

In `applyColumnMapping`, replace the raw `localStorage.setItem`:

```typescript
// before
localStorage.setItem(mappingStorageKey(rawData.headers), JSON.stringify(m));

// after
setSavedMapping(m);
```

In `resetMapping`, clear the stored value:

```typescript
function resetMapping() {
   setSavedMappingApplied(false);
   setMapping(EMPTY_MAPPING);
   setSavedMapping(null);
}
```

Remove `export` from `mappingStorageKey` — nothing outside the hook needs it.

#### 3c — Debounce `checkDuplicates` with `useDebouncedCallback`

```typescript
import { useDebouncedCallback } from "@tanstack/react-pacer";
```

Extract the duplicate-check logic out of `applyRows` into a debounced callback. This prevents hammering the API on rapid file re-uploads or bank account switches:

```typescript
const debouncedCheckDuplicates = useDebouncedCallback(
   async (mapped: ValidatedRow[]) => {
      const validRows = mapped.filter((r) => r.isValid);
      if (!bankAccountId || validRows.length === 0) {
         setDuplicateFlags([]);
         initSelection(mapped, []);
         return;
      }
      try {
         const flags = await checkDuplicatesMutation.mutateAsync({
            bankAccountId,
            transactions: validRows.map((r) => ({
               date: parseDate(r.date) ?? r.date,
               amount: parseAmount(r.amount) ?? r.amount,
               type: r.type,
            })),
         });
         let fi = 0;
         const fullFlags = mapped.map((r) =>
            r.isValid ? (flags[fi++] ?? false) : false,
         );
         setDuplicateFlags(fullFlags);
         initSelection(mapped, fullFlags);
      } catch {
         setDuplicateFlags([]);
         initSelection(mapped, []);
      }
   },
   { wait: 400 },
);

const applyRows = useCallback(
   async (mapped: ValidatedRow[]) => {
      setRows(mapped);
      debouncedCheckDuplicates(mapped);
   },
   [debouncedCheckDuplicates],
);
```

**Commit:**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/use-statement-import.ts
git commit -m "refactor(transactions): use shared CSV/XLSX hooks, foxact localStorage, debounced duplicate check"
```

---

### Task 4: Refactor `PreviewStep` — `useSet` + `useDebouncedState`

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx`

#### 4a — `useSet` for `selectedIndices`

`selectedIndices` is currently `Set<number>` managed via `useState` with manual `new Set()` copies everywhere. `useSet` from foxact gives `[set, add, remove, clear, replace]` — replaces every manual mutation.

Move `selectedIndices` state INTO `PreviewStep` (it's local UI state — `ImportWizard` only needs the final count for `ConfirmStep`). Pass `selectedIndices.size` and `selectedIndices` down as needed.

```typescript
import { useSet } from "foxact/use-set";
```

In `PreviewStep`:

```typescript
// before
const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

// after
const [selectedIndices, addIndex, removeIndex, clearIndices, replaceIndices] =
   useSet<number>();
```

Replace manual mutations:

```typescript
// toggleSelectAll
if (allSelected) {
   clearIndices();
} else {
   replaceIndices(new Set(selectableIndices));
}

// toggleRow
if (selectedIndices.has(index)) {
   removeIndex(index);
} else {
   addIndex(index);
}

// ignoreRow
removeIndex(index);

// initSelection (called from hook after duplicate check)
replaceIndices(sel);
```

> Since `selectedIndices` moves into `PreviewStep`, `ImportWizard` passes `buildImportPayload` a closure that captures the current selection, or `ConfirmStep` receives `selectedCount` instead of the full set.

#### 4b — `useDebouncedState` for bulk-action inputs

`bulkDate` and `bulkCategoryId` are set by the user then immediately consumed and reset to `undefined`/`""`. Use `useDebouncedState` so the reset doesn't cause a visible flicker — the committed value persists briefly before clearing:

```typescript
import { useDebouncedState } from "foxact/use-debounced-state";
```

```typescript
// before
const [bulkDate, setBulkDate] = useState<Date | undefined>(undefined);
const [bulkCategoryId, setBulkCategoryId] = useState("");

// after — instant setter for user input, debounced auto-reset
const [bulkDate, setBulkDateImmediate, setBulkDate] = useDebouncedState<
   Date | undefined
>(undefined, 300);
const [bulkCategoryId, setCategoryIdImmediate, setBulkCategoryId] =
   useDebouncedState("", 300);
```

> `useDebouncedState` returns `[debouncedValue, setImmediately, setDebounced]`. Use `setImmediately` for user selection, `setDebounced` for the auto-reset after applying.

**Commit:**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
git commit -m "refactor(transactions): useSet + useDebouncedState in PreviewStep"
```

---

## Done

```
apps/web/src/hooks/
  use-csv-file.ts     ← parse(buffer) + readFile(file)
  use-xlsx-file.ts    ← parse(buffer) + readFile(file)

use-statement-import.ts
  ← useCsvFile + useXlsxFile (tabular parsing)
  ← useLocalStorage setter (foxact) for mapping persistence
  ← useDebouncedCallback (pacer) for checkDuplicates

statement-import-credenza.tsx / PreviewStep
  ← useSet (foxact) for selectedIndices
  ← useDebouncedState (foxact) for bulkDate + bulkCategoryId
```
