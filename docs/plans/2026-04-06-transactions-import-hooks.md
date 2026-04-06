# Transactions Import Hooks Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract all file-parsing and normalization logic from `statement-import-credenza.tsx` into 3 colocated hooks so the component is UI-only.

**Architecture:** Three hooks live in `-transactions/` alongside the credenza. They call the format libs (`@f-o-t/csv`, `@f-o-t/ofx`, `xlsx`) directly — no wrappers. Shared pure utils (parseDate, parseAmount, inferType, validateRow, etc.) live in a single `-transactions/import-utils.ts` file that all 3 hooks import from. No new package, no barrel files.

**Tech Stack:** TypeScript, React, `@f-o-t/ofx`, `@f-o-t/csv`, `@f-o-t/money`, `dayjs`, `xlsx`

---

### Task 1: Extract shared pure utils

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/import-utils.ts`

Extract all pure (non-React, non-UI) functions from `statement-import-credenza.tsx`. These are the ones currently defined at module scope before the component definitions.

**Step 1: Create `import-utils.ts`**

Copy from the credenza (exact line ranges are approximate — verify by reading the file):

```typescript
import { of as moneyOf, format as moneyFormat, toMajorUnitsString } from "@f-o-t/money";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

// ---- Types ----------------------------------------------------------------

export type FileFormat = "csv" | "xlsx" | "ofx";

export type ParsedRow = {
  date: string;
  name: string;
  type: "income" | "expense";
  amount: string;
  description: string;
  categoryId?: string;
};

export type ValidatedRow = ParsedRow & { isValid: boolean; errors: string[] };

export type RawData = {
  headers: string[];
  rows: string[][];
};

export type ColumnField = "date" | "name" | "type" | "amount" | "description";

export type ColumnMapping = Record<ColumnField, string>;

export const COLUMN_FIELDS: ColumnField[] = ["date", "name", "type", "amount", "description"];
export const REQUIRED_FIELDS: ColumnField[] = ["date", "amount"];
export const FIELD_LABELS: Record<ColumnField, string> = {
  date: "Data *",
  name: "Nome",
  type: "Tipo",
  amount: "Valor *",
  description: "Descrição",
};

// ---- Date -----------------------------------------------------------------

const DATE_FORMATS = [
  "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY",
  "DD-MM-YYYY", "YYYYMMDD", "DD/MM/YY",
] as const;

export function parseDate(raw: string): string | null {
  const dateOnly = raw
    .trim()
    .replace(/\s*às\s*\d{1,2}:\d{2}(:\d{2})?/i, "")
    .replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, "")
    .replace(/T\d{2}:\d{2}.*$/, "")
    .trim();
  for (const fmt of DATE_FORMATS) {
    const d = dayjs(dateOnly, fmt, true);
    if (d.isValid()) return d.format("YYYY-MM-DD");
  }
  return null;
}

// ---- Amount ---------------------------------------------------------------

export function parseAmount(raw: string): string | null {
  const cleaned = raw.replace(/R\$\s*/g, "").trim();
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized: string;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  } else {
    normalized = cleaned;
  }
  try {
    return toMajorUnitsString(moneyOf(normalized, "BRL")).replace("-", "");
  } catch {
    return null;
  }
}

export function formatMoney(value: string): string {
  const normalized = parseAmount(value) ?? value;
  try {
    return moneyFormat(moneyOf(normalized, "BRL"), "pt-BR");
  } catch {
    return value;
  }
}

// ---- Type inference -------------------------------------------------------

const OFX_INCOME_TYPES = new Set(["CREDIT", "INT", "DIV", "DIRECTDEP"]);

export function inferTypeFromOfx(trnType: string, trnAmt: number): "income" | "expense" {
  if (trnAmt > 0) return "income";
  if (trnAmt < 0) return "expense";
  if (OFX_INCOME_TYPES.has(trnType)) return "income";
  return "expense";
}

const INCOME_NAME_PATTERNS = [
  "recebido", "recebimento", "depósito", "deposito", "salário", "salario",
  "crédito", "credito", "pix recebido", "transferência recebida",
  "ted recebida", "doc recebido", "rendimento", "reembolso", "estorno",
];
const EXPENSE_NAME_PATTERNS = [
  "enviado", "pagamento", "compra", "débito", "debito", "pix enviado",
  "transferência enviada", "ted enviada", "doc enviado", "saque",
  "tarifa", "cobrança", "boleto",
];

export function inferTypeFromName(name: string): "income" | "expense" | null {
  const n = name.toLowerCase();
  if (INCOME_NAME_PATTERNS.some((p) => n.includes(p))) return "income";
  if (EXPENSE_NAME_PATTERNS.some((p) => n.includes(p))) return "expense";
  return null;
}

export function inferType(raw: string, amount: number): "income" | "expense" {
  const t = raw.toLowerCase().trim();
  if (["receita", "income", "crédito", "credito", "credit"].includes(t)) return "income";
  if (["despesa", "expense", "débito", "debito", "debit"].includes(t)) return "expense";
  if (amount < 0) return "expense";
  return "expense";
}

// ---- Validation -----------------------------------------------------------

export function validateRow(row: ParsedRow, minDate?: string | null): ValidatedRow {
  const errors: string[] = [];
  const parsedDate = parseDate(row.date);
  if (!parsedDate) errors.push("Data inválida");
  if (parsedDate && minDate && parsedDate < minDate)
    errors.push(`Anterior à abertura da empresa (${dayjs(minDate).format("DD/MM/YYYY")})`);
  if (!row.amount || parseAmount(row.amount) === null) errors.push("Valor inválido");
  return { ...row, isValid: errors.length === 0, errors };
}

// ---- Column mapping -------------------------------------------------------

const COLUMN_PATTERNS: Record<ColumnField, string[]> = {
  date: ["data", "date", "dt", "data_lancamento"],
  name: ["nome", "name", "historico", "memo", "descricao"],
  type: ["tipo", "type", "natureza", "operacao"],
  amount: ["valor", "value", "amount", "montante", "vlr"],
  description: ["descricao", "description", "obs", "complemento"],
};

export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const mapping: Partial<ColumnMapping> = {};
  for (const field of COLUMN_FIELDS) {
    const idx = lower.findIndex((h) =>
      COLUMN_PATTERNS[field].some((c) => h.includes(c)),
    );
    if (idx !== -1) mapping[field] = headers[idx];
  }
  return mapping;
}

export function getSampleValues(raw: RawData, header: string): string {
  const idx = raw.headers.indexOf(header);
  if (idx === -1) return "";
  return raw.rows.slice(0, 3).map((r) => r[idx] ?? "").filter(Boolean).join(", ");
}

export function mappingStorageKey(headers: string[]): string {
  return `montte:import:mapping:${[...headers].sort().join(",")}`;
}

export function applyMapping(
  row: string[],
  headers: string[],
  mapping: ColumnMapping,
): ParsedRow {
  const get = (field: ColumnField): string => {
    const header = mapping[field];
    if (!header) return "";
    const idx = headers.indexOf(header);
    return idx !== -1 ? (row[idx] ?? "") : "";
  };
  const rawAmount = get("amount");
  const numericAmount = Number.parseFloat(rawAmount.replace(/[^\d.,-]/g, "").replace(",", "."));
  const rawType = get("type");
  const name = get("name");
  const type =
    rawType.trim() !== ""
      ? inferType(rawType, numericAmount)
      : numericAmount < 0
        ? "expense"
        : (inferTypeFromName(name) ?? "expense");
  return { date: get("date"), name, type, amount: rawAmount, description: get("description") };
}
```

**Step 2: Verify** — all the above functions are currently in the credenza. Cross-check by searching:

```bash
grep -n "^function \|^const.*=.*function\|^export function" \
  apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/import-utils.ts
git commit -m "feat(transactions): extract import-utils with shared pure functions"
```

---

### Task 2: `useCsvImport` hook

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-csv-import.ts`

CSV needs a column-mapping step — the hook returns `RawData` from `parse()` so the component can render the mapping UI, then `applyColumns()` to get final `ParsedRow[]`.

**Step 1: Create the hook**

```typescript
import { parseBufferOrThrow } from "@f-o-t/csv";
import { applyMapping, guessMapping } from "./import-utils";
import type { ColumnMapping, ParsedRow, RawData } from "./import-utils";

export function useCsvImport() {
  function parse(buffer: ArrayBuffer): RawData {
    const doc = parseBufferOrThrow(new Uint8Array(buffer), {
      hasHeaders: true,
      trimFields: true,
    });
    return {
      headers: doc.headers,
      rows: doc.rows.map((r) => r.fields),
    };
  }

  function applyColumns(raw: RawData, mapping: ColumnMapping): ParsedRow[] {
    return raw.rows.map((row) => applyMapping(row, raw.headers, mapping));
  }

  return { parse, guessMapping, applyColumns };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/use-csv-import.ts
git commit -m "feat(transactions): add useCsvImport hook"
```

---

### Task 3: `useXlsxImport` hook

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-xlsx-import.ts`

Same shape as `useCsvImport` — returns `RawData` + mapping helpers.

**Step 1: Create the hook**

```typescript
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { applyMapping, guessMapping } from "./import-utils";
import type { ColumnMapping, ParsedRow, RawData } from "./import-utils";

export function useXlsxImport() {
  function parse(buffer: ArrayBuffer): RawData {
    const wb = xlsxRead(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("Planilha vazia");
    const data = xlsxUtils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    if (data.length < 2) throw new Error("Planilha sem dados");
    return {
      headers: (data[0] as unknown[]).map(String),
      rows: (data.slice(1) as unknown[][])
        .filter((r) => r.some((c) => String(c).trim() !== ""))
        .map((r) => r.map(String)),
    };
  }

  function applyColumns(raw: RawData, mapping: ColumnMapping): ParsedRow[] {
    return raw.rows.map((row) => applyMapping(row, raw.headers, mapping));
  }

  return { parse, guessMapping, applyColumns };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/use-xlsx-import.ts
git commit -m "feat(transactions): add useXlsxImport hook"
```

---

### Task 4: `useOfxImport` hook

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-ofx-import.ts`

OFX is self-describing — no column mapping step. Returns `ParsedRow[]` directly from `parse()`.

**Step 1: Read how the credenza currently handles OFX** — search for `parseBufferOrThrow` and `getTransactions` in the file to confirm which fields are read off each transaction object.

**Step 2: Create the hook**

```typescript
import { parseBufferOrThrow, getTransactions } from "@f-o-t/ofx";
import { inferTypeFromOfx, parseDate } from "./import-utils";
import type { ParsedRow } from "./import-utils";

export function useOfxImport() {
  function parse(buffer: ArrayBuffer): ParsedRow[] {
    const doc = parseBufferOrThrow(new Uint8Array(buffer));
    const txs = getTransactions(doc);
    return txs.map((tx) => ({
      // Adjust field names to match OFXTransaction from @f-o-t/ofx if needed
      date: parseDate(tx.datePosted ?? "") ?? tx.datePosted ?? "",
      name: tx.name ?? tx.memo ?? "",
      type: inferTypeFromOfx(tx.trnType ?? "", tx.trnAmt ?? 0),
      amount: String(Math.abs(tx.trnAmt ?? 0)),
      description: tx.memo ?? "",
    }));
  }

  return { parse };
}
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/use-ofx-import.ts
git commit -m "feat(transactions): add useOfxImport hook"
```

---

### Task 5: Refactor `statement-import-credenza.tsx` to use the hooks

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx`

**Step 1: Remove the now-extracted code** from the credenza:

- All inline function definitions that moved to `import-utils.ts`: `parseDate`, `parseAmount`, `formatMoney`, `inferType`, `inferTypeFromOfx`, `inferTypeFromName`, `validateRow`, `guessMapping`, `getSampleValues`, `mappingStorageKey`, `applyMapping`
- All inline constants that moved: `OFX_INCOME_TYPES`, `INCOME_NAME_PATTERNS`, `EXPENSE_NAME_PATTERNS`, `COLUMN_PATTERNS`, `FIELD_LABELS`, `COLUMN_FIELDS`, `REQUIRED_FIELDS`
- The direct `@f-o-t/csv`, `@f-o-t/ofx`, `xlsx` imports (now inside the hooks)

**Step 2: Add imports at the top**

```typescript
import {
  parseDate,
  parseAmount,
  formatMoney,
  validateRow,
  getSampleValues,
  mappingStorageKey,
  COLUMN_FIELDS,
  REQUIRED_FIELDS,
  FIELD_LABELS,
} from "./-transactions/import-utils";
import type {
  FileFormat,
  ParsedRow,
  ValidatedRow,
  RawData,
  ColumnField,
  ColumnMapping,
} from "./-transactions/import-utils";
import { useCsvImport } from "./-transactions/use-csv-import";
import { useXlsxImport } from "./-transactions/use-xlsx-import";
import { useOfxImport } from "./-transactions/use-ofx-import";
```

> Note: the credenza file itself is already inside `-transactions/`, so imports are relative: `"./import-utils"`, `"./use-csv-import"`, etc.

**Step 3: Replace inline parsing calls** in the upload step handler with the hook:

```typescript
// Before (inside component):
const csv = useCsvImport();
const xlsx = useXlsxImport();
const ofx = useOfxImport();

// In file onLoad handler:
if (format === "csv") setRawData(csv.parse(buffer));
if (format === "xlsx") setRawData(xlsx.parse(buffer));
if (format === "ofx") setRows(ofx.parse(buffer));  // skips mapping step
```

**Step 4: Run typecheck**

```bash
bun run typecheck
```

Expected: no errors.

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
git commit -m "refactor(transactions): credenza delegates parsing to import hooks"
```

---

## Done

`statement-import-credenza.tsx` is now UI-only. All parsing logic is colocated in:

```
-transactions/
  import-utils.ts         ← pure functions & types
  use-csv-import.ts        ← CSV hook
  use-xlsx-import.ts       ← XLSX hook
  use-ofx-import.ts        ← OFX hook
  statement-import-credenza.tsx
```
