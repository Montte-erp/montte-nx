# Importação de Extrato (Bank Statement Import) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to import bank statements (CSV, XLSX, OFX) as a batch, billed as one event per import (`finance.statement_imported`), to feed the reconciliation flow.

**Architecture:** Client-side parsing (CSV via `@f-o-t/csv`, OFX via `@f-o-t/ofx`, XLSX via `xlsx` package) → pre-parsed rows sent to new `importStatement` oRPC procedure → bulk DB insert → single billing event emitted per batch. UI is a 4-step wizard reusing existing `DialogStack` + `Stepper` + `Dropzone` primitives.

**Tech Stack:** oRPC protectedProcedure, Drizzle ORM, `@f-o-t/csv`, `@f-o-t/ofx`, `xlsx` (new), `@packages/ui` stepper/dropzone/dialog-stack, TanStack Query `useMutation`.

---

## Context

- `packages/events/src/finance.ts` — where the new event goes
- `core/stripe/src/constants.ts` — FREE_TIER_LIMITS, EVENT_PRICES, STRIPE_METER_EVENTS
- `apps/web/src/integrations/orpc/router/transactions.ts` — new procedure added here
- `apps/web/src/integrations/orpc/router/index.ts` — no change needed (transactions already registered)
- `apps/web/src/features/transactions/ui/` — new dialog component goes here
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx` — wire the Upload button

---

## Task 1: Add `finance.statement_imported` event

**Files:**
- Modify: `packages/events/src/finance.ts`

**Step 1: Add event key to FINANCE_EVENTS constant**

In `FINANCE_EVENTS` object, add:
```typescript
"finance.statement_imported": "finance.statement_imported",
```

**Step 2: Add schema and emit function**

After the existing emit functions, add:

```typescript
export const financeStatementImportedSchema = z.object({
   bankAccountId: z.string().uuid(),
   format: z.enum(["csv", "xlsx", "ofx"]),
   rowCount: z.number().int().nonnegative(),
});
export type FinanceStatementImportedEvent = z.infer<typeof financeStatementImportedSchema>;

export function emitFinanceStatementImported(
   emit: EmitFn,
   ctx: { organizationId: string; userId?: string; teamId?: string },
   properties: FinanceStatementImportedEvent,
) {
   return emit({
      ...ctx,
      eventName: FINANCE_EVENTS["finance.statement_imported"],
      eventCategory: EVENT_CATEGORIES.finance,
      properties,
   });
}
```

**Step 3: Verify TypeScript compiles (no test for pure event definitions)**

```bash
cd /path/to/worktree && bun run typecheck 2>&1 | grep -i "finance"
```
Expected: no errors from finance.ts

**Step 4: Commit**

```bash
git add packages/events/src/finance.ts
git commit -m "feat(events): add finance.statement_imported event"
```

---

## Task 2: Add billing constants for statement import

**Files:**
- Modify: `core/stripe/src/constants.ts`

**Step 1: Add to FREE_TIER_LIMITS**

```typescript
"finance.statement_imported": 10,
```

**Step 2: Add to EVENT_PRICES**

```typescript
"finance.statement_imported": "0.020000",
```

**Step 3: Add to STRIPE_METER_EVENTS**

```typescript
"finance.statement_imported": "finance_statement_imports",
```

**Step 4: Verify**

```bash
bun run typecheck 2>&1 | grep -i "constants"
```
Expected: no errors

**Step 5: Commit**

```bash
git add core/stripe/src/constants.ts
git commit -m "feat(billing): add finance.statement_imported free tier and pricing"
```

---

## Task 3: Install `xlsx` package for XLSX parsing

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Add xlsx to web app dependencies**

In `apps/web/package.json`, inside `"dependencies"`, add:

```json
"xlsx": "^0.18.5"
```

**Step 2: Install**

```bash
cd /path/to/worktree && bun install
```

Expected: xlsx installed successfully

**Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore(deps): add xlsx for bank statement XLSX parsing"
```

---

## Task 4: Add `importStatement` oRPC procedure

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`

**Context:** The existing `importBulk` creates transactions individually. `importStatement` performs a true bulk insert (single DB round-trip) and emits exactly ONE `finance.statement_imported` billing event per call.

**Step 1: Add new imports at top of file**

```typescript
import { enforceCreditBudget, incrementUsage } from "@packages/events/credits";
import { emitFinanceStatementImported } from "@packages/events/finance";
import { emitEvent } from "@packages/events/emit";
```

> Check `packages/events/src/emit.ts` for exact export — the `emitEvent` function.

**Step 2: Add the procedure at the end of the file**

```typescript
export const importStatement = protectedProcedure
   .input(
      z.object({
         bankAccountId: z.string().uuid(),
         format: z.enum(["csv", "xlsx", "ofx"]),
         transactions: z
            .array(
               z.object({
                  name: z.string().max(500).optional(),
                  type: z.enum(["income", "expense"]),
                  amount: z.string(),
                  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
                  description: z.string().max(1000).optional(),
                  paymentMethod: z
                     .enum([
                        "pix",
                        "credit_card",
                        "debit_card",
                        "boleto",
                        "cash",
                        "transfer",
                        "other",
                        "cheque",
                        "automatic_debit",
                     ])
                     .optional(),
               }),
            )
            .min(1)
            .max(1000),
      }),
   )
   .handler(async ({ context, input }) => {
      await enforceCreditBudget(
         context.organizationId,
         "finance.statement_imported",
         context.redis,
         context.stripeCustomerId,
      );

      const bankAccount = await getBankAccount(
         context.db,
         input.bankAccountId,
         context.teamId,
      );
      if (!bankAccount) throw WebAppError.notFound("Conta bancária não encontrada");

      const rows = input.transactions.map((t) => ({
         teamId: context.teamId,
         bankAccountId: input.bankAccountId,
         name: t.name ?? null,
         type: t.type,
         amount: t.amount,
         date: t.date,
         description: t.description ?? null,
         paymentMethod: t.paymentMethod ?? null,
      }));

      await context.db.insert(transactions).values(rows);

      await incrementUsage(
         context.organizationId,
         "finance.statement_imported",
         context.redis,
      );

      emitFinanceStatementImported(
         emitEvent,
         {
            organizationId: context.organizationId,
            userId: context.userId,
            teamId: context.teamId,
         },
         {
            bankAccountId: input.bankAccountId,
            format: input.format,
            rowCount: rows.length,
         },
      );

      return { imported: rows.length };
   });
```

**Step 3: Add missing imports**

Near the top of the file, add:
```typescript
import { WebAppError } from "@core/logging/errors";
import { getBankAccount } from "@core/database/repositories/bank-accounts-repository";
```

> Check if these are already imported. If `WebAppError` is already imported, skip.

**Step 4: Check what `context` provides**

Check `apps/web/src/integrations/orpc/server.ts` for what `context.redis`, `context.stripeCustomerId`, and `context.organizationId` look like — adjust if named differently.

Run:
```bash
grep -n "redis\|stripeCustomerId\|organizationId" apps/web/src/integrations/orpc/server.ts | head -20
```

**Step 5: Typecheck**

```bash
bun run typecheck 2>&1 | grep "transactions.ts"
```
Expected: no errors

**Step 6: Commit**

```bash
git add apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(transactions): add importStatement procedure with billing"
```

---

## Task 5: Create StatementImportDialogStack UI

**Files:**
- Create: `apps/web/src/features/transactions/ui/statement-import-dialog-stack.tsx`

**Context:** This follows the same pattern as `ServiceImportDialogStack` (4-step wizard: upload → map → preview → confirm) but supports CSV, XLSX, and OFX. OFX format auto-maps (no column mapping needed). Uses `@f-o-t/csv` (already in deps), `@f-o-t/ofx` (already in deps), `xlsx` (just added).

**Step 1: Create the file with full content**

```typescript
import { parseOrThrow } from "@f-o-t/csv";
import { getTransactions, parseOrThrow as parseOfx } from "@f-o-t/ofx";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { defineStepper } from "@packages/ui/components/stepper";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronRight, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

dayjs.extend(customParseFormat);

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type StepperMethods = ReturnType<typeof useStepper>;
type FileFormat = "csv" | "xlsx" | "ofx";

type ParsedRow = {
   date: string;
   name: string;
   type: "income" | "expense";
   amount: string;
   description: string;
};

type ValidatedRow = ParsedRow & { isValid: boolean; errors: string[] };

type RawCsvData = { headers: string[]; rows: string[][] };
type ColumnField = "date" | "name" | "type" | "amount" | "description";
type ColumnMapping = Record<ColumnField, string>;

const FIELD_LABELS: Record<ColumnField, string> = {
   date: "Data *",
   name: "Nome / Descrição",
   type: "Tipo (entrada/saída) *",
   amount: "Valor *",
   description: "Observação",
};

const COLUMN_FIELDS: ColumnField[] = ["date", "name", "type", "amount", "description"];

const EMPTY_MAPPING: ColumnMapping = { date: "", name: "", type: "", amount: "", description: "" };

function guessMapping(headers: string[]): Partial<ColumnMapping> {
   const lower = headers.map((h) => h.toLowerCase().trim());
   const patterns: Record<ColumnField, string[]> = {
      date: ["data", "date", "dt", "vencimento"],
      name: ["nome", "name", "descricao", "descrição", "historico", "histórico", "memo"],
      type: ["tipo", "type", "natureza", "entrada/saida"],
      amount: ["valor", "amount", "value", "vlr", "montante"],
      description: ["obs", "observacao", "observação", "detalhe", "detail", "complemento"],
   };
   const result: Partial<ColumnMapping> = {};
   for (const [field, candidates] of Object.entries(patterns)) {
      const idx = lower.findIndex((h) => candidates.some((c) => h.includes(c)));
      if (idx !== -1) result[field as ColumnField] = headers[idx];
   }
   return result;
}

function parseAmount(raw: string): string | null {
   const cleaned = raw.replace(/R\$\s*/g, "").replace(/\./g, "").replace(",", ".").trim();
   const n = Number.parseFloat(cleaned);
   if (Number.isNaN(n)) return null;
   return String(Math.abs(n));
}

function inferType(raw: string, amountRaw: string): "income" | "expense" {
   const lower = raw.toLowerCase();
   if (lower.includes("entrada") || lower.includes("credito") || lower.includes("crédito") || lower.includes("income")) return "income";
   if (lower.includes("saida") || lower.includes("saída") || lower.includes("debito") || lower.includes("débito") || lower.includes("expense")) return "expense";
   const n = Number.parseFloat(amountRaw.replace(",", "."));
   return n >= 0 ? "income" : "expense";
}

function parseDate(raw: string): string | null {
   const formats = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "YYYYMMDD"];
   for (const fmt of formats) {
      const d = dayjs(raw.trim(), fmt, true);
      if (d.isValid()) return d.format("YYYY-MM-DD");
   }
   return null;
}

function applyMapping(row: string[], headers: string[], mapping: ColumnMapping): ParsedRow {
   const get = (f: ColumnField) => {
      const h = mapping[f];
      if (!h) return "";
      const i = headers.indexOf(h);
      return i !== -1 ? (row[i] ?? "") : "";
   };
   const rawAmount = get("amount");
   const rawType = get("type");
   return {
      date: get("date"),
      name: get("name"),
      type: inferType(rawType, rawAmount),
      amount: parseAmount(rawAmount) ?? rawAmount,
      description: get("description"),
   };
}

function validateRow(row: ParsedRow): ValidatedRow {
   const errors: string[] = [];
   if (!parseDate(row.date)) errors.push("Data inválida");
   if (!row.amount || parseAmount(row.amount) === null) errors.push("Valor inválido");
   return { ...row, isValid: errors.length === 0, errors };
}

function parseCsvToRaw(content: string): RawCsvData {
   const parsed = parseOrThrow(content);
   if (!parsed.headers || parsed.headers.length === 0) throw new Error("CSV vazio ou inválido");
   return { headers: parsed.headers, rows: parsed.rows as string[][] };
}

function parseXlsxToRaw(buffer: ArrayBuffer): RawCsvData {
   const wb = xlsxRead(buffer, { type: "array" });
   const ws = wb.Sheets[wb.SheetNames[0]];
   if (!ws) throw new Error("Planilha vazia");
   const data = xlsxUtils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
   if (data.length < 2) throw new Error("Planilha sem dados");
   const headers = data[0].map(String);
   const rows = data.slice(1).filter((r) => r.some((c) => String(c).trim() !== ""));
   return { headers, rows: rows.map((r) => r.map(String)) };
}

function parseOfxToRows(content: string): ParsedRow[] {
   const ofx = parseOfx(content);
   const txns = getTransactions(ofx);
   return txns.map((t) => ({
      date: dayjs(t.datePosted).format("YYYY-MM-DD"),
      name: t.name ?? t.memo ?? "",
      type: t.amount >= 0 ? "income" : "expense",
      amount: String(Math.abs(t.amount)),
      description: t.memo ?? "",
   }));
}

function StepBar({ methods }: { methods: StepperMethods }) {
   const steps = methods.state.all;
   const current = methods.lookup.getIndex(methods.state.current.data.id);
   return (
      <div className="flex items-center gap-2 mb-1">
         {steps.map((s, i) => (
            <div
               className={["h-1 rounded-full flex-1 transition-all", i === current ? "bg-primary" : i < current ? "bg-primary/50" : "bg-muted"].join(" ")}
               key={s.id}
            />
         ))}
      </div>
   );
}

interface UploadStepProps {
   methods: StepperMethods;
   onCsvReady: (raw: RawCsvData) => void;
   onOfxReady: (rows: ParsedRow[]) => void;
   onFormatDetected: (fmt: FileFormat) => void;
}

function UploadStep({ methods, onCsvReady, onOfxReady, onFormatDetected }: UploadStepProps) {
   const [isParsing, setIsParsing] = useState(false);
   const [selected, setSelected] = useState<File | undefined>();

   function process(file: File) {
      setSelected(file);
      setIsParsing(true);
      const name = file.name.toLowerCase();

      if (name.endsWith(".ofx") || name.endsWith(".qif")) {
         const reader = new FileReader();
         reader.onload = (e) => {
            try {
               const content = e.target?.result as string;
               const rows = parseOfxToRows(content);
               if (rows.length === 0) { toast.error("Nenhuma transação encontrada no OFX."); setSelected(undefined); return; }
               onFormatDetected("ofx");
               onOfxReady(rows);
               methods.navigation.goTo("preview");
            } catch { toast.error("Erro ao processar OFX. Verifique o arquivo."); setSelected(undefined); }
            finally { setIsParsing(false); }
         };
         reader.readAsText(file, "utf-8");
         return;
      }

      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
         const reader = new FileReader();
         reader.onload = (e) => {
            try {
               const buffer = e.target?.result as ArrayBuffer;
               const raw = parseXlsxToRaw(buffer);
               onFormatDetected("xlsx");
               onCsvReady(raw);
               methods.navigation.next();
            } catch { toast.error("Erro ao processar planilha XLSX."); setSelected(undefined); }
            finally { setIsParsing(false); }
         };
         reader.readAsArrayBuffer(file);
         return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
         try {
            const content = e.target?.result as string;
            const raw = parseCsvToRaw(content);
            onFormatDetected("csv");
            onCsvReady(raw);
            methods.navigation.next();
         } catch { toast.error("Erro ao processar CSV."); setSelected(undefined); }
         finally { setIsParsing(false); }
      };
      reader.readAsText(file, "utf-8");
   }

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Importar Extrato</DialogStackTitle>
            <DialogStackDescription>CSV, XLSX ou OFX do seu banco</DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />
               <Dropzone
                  accept={{ "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"], "application/vnd.ms-excel": [".xls"], "application/x-ofx": [".ofx"] }}
                  disabled={isParsing}
                  maxFiles={1}
                  onDrop={([file]) => { if (file) process(file); }}
                  src={selected ? [selected] : undefined}
               >
                  <DropzoneEmptyState>
                     {isParsing ? (
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                     ) : (
                        <>
                           <FileSpreadsheet className="size-8 text-muted-foreground" />
                           <p className="text-sm font-medium mt-2">Arraste ou clique para selecionar</p>
                           <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .csv, .xlsx, .ofx</p>
                        </>
                     )}
                  </DropzoneEmptyState>
                  <DropzoneContent />
               </Dropzone>
            </div>
         </div>
      </DialogStackContent>
   );
}

interface MapStepProps {
   methods: StepperMethods;
   raw: RawCsvData;
   mapping: ColumnMapping;
   onMappingChange: (m: ColumnMapping) => void;
   onApply: (rows: ParsedRow[]) => void;
}

function MapStep({ methods, raw, mapping, onMappingChange, onApply }: MapStepProps) {
   const canProceed = mapping.date !== "" && mapping.amount !== "";

   function handleNext() {
      const rows = raw.rows.map((r) => applyMapping(r, raw.headers, mapping));
      onApply(rows);
      methods.navigation.next();
   }

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Mapear Colunas</DialogStackTitle>
            <DialogStackDescription>Associe as colunas do arquivo aos campos</DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />
               {COLUMN_FIELDS.map((field) => (
                  <div className="flex items-center justify-between gap-2" key={field}>
                     <span className="text-sm font-medium min-w-[140px]">{FIELD_LABELS[field]}</span>
                     <Combobox
                        className="flex-1"
                        items={[{ value: "__none__", label: "— Não mapear —" }, ...raw.headers.map((h) => ({ value: h, label: h }))]}
                        onValueChange={(v) => onMappingChange({ ...mapping, [field]: v === "__none__" ? "" : v })}
                        value={mapping[field] || "__none__"}
                     />
                  </div>
               ))}
               <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">{raw.rows.length} linha(s) · Colunas: {raw.headers.join(", ")}</p>
               </div>
            </div>
         </div>
         <div className="border-t px-4 py-4">
            <div className="flex gap-2">
               <Button className="flex-none" onClick={() => methods.navigation.prev()} type="button" variant="outline">Voltar</Button>
               <Button className="flex-1" disabled={!canProceed} onClick={handleNext} type="button">Continuar <ChevronRight className="ml-1 size-4" /></Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

interface PreviewStepProps { methods: StepperMethods; rows: ParsedRow[] }

function PreviewStep({ methods, rows }: PreviewStepProps) {
   const validated = rows.map(validateRow);
   const validCount = validated.filter((r) => r.isValid).length;
   const invalidCount = validated.filter((r) => !r.isValid).length;

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Prévia do Extrato</DialogStackTitle>
            <DialogStackDescription>{rows.length} transação(ões) encontrada(s)</DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />
               <div className="flex items-center gap-2">
                  <Badge variant="default">{validCount} válida(s)</Badge>
                  {invalidCount > 0 && <Badge variant="destructive">{invalidCount} com erro(s)</Badge>}
               </div>
               <div className="max-h-[300px] overflow-auto rounded-lg border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead className="text-xs">Data</TableHead>
                           <TableHead className="text-xs">Nome</TableHead>
                           <TableHead className="text-xs">Tipo</TableHead>
                           <TableHead className="text-xs">Valor</TableHead>
                           <TableHead className="text-xs w-[60px]">OK</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {validated.slice(0, 15).map((row, i) => (
                           <TableRow className={row.isValid ? "" : "bg-destructive/5"} key={`prev-${i + 1}`}>
                              <TableCell className="text-xs">{row.date}</TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate">{row.name || "—"}</TableCell>
                              <TableCell className="text-xs">{row.type === "income" ? "Entrada" : "Saída"}</TableCell>
                              <TableCell className="text-xs">R$ {row.amount}</TableCell>
                              <TableCell className="text-xs">
                                 {row.isValid ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <AlertTriangle className="size-3.5 text-destructive" />}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>
               {rows.length > 15 && <p className="text-xs text-muted-foreground text-center">Mostrando 15 de {rows.length}</p>}
            </div>
         </div>
         <div className="border-t px-4 py-4">
            <div className="flex gap-2">
               <Button className="flex-none" onClick={() => methods.navigation.prev()} type="button" variant="outline">Voltar</Button>
               <Button className="flex-1" disabled={validCount === 0} onClick={() => methods.navigation.next()} type="button">Continuar <ChevronRight className="ml-1 size-4" /></Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

interface ConfirmStepProps {
   methods: StepperMethods;
   rows: ParsedRow[];
   format: FileFormat;
   onClose?: () => void;
}

function ConfirmStep({ methods, rows, format, onClose }: ConfirmStepProps) {
   const validated = rows.map(validateRow);
   const validRows = validated.filter((r) => r.isValid);
   const invalidCount = validated.filter((r) => !r.isValid).length;

   const { data: bankAccounts } = useSuspenseQuery(orpc.bankAccounts.getAll.queryOptions({}));
   const [bankAccountId, setBankAccountId] = useState<string>("");

   const importMutation = useMutation(orpc.transactions.importStatement.mutationOptions({}));

   async function handleImport() {
      if (!bankAccountId) { toast.error("Selecione uma conta bancária."); return; }

      const parsedDate = (d: string) => parseDate(d) ?? d;

      await importMutation.mutateAsync({
         bankAccountId,
         format,
         transactions: validRows.map((r) => ({
            name: r.name || undefined,
            type: r.type,
            amount: r.amount,
            date: parsedDate(r.date),
            description: r.description || undefined,
         })),
      });

      toast.success(`${validRows.length} transação(ões) importada(s) com sucesso.`);
      onClose?.();
   }

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Confirmar Importação</DialogStackTitle>
            <DialogStackDescription>Selecione a conta e confirme</DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Conta bancária *</label>
                  <Combobox
                     items={(bankAccounts ?? []).map((a: { id: string; name: string }) => ({ value: a.id, label: a.name }))}
                     onValueChange={setBankAccountId}
                     placeholder="Selecionar conta..."
                     value={bankAccountId}
                  />
               </div>

               <div className="rounded-xl border overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2.5 border-b">
                     <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
                  </div>
                  <div className="divide-y">
                     <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">Total no arquivo</span>
                        <span className="text-sm font-medium">{rows.length}</span>
                     </div>
                     {invalidCount > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                           <span className="text-sm text-muted-foreground">Com erro</span>
                           <Badge variant="destructive">{invalidCount}</Badge>
                        </div>
                     )}
                     <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                        <span className="text-sm font-medium">Serão importadas</span>
                        <span className="text-sm font-bold text-primary">{validRows.length}</span>
                     </div>
                  </div>
               </div>
            </div>
         </div>
         <div className="border-t px-4 py-4">
            <div className="flex gap-2">
               <Button className="flex-none" disabled={importMutation.isPending} onClick={() => methods.navigation.prev()} type="button" variant="outline">Voltar</Button>
               <Button className="flex-1" disabled={importMutation.isPending || validRows.length === 0 || !bankAccountId} onClick={handleImport} type="button">
                  {importMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Importar {validRows.length} transação(ões)
               </Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

export function StatementImportDialogStack({ onClose }: { onClose?: () => void }) {
   return (
      <Stepper.Provider variant="line">
         {({ methods }) => <ImportWizard methods={methods} onClose={onClose} />}
      </Stepper.Provider>
   );
}

function ImportWizard({ methods, onClose }: { methods: StepperMethods; onClose?: () => void }) {
   const currentId = methods.state.current.data.id;
   const [rawCsv, setRawCsv] = useState<RawCsvData | null>(null);
   const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
   const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_MAPPING);
   const [format, setFormat] = useState<FileFormat>("csv");

   function handleCsvReady(raw: RawCsvData) {
      setRawCsv(raw);
      setMapping((prev) => ({ ...prev, ...guessMapping(raw.headers) }));
   }

   function handleOfxReady(rows: ParsedRow[]) {
      setParsedRows(rows);
   }

   function handleMappingApply(rows: ParsedRow[]) {
      setParsedRows(rows);
   }

   return (
      <>
         {currentId === "upload" && (
            <UploadStep
               methods={methods}
               onCsvReady={handleCsvReady}
               onFormatDetected={setFormat}
               onOfxReady={handleOfxReady}
            />
         )}
         {currentId === "map" && rawCsv && (
            <MapStep
               mapping={mapping}
               methods={methods}
               onApply={handleMappingApply}
               onMappingChange={setMapping}
               raw={rawCsv}
            />
         )}
         {currentId === "preview" && (
            <PreviewStep methods={methods} rows={parsedRows} />
         )}
         {currentId === "confirm" && (
            <Suspense>
               <ConfirmStep format={format} methods={methods} rows={parsedRows} onClose={onClose} />
            </Suspense>
         )}
      </>
   );
}
```

**Step 2: Check `Combobox` component props**

```bash
grep -n "interface\|type Combobox\|items\|onValueChange" packages/ui/src/components/combobox.tsx | head -20
```

Adjust `Combobox` usage to match actual prop names.

**Step 3: Check `@f-o-t/csv` and `@f-o-t/ofx` export names**

```bash
# Check csv exports
cat node_modules/@f-o-t/csv/dist/index.d.ts 2>/dev/null | head -20

# Check ofx exports
cat node_modules/@f-o-t/ofx/dist/index.d.ts 2>/dev/null | head -20
```

Adjust imports if `parseOrThrow` or `getTransactions` are named differently.

**Step 4: Typecheck**

```bash
bun run typecheck 2>&1 | grep "statement-import"
```

**Step 5: Commit**

```bash
git add apps/web/src/features/transactions/ui/statement-import-dialog-stack.tsx
git commit -m "feat(transactions): add StatementImportDialogStack (CSV/XLSX/OFX)"
```

---

## Task 6: Wire the import button in the transactions page

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/transactions.tsx`

**Context:** The page already has an `Upload` icon button and imports `TransactionImportDialogStack`. The new statement import replaces or supplements this button.

**Step 1: Read the current Upload button code**

```bash
grep -n "Upload\|import\|Import" apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/transactions.tsx
```

**Step 2: Add import for StatementImportDialogStack**

Add to imports:
```typescript
import { StatementImportDialogStack } from "@/features/transactions/ui/statement-import-dialog-stack";
```

**Step 3: Add a handler for statement import**

Inside `TransactionsPage`, add:
```typescript
const handleStatementImport = useCallback(() => {
   openDialogStack({
      children: (
         <StatementImportDialogStack onClose={closeDialogStack} />
      ),
   });
}, [openDialogStack, closeDialogStack]);
```

**Step 4: Add a button to the DefaultHeader actions**

Find where the existing Upload button renders. Add a new action or replace with:
```typescript
{
   label: "Importar extrato",
   icon: <Upload />,
   onClick: handleStatementImport,
}
```

> The exact pattern depends on how `DefaultHeader` actions are passed. Read the current implementation first.

**Step 5: Typecheck + smoke test**

```bash
bun run typecheck
```

Expected: no errors

**Step 6: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/transactions.tsx
git commit -m "feat(transactions): wire statement import button to transactions page"
```

---

## Verification Checklist

- [ ] `finance.statement_imported` appears in `FINANCE_EVENTS`, `FREE_TIER_LIMITS` (10), `EVENT_PRICES` (0.02), `STRIPE_METER_EVENTS`
- [ ] `importStatement` procedure validates bankAccountId ownership, enforces credit budget, bulk inserts, emits 1 event
- [ ] Upload step accepts .csv / .xlsx / .ofx
- [ ] OFX format skips column mapping step (goes directly to preview)
- [ ] Confirm step shows bank account selector
- [ ] `bun run typecheck` passes with 0 errors
