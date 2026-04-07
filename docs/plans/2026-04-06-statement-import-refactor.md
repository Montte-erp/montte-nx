# Statement Import Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `useStatementImport` and `StatementImportCredenza` to use proper `@f-o-t/money`, proper dayjs, replace raw HTML with UI components, eliminate unnecessary `useState` with foxact/tanstack alternatives, and simplify try/catch patterns.

**Architecture:**
- `parseAmount` already normalizes before calling `of()` (required since `of()` only accepts decimal strings, not `R$ 1.234,56`). Use `absolute` instead of `.replace("-", "")` to drop the sign.
- `sumOrZero` from `@f-o-t/money` replaces the verbose reduce+try/catch pattern for totals in the credenza.
- `bankAccountId` moves to `useLocalStorage` (foxact) so the last selection persists across wizard opens.
- `isParsing` in `UploadStep` moves to `useTransition` (React) per project auth-client pattern.
- All raw `<button>`, `<input>`, `<label>` → `<Button>`, `<Input>`, `<Label>` from the UI library. Filter toggles → `<Toggle>` from `@packages/ui/components/toggle`.

**Tech Stack:** `@f-o-t/money` (`absolute`, `sumOrZero`, `of`, `toMajorUnitsString`), `foxact/use-local-storage`, `useTransition`, `@packages/ui/components/{button,input,label,toggle}`.

**Note on `useCsvFile`/`useXlsxFile` in credenza:** These are **correct** — `TemplateCredenza` uses `.generate()` for template download. No change needed.

---

### Task 1: `use-statement-import.ts` — money + bankAccountId persistence

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts`

**Changes:**

**1a. `parseAmount` — use `absolute` instead of string replace:**

Current:
```ts
return toMajorUnitsString(moneyOf(normalized, "BRL")).replace("-", "");
```
Replace with:
```ts
import { of as moneyOf, toMajorUnitsString, absolute } from "@f-o-t/money";
// ...
return toMajorUnitsString(absolute(moneyOf(normalized, "BRL")));
```
The normalization above (removing `R$`, handling comma/dot) stays — `of()` only accepts decimal strings. `absolute` drops the minus sign without string manipulation.

**1b. `bankAccountId` → `useLocalStorage`:**

Current:
```ts
const [bankAccountId, setBankAccountId] = useState("");
```
Replace with:
```ts
import { useLocalStorage } from "foxact/use-local-storage";
// ...
const [bankAccountId, setBankAccountId] = useLocalStorage<string>(
  "montte:import:bankAccountId",
  "",
);
```
Remove `useState` import if no longer used elsewhere in the hook (check — `rawData`, `rows`, `duplicateFlags`, `format`, `mapping`, `savedMappingApplied` still use it).

**1c. Remove `useState` import for `bankAccountId` only if other states still need it — keep the import.**

**Steps:**

1. Edit `use-statement-import.ts`: add `absolute` to `@f-o-t/money` imports, replace `.replace("-", "")` with `absolute()`.
2. Add `useLocalStorage` import from `foxact/use-local-storage`, replace `useState("")` for `bankAccountId`.
3. Run `bun run typecheck` — fix errors in this file.
4. Commit:
   ```bash
   git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.ts
   git commit -m "refactor(import): parseAmount use absolute, bankAccountId useLocalStorage"
   ```

---

### Task 2: `statement-import-credenza.tsx` — `sumOrZero` for money totals

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx`

**Current (lines ~566–583):**
```ts
const totalIncome = rows
  .filter((r) => r.isValid && r.type === "income")
  .reduce((sum, r) => {
    try {
      return moneyAdd(sum, moneyOf(parseAmount(r.amount) ?? "0", "BRL"));
    } catch {
      return sum;
    }
  }, moneyZero("BRL"));
```

**Replace with `sumOrZero`:**
```ts
import { of as moneyOf, format as moneyFormat, sumOrZero } from "@f-o-t/money";
// Remove: add as moneyAdd, zero as moneyZero

const totalIncome = sumOrZero(
  rows
    .filter((r) => r.isValid && r.type === "income")
    .map((r) => moneyOf(parseAmount(r.amount) ?? "0", "BRL")),
  "BRL",
);
const totalExpense = sumOrZero(
  rows
    .filter((r) => r.isValid && r.type === "expense")
    .map((r) => moneyOf(parseAmount(r.amount) ?? "0", "BRL")),
  "BRL",
);
```

Remove `add as moneyAdd` and `zero as moneyZero` from imports — only `of`, `format`, `sumOrZero` needed.

**`formatMoney` try/catch** — keep as-is. It's a genuine defensive guard around `moneyOf` which can throw on malformed strings.

**Steps:**

1. Update `@f-o-t/money` import: remove `add as moneyAdd, zero as moneyZero`, add `sumOrZero`.
2. Replace both `reduce` blocks with `sumOrZero` + `.map()`.
3. Run `bun run typecheck` — fix errors.
4. Commit:
   ```bash
   git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
   git commit -m "refactor(import): replace money reduce/try-catch with sumOrZero"
   ```

---

### Task 3: `UploadStep` — `useTransition` for loading state

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx`

**Current:**
```ts
const [isParsing, setIsParsing] = useState(false);
// ...
setIsParsing(true);
try {
  await parseFile(file);
  ...
} catch {
  ...
} finally {
  setIsParsing(false);
}
```

**Replace with `useTransition`:**
```ts
import { useTransition } from "react";
// remove useState for isParsing

const [isPending, startTransition] = useTransition();

async function handleFile(file: File) {
  if (!bankAccountId) return;
  setSelectedFile(file);
  startTransition(async () => {
    try {
      await parseFile(file);
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "ofx") {
        methods.navigation.goTo("preview");
      } else {
        methods.navigation.next();
      }
    } catch {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "ofx") toast.error("Erro ao processar arquivo OFX.");
      else if (ext === "xlsx" || ext === "xls")
        toast.error("Erro ao processar planilha XLSX.");
      else toast.error("Erro ao processar arquivo CSV.");
      setSelectedFile(undefined);
    }
  });
}
```

Replace all `isParsing` references with `isPending`.

Also on the same `UploadStep` — replace the "Baixar modelo" raw `<button>`:

**Current (line ~324):**
```tsx
<button
  type="button"
  className="text-xs text-muted-foreground underline underline-offset-2 self-start"
  onClick={...}
>
  Baixar modelo
</button>
```

**Replace with:**
```tsx
import { Button } from "@packages/ui/components/button";
// ...
<Button
  type="button"
  variant="link"
  size="sm"
  className="self-start px-0 text-muted-foreground"
  onClick={...}
>
  Baixar modelo
</Button>
```

Remove `useState` for `isParsing` if `useTransition` fully replaces it. `selectedFile` stays as `useState`.

**Steps:**

1. Import `useTransition` from `react`, remove `isParsing` useState.
2. Replace `handleFile` implementation.
3. Replace `isParsing` references with `isPending`.
4. Replace "Baixar modelo" `<button>` with `<Button variant="link" size="sm">`.
5. Run `bun run typecheck`.
6. Commit:
   ```bash
   git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
   git commit -m "refactor(import): useTransition for isParsing, Button for baixar modelo"
   ```

---

### Task 4: `TemplateCredenza` + `MapStep` — raw `<button>` → `<Button>`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx`

**4a. `TemplateCredenza` download buttons (lines ~134–173):**

These are styled download option rows. Replace raw `<button>` with `<Button variant="outline">`:
```tsx
<Button
  type="button"
  variant="outline"
  className="flex items-center gap-4 w-full px-4 py-3 h-auto text-left justify-start"
  onClick={() => {
    download(csv.generate(TEMPLATE_ROWS, [...TEMPLATE_HEADERS]), "modelo-importacao.csv");
    onClose?.();
  }}
>
  <FileSpreadsheet className="size-5 text-emerald-600 shrink-0" />
  <div className="flex flex-col gap-0.5 flex-1">
    <span className="text-sm font-medium">CSV</span>
    <span className="text-xs text-muted-foreground">
      Compatível com qualquer planilha ou editor de texto
    </span>
  </div>
  <Download className="size-4 text-muted-foreground shrink-0" />
</Button>
```
Same for the XLSX button.

**4b. `MapStep` "Redefinir" button (line ~385):**

Current:
```tsx
<button
  type="button"
  className="text-xs text-muted-foreground hover:text-foreground"
  onClick={onDismissSavedMapping}
>
  Redefinir
</button>
```
Replace with:
```tsx
<Button
  type="button"
  variant="ghost"
  size="sm"
  className="text-xs text-muted-foreground h-auto py-0 px-1"
  onClick={onDismissSavedMapping}
>
  Redefinir
</Button>
```

**Steps:**

1. Replace both download `<button>` elements in `TemplateCredenza`.
2. Replace "Redefinir" `<button>` in `MapStep`.
3. Run `bun run typecheck`.
4. Commit:
   ```bash
   git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
   git commit -m "refactor(import): replace raw buttons in TemplateCredenza and MapStep"
   ```

---

### Task 5: `PreviewStep` — `<Input>`, `<Label>`, `<Toggle>` for raw elements

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx`

**5a. Inline description `<input>` → `<Input>` (line ~828):**

Current:
```tsx
<input
  autoFocus
  className="text-xs border rounded px-1 py-0.5 w-full bg-background"
  value={editingDescValue}
  onChange={(e) => setEditingDescValue(e.target.value)}
  onBlur={() => commitDescEdit(originalIndex)}
  onKeyDown={(e) => { ... }}
  onClick={(e) => e.stopPropagation()}
/>
```
Replace with:
```tsx
import { Input } from "@packages/ui/components/input";
// ...
<Input
  autoFocus
  className="text-xs h-7 py-0"
  value={editingDescValue}
  onChange={(e) => setEditingDescValue(e.target.value)}
  onBlur={() => commitDescEdit(originalIndex)}
  onKeyDown={(e) => { ... }}
  onClick={(e) => e.stopPropagation()}
/>
```

**5b. "Selecionar todas válidas" `<label>` → `<Label>` (line ~709):**

Current:
```tsx
<label
  htmlFor="select-all"
  className="text-xs text-muted-foreground cursor-pointer"
>
  Selecionar todas válidas
</label>
```
Replace with:
```tsx
import { Label } from "@packages/ui/components/label";
// ...
<Label
  htmlFor="select-all"
  className="text-xs text-muted-foreground cursor-pointer"
>
  Selecionar todas válidas
</Label>
```

**5c. Filter toggle buttons → `<Toggle>` (lines ~717–741):**

Current:
```tsx
<button
  type="button"
  onClick={() => setFilterDuplicates(false)}
  className={["rounded-full px-3 py-1 text-xs transition-colors",
    !filterDuplicates ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"].join(" ")}
>
  Todas
</button>
<button
  type="button"
  onClick={() => setFilterDuplicates(true)}
  className={["rounded-full px-3 py-1 text-xs transition-colors",
    filterDuplicates ? "bg-yellow-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"].join(" ")}
>
  Duplicatas
</button>
```
Replace with `<Toggle>`:
```tsx
import { Toggle } from "@packages/ui/components/toggle";
// ...
<div className="flex items-center gap-2">
  <Toggle
    size="sm"
    pressed={!filterDuplicates}
    onPressedChange={() => setFilterDuplicates(false)}
    className="rounded-full text-xs"
  >
    Todas
  </Toggle>
  <Toggle
    size="sm"
    pressed={filterDuplicates}
    onPressedChange={() => setFilterDuplicates(true)}
    className="rounded-full text-xs data-[state=on]:bg-yellow-500 data-[state=on]:text-white"
  >
    Duplicatas
  </Toggle>
</div>
```

**Steps:**

1. Add `Input` import from `@packages/ui/components/input`.
2. Replace description `<input>` with `<Input>`.
3. Add `Label` import from `@packages/ui/components/label`.
4. Replace `<label>` with `<Label>`.
5. Add `Toggle` import from `@packages/ui/components/toggle`.
6. Replace filter `<button>` pair with `<Toggle>` pair.
7. Remove `useState` import line if `useState` is no longer used — double-check: `filterDuplicates`, `editingDescIdx`, `editingDescValue` still use it. Keep the import.
8. Run `bun run typecheck`.
9. Commit:
   ```bash
   git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
   git commit -m "refactor(import): Input/Label/Toggle for raw elements in PreviewStep"
   ```

---

### Task 6: Typecheck

```bash
bun run typecheck
```

Fix any errors introduced. Common ones:
- `sumOrZero` type — it accepts `Money[]` and `CurrencyCode`. Ensure `moneyOf(parseAmount(r.amount) ?? "0", "BRL")` produces `Money`.
- `useLocalStorage` generic type `<string>` — if the stored value can be null/undefined from a stale key, the default `""` covers it.
- `Toggle` `pressed`/`onPressedChange` — these are standard Radix toggle props, no issues expected.

Commit if any fixes needed:
```bash
git commit -m "fix(import): typecheck fixes after refactor"
```
