# Import Wizard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the statement import credenza with a better DE PARA step (inline sample data + localStorage mapping cache), bank account selection in step 1, duplicate detection in preview, and financial totals.

**Architecture:** All changes are UI-only except Task 1 (new backend procedure `transactions.checkDuplicates`). The wizard state machine gains `bankAccountId` at the top level. DE PARA saves/loads from localStorage keyed by sorted column headers fingerprint. Duplicate check is a single mutation call at the end of the map step (or start of preview step) using the new procedure.

**Tech Stack:** React, TanStack Query, oRPC, Drizzle ORM, `foxact/create-local-storage-state`, `@packages/ui/components/stepper`, `@packages/ui/components/credenza`

---

## Task 1: Add `checkDuplicates` oRPC procedure

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts` (verify it's already exported via barrel or direct)

**Step 1: Add the procedure**

In `transactions.ts`, after the `importStatement` export, add:

```typescript
export const checkDuplicates = protectedProcedure
   .input(
      z.object({
         bankAccountId: z.string().uuid(),
         transactions: z.array(
            z.object({
               date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
               amount: z.string().regex(/^-?\d+(\.\d+)?$/),
               type: z.enum(["income", "expense"]),
            }),
         ).min(1).max(1000),
      }),
   )
   .handler(async ({ context, input }) => {
      await ensureBankAccountOwnership(
         context.db,
         input.bankAccountId,
         context.teamId,
      );

      const existing = await context.db
         .select({
            date: transactions.date,
            amount: transactions.amount,
            type: transactions.type,
         })
         .from(transactions)
         .where(
            and(
               eq(transactions.bankAccountId, input.bankAccountId),
               eq(transactions.teamId, context.teamId),
               inArray(
                  transactions.date,
                  input.transactions.map((t) => t.date),
               ),
            ),
         );

      const existingSet = new Set(
         existing.map((r) => `${r.date}|${r.amount}|${r.type}`),
      );

      return input.transactions.map((t) =>
         existingSet.has(`${t.date}|${t.amount}|${t.type}`),
      );
   });
```

Note: make sure `and`, `eq`, `inArray` are imported from `drizzle-orm` and `transactions` schema is imported at the top of the file. Check existing imports — they're likely already there.

**Step 2: Wire into router**

Check `apps/web/src/integrations/orpc/router/index.ts` or wherever transactions procedures are assembled. Add `checkDuplicates` the same way `importStatement` is added.

**Step 3: Verify typecheck passes**

```bash
bun run typecheck
```

Expected: no new errors.

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(transactions): add checkDuplicates oRPC procedure"
```

---

## Task 2: Rename import file + move to credenza naming

**Files:**
- Rename: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-dialog-stack.tsx` → `statement-import-credenza.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`

**Step 1: Rename the file**

```bash
mv apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-dialog-stack.tsx \
   apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx
```

**Step 2: Update the import in transactions.tsx**

Change:
```typescript
import { StatementImportDialogStack } from "./-transactions/statement-import-dialog-stack";
```
To:
```typescript
import { StatementImportCredenza } from "./-transactions/statement-import-credenza";
```

And update usage:
```typescript
children: <StatementImportCredenza onClose={closeCredenza} />,
```

**Step 3: Rename the exported function** inside the file from `StatementImportDialogStack` to `StatementImportCredenza`.

**Step 4: Verify typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git commit -m "refactor(transactions): rename import dialog-stack to credenza"
```

---

## Task 3: Wizard state — add bankAccountId at top level

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx`

**Step 1: Add bankAccountId to ImportWizard state**

In `ImportWizard`, add:
```typescript
const [bankAccountId, setBankAccountId] = useState<string>("");
```

**Step 2: Thread bankAccountId down**

- Pass `bankAccountId` and `onBankAccountChange: setBankAccountId` to `UploadStep`.
- Pass `bankAccountId` to `ConfirmStep` (remove the selector from there).

**Step 3: Remove bank account selector from ConfirmStep**

`ConfirmStepInner` currently has `useSuspenseQuery(orpc.bankAccounts.getAll...)` and a `Combobox`. Remove both. The account is now set in step 1.

Update `ConfirmStepInner` props:
```typescript
interface ConfirmStepInnerProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
   format: FileFormat;
   bankAccountId: string;
   onClose?: () => void;
}
```

And use the passed `bankAccountId` directly in `handleImport`.

**Step 4: Verify typecheck**

```bash
bun run typecheck
```

---

## Task 4: UploadStep — add bank account selector

**Files:**
- Modify: `statement-import-credenza.tsx` — `UploadStep` component

**Step 1: Update UploadStep props**

```typescript
interface UploadStepProps {
   methods: StepperMethods;
   bankAccountId: string;
   onBankAccountChange: (id: string) => void;
   onFileReady: (rows: ValidatedRow[], format: FileFormat, raw: RawData | null) => void;
}
```

**Step 2: Add bank account query + selector at top of UploadStep**

Add `useSuspenseQuery` for bank accounts. Wrap `UploadStep` call site in `ErrorBoundary` + `Suspense` (same pattern as `ConfirmStep` currently uses).

Inside `UploadStep` render, before the `Dropzone`, add:

```tsx
<Field>
   <FieldLabel htmlFor="import-account">Conta bancária *</FieldLabel>
   <Combobox
      id="import-account"
      name="import-account"
      options={(bankAccounts ?? []).map((a) => ({ value: a.id, label: a.name }))}
      onValueChange={onBankAccountChange}
      placeholder="Selecionar conta..."
      value={bankAccountId}
   />
</Field>
```

**Step 3: Gate file processing** — only allow `processFile` if `bankAccountId !== ""`. Disable the dropzone and show helper text if no account selected yet.

```tsx
<Dropzone
   disabled={isParsing || !bankAccountId}
   ...
>
```

Below the dropzone, add the template download link (only shown when account is selected):
```tsx
{bankAccountId && (
   <button
      type="button"
      className="text-xs text-muted-foreground underline underline-offset-2"
      onClick={handleDownloadTemplate}
   >
      Baixar modelo CSV
   </button>
)}
```

The template download function:
```typescript
function handleDownloadTemplate() {
   const headers = "data,nome,tipo,valor,descricao\n2024-01-15,Pagamento fornecedor,despesa,1500.00,NF 123";
   const blob = new Blob([headers], { type: "text/csv;charset=utf-8;" });
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = "modelo-importacao.csv";
   a.click();
   URL.revokeObjectURL(url);
}
```

**Step 4: Verify typecheck + visual check**

---

## Task 5: DE PARA step — inline sample data + localStorage mapping cache

**Files:**
- Modify: `statement-import-credenza.tsx` — `MapStep` component + top-level helpers

**Step 1: Add headers fingerprint helper**

At module level:
```typescript
function headersFingerprint(headers: string[]): string {
   return [...headers].sort().join(",");
}

function mappingStorageKey(headers: string[]): string {
   return `montte:import:mapping:${headersFingerprint(headers)}`;
}
```

**Step 2: Load saved mapping on mount**

In `ImportWizard.handleFileReady`, after `guessMapping`, check localStorage:

```typescript
function handleFileReady(parsedRows: ValidatedRow[], fmt: FileFormat, raw: RawData | null) {
   setFormat(fmt);
   if (raw) {
      setRawData(raw);
      const saved = localStorage.getItem(mappingStorageKey(raw.headers));
      if (saved) {
         try {
            const parsed = JSON.parse(saved) as ColumnMapping;
            setMapping((prev) => ({ ...prev, ...parsed }));
            setSavedMappingApplied(true);
         } catch {
            const guessed = guessMapping(raw.headers);
            setMapping((prev) => ({ ...prev, ...guessed }));
         }
      } else {
         const guessed = guessMapping(raw.headers);
         setMapping((prev) => ({ ...prev, ...guessed }));
      }
   }
   if (parsedRows.length > 0) setRows(parsedRows);
}
```

Add `savedMappingApplied` state to `ImportWizard`:
```typescript
const [savedMappingApplied, setSavedMappingApplied] = useState(false);
```

Pass `savedMappingApplied` and `onDismissSavedMapping` to `MapStep`.

**Step 3: Save mapping on proceed**

In `MapStep.handleNext`, before calling `onApply`, save to localStorage:

```typescript
localStorage.setItem(mappingStorageKey(raw.headers), JSON.stringify(mapping));
```

**Step 4: Update MapStep props + render**

```typescript
interface MapStepProps {
   methods: StepperMethods;
   raw: RawData;
   mapping: ColumnMapping;
   savedMappingApplied: boolean;
   onMappingChange: (m: ColumnMapping) => void;
   onApply: (rows: ValidatedRow[]) => void;
   onDismissSavedMapping: () => void;
}
```

Add the "mapeamento anterior aplicado" banner (shown when `savedMappingApplied`):

```tsx
{savedMappingApplied && (
   <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">Mapeamento anterior aplicado</p>
      <button
         type="button"
         className="text-xs text-muted-foreground hover:text-foreground"
         onClick={onDismissSavedMapping}
      >
         Redefinir
      </button>
   </div>
)}
```

**Step 5: Add sample values column to each mapping row**

Extract sample values helper:
```typescript
function getSampleValues(raw: RawData, header: string): string {
   const idx = raw.headers.indexOf(header);
   if (idx === -1) return "";
   return raw.rows
      .slice(0, 3)
      .map((r) => r[idx] ?? "")
      .filter(Boolean)
      .join(", ");
}
```

Update the mapping row render:

```tsx
{COLUMN_FIELDS.map((field) => (
   <div className="grid grid-cols-[7rem_1fr_auto] items-center gap-4" key={field}>
      <span className="text-sm font-medium shrink-0">
         {FIELD_LABELS[field]}
      </span>
      <Combobox
         options={[
            { value: "__none__", label: "— Não mapear —" },
            ...raw.headers.map((h) => ({ value: h, label: h })),
         ]}
         onValueChange={(v) =>
            onMappingChange({ ...mapping, [field]: v === "__none__" ? "" : v })
         }
         value={mapping[field] || "__none__"}
      />
      {mapping[field] && mapping[field] !== "__none__" ? (
         <p className="text-xs text-muted-foreground max-w-32 truncate">
            {getSampleValues(raw, mapping[field])}
         </p>
      ) : (
         <p className="w-32" />
      )}
   </div>
))}
```

**Step 6: Verify typecheck**

---

## Task 6: PreviewStep — totals, date range, duplicate flags

**Files:**
- Modify: `statement-import-credenza.tsx` — `PreviewStep` component + `ImportWizard`

**Step 1: Add duplicate detection**

After map step applies rows, call `checkDuplicates` mutation. Store result as `duplicateFlags: boolean[]` in `ImportWizard` state.

In `ImportWizard`:
```typescript
const [duplicateFlags, setDuplicateFlags] = useState<boolean[]>([]);
const checkDuplicatesMutation = useMutation(
   orpc.transactions.checkDuplicates.mutationOptions({}),
);
```

In `MapStep.handleNext` callback (`onApply`), after `setRows`, trigger the check:
```typescript
// In ImportWizard, pass onApply that also calls the mutation:
async function handleApplyRows(mapped: ValidatedRow[]) {
   setRows(mapped);
   if (bankAccountId) {
      try {
         const flags = await checkDuplicatesMutation.mutateAsync({
            bankAccountId,
            transactions: mapped
               .filter((r) => r.isValid)
               .map((r) => ({
                  date: parseDate(r.date) ?? r.date,
                  amount: parseAmount(r.amount) ?? r.amount,
                  type: r.type,
               })),
         });
         // flags array corresponds to valid rows only — rebuild full-length array
         let fi = 0;
         setDuplicateFlags(
            mapped.map((r) => (r.isValid ? (flags[fi++] ?? false) : false)),
         );
      } catch {
         setDuplicateFlags([]);
      }
   }
}
```

Pass `duplicateFlags` to `PreviewStep`.

**Step 2: Update PreviewStep props**

```typescript
interface PreviewStepProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
   duplicateFlags: boolean[];
}
```

**Step 3: Compute totals + date range**

```typescript
const validRows = rows.filter((r) => r.isValid);
const totalIncome = validRows
   .filter((r) => r.type === "income")
   .reduce((sum, r) => sum + (Number.parseFloat(parseAmount(r.amount) ?? "0")), 0);
const totalExpense = validRows
   .filter((r) => r.type === "expense")
   .reduce((sum, r) => sum + (Number.parseFloat(parseAmount(r.amount) ?? "0")), 0);

const dates = validRows.map((r) => parseDate(r.date)).filter(Boolean) as string[];
const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
```

**Step 4: Add totals + date range UI above table**

```tsx
<div className="flex items-center gap-4">
   <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
      <span className="text-xs text-muted-foreground">Entradas</span>
      <span className="text-xs font-semibold text-emerald-600">
         {formatMoney(String(totalIncome))}
      </span>
   </div>
   <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
      <span className="text-xs text-muted-foreground">Saídas</span>
      <span className="text-xs font-semibold text-destructive">
         {formatMoney(String(totalExpense))}
      </span>
   </div>
   {minDate && maxDate && (
      <p className="text-xs text-muted-foreground ml-auto">
         {dayjs(minDate).format("DD/MM/YYYY")} – {dayjs(maxDate).format("DD/MM/YYYY")}
      </p>
   )}
</div>
```

**Step 5: Mark duplicate rows in table**

In the table row render, check `duplicateFlags[i]`:

```tsx
{previewRows.map((row, i) => (
   <TableRow
      className={row.isValid ? (duplicateFlags[i] ? "bg-yellow-500/5" : "") : "bg-destructive/5"}
      key={`prev-${i + 1}`}
   >
      ...
      <TableCell className="text-xs">
         {!row.isValid ? (
            <AlertTriangle className="size-3.5 text-destructive" />
         ) : duplicateFlags[i] ? (
            <AlertTriangle className="size-3.5 text-yellow-500" title="Possível duplicata" />
         ) : (
            <CheckCircle2 className="size-3.5 text-emerald-600" />
         )}
      </TableCell>
   </TableRow>
))}
```

**Step 6: Update duplicate badge counts**

Add to badge row:
```tsx
const duplicateCount = duplicateFlags.filter(Boolean).length;
// ...
{duplicateCount > 0 && (
   <Badge variant="warning">{duplicateCount} possível(is) duplicata(s)</Badge>
)}
```

Note: check if `"warning"` variant exists in your Badge component — if not use `"outline"` with a `className="text-yellow-600 border-yellow-300"`.

**Step 7: Verify typecheck**

---

## Task 7: ConfirmStep — use bankAccountId from props, show duplicate warning

**Files:**
- Modify: `statement-import-credenza.tsx` — `ConfirmStepInner`

**Step 1: Remove bank account query + selector**

Remove `useSuspenseQuery(orpc.bankAccounts.getAll...)`, the `useState<string>("")` for bankAccountId, and the `Combobox` for account selection. The `bankAccountId` now comes from props.

**Step 2: Add duplicate skip option**

If there are duplicates in the import, show a checkbox:

```tsx
const duplicateCount = duplicateFlags?.filter(Boolean).length ?? 0;
const [skipDuplicates, setSkipDuplicates] = useState(true);

// In handleImport, filter based on skipDuplicates:
const rowsToImport = validRows.filter((_, i) =>
   skipDuplicates ? !duplicateFlags?.[i] : true,
);
```

Add to the summary section:
```tsx
{duplicateCount > 0 && (
   <div className="flex items-center justify-between px-4 py-2.5">
      <label htmlFor="skip-duplicates" className="text-sm text-muted-foreground cursor-pointer">
         Ignorar possíveis duplicatas
      </label>
      <input
         id="skip-duplicates"
         type="checkbox"
         checked={skipDuplicates}
         onChange={(e) => setSkipDuplicates(e.target.checked)}
      />
   </div>
)}
```

Use the `Checkbox` component from `@packages/ui/components/checkbox` if available, not a raw `input`.

**Step 3: Update summary counts to reflect skip**

The "Serão importadas" count should show `rowsToImport.length`.

**Step 4: Verify typecheck**

**Step 5: Commit everything**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx
git add apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(transactions): redesign import wizard with DE PARA, duplicate detection, account in step 1"
```

---

## Final Checklist

- [ ] `checkDuplicates` procedure returns correct boolean array
- [ ] Bank account selected in step 1 blocks file upload until chosen
- [ ] Saved mapping auto-applies and shows banner with reset option
- [ ] Sample values render for mapped columns
- [ ] Preview shows income/expense totals + date range
- [ ] Duplicate rows highlighted yellow with warning icon
- [ ] Confirm step shows duplicate skip checkbox when duplicates exist
- [ ] "Serão importadas" count updates based on skip toggle
- [ ] `bun run typecheck` passes clean
