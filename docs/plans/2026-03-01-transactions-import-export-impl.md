# Transactions Import / Export + Categories Expandable Table — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add client-side CSV/OFX export, client-side-parsed CSV/OFX import with duplicate detection, and expandable subcategory rows in the categories table.

**Architecture:** Export generates files entirely in the browser using `@f-o-t/csv` / `@f-o-t/ofx` and triggers a download via `URL.createObjectURL`. Import parses files in the browser, runs duplicate detection with `@f-o-t/condition-evaluator`, and sends only JSON to the server. Categories table uses DataTable's `renderSubComponent` with all rows expanded by default.

**Tech Stack:** `@f-o-t/csv` · `@f-o-t/ofx` · `@f-o-t/condition-evaluator` · oRPC · TanStack Query · TanStack Table `renderSubComponent`

---

## Task 1: Install @f-o-t/csv and @f-o-t/ofx

**Files:**

- Modify: `package.json` (root) — fot catalog at line ~281
- Modify: `apps/web/package.json` — dependencies section

### Step 1: Add to fot catalog in root `package.json`

Find the `"fot"` catalog block and add two entries:

```json
"fot": {
  "@f-o-t/condition-evaluator": "2.0.7",
  "@f-o-t/content-analysis": "1.0.7",
  "@f-o-t/csv": "1.2.6",
  "@f-o-t/markdown": "1.0.7",
  "@f-o-t/money": "1.2.6",
  "@f-o-t/ofx": "2.4.6",
  "@f-o-t/qrcode": "1.0.1",
  "@f-o-t/spelling": "1.0.6"
}
```

### Step 2: Add to `apps/web/package.json` dependencies

Add alongside the other `@f-o-t/*` deps:

```json
"@f-o-t/csv": "catalog:fot",
"@f-o-t/ofx": "catalog:fot"
```

### Step 3: Install

```bash
bun install
```

Expected: resolves `@f-o-t/csv@1.2.6` and `@f-o-t/ofx@2.4.6` without errors.

### Step 4: Commit

```bash
git add package.json apps/web/package.json bun.lock
git commit -m "feat(deps): add @f-o-t/csv and @f-o-t/ofx"
```

---

## Task 2: Add `importBulk` oRPC procedure

**Files:**

- Modify: `apps/web/src/integrations/orpc/router/transactions.ts`
- Modify: `apps/web/src/integrations/orpc/router/index.ts`

### Step 1: Add `importBulk` export to `transactions.ts`

Append after the `remove` export at line ~202:

```typescript
export const importBulk = protectedProcedure
   .input(
      z.object({
         transactions: z
            .array(
               transactionSchema.extend({
                  name: z.string().max(200).nullable().optional(),
               }),
            )
            .min(1)
            .max(500),
      }),
   )
   .handler(async ({ context, input }) => {
      const { db, teamId } = context;
      let imported = 0;
      for (const t of input.transactions) {
         await verifyTransactionRefs(db, teamId, t);
         const { tagIds, ...data } = t;
         await createTransaction(db, { ...data, teamId }, tagIds);
         imported++;
      }
      return { imported, skipped: 0 };
   });
```

### Step 2: Register in `apps/web/src/integrations/orpc/router/index.ts`

The transactions router is already registered as `transactions: transactionsRouter`. The new `importBulk` export is automatically included since it imports the whole namespace — no change needed to `index.ts`.

Verify by checking the import line in `index.ts`:

```typescript
import * as transactionsRouter from "./transactions";
// → orpc.transactions.importBulk is now available
```

### Step 3: Typecheck

```bash
bun run typecheck
```

Expected: no errors on `transactions.ts`.

### Step 4: Commit

```bash
git add apps/web/src/integrations/orpc/router/transactions.ts
git commit -m "feat(transactions): add importBulk oRPC procedure"
```

---

## Task 3: Categories — expandable subcategory rows

**Files:**

- Modify: `apps/web/src/features/categories/ui/categories-columns.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/categories.tsx`

### Step 1: Update `categories-columns.tsx`

Replace the current file with the version below. Key changes:

- Remove the `"subcategories"` inline column
- Add an expand/collapse chevron as the first column using `row.getToggleExpandedHandler()`

```typescript
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Baby,
   BookOpen,
   Briefcase,
   Car,
   ChevronDown,
   ChevronRight,
   Coffee,
   CreditCard,
   Dumbbell,
   Fuel,
   Gift,
   Heart,
   Home,
   type LucideIcon,
   Music,
   Package,
   Pencil,
   Plane,
   ShoppingCart,
   Smartphone,
   Trash2,
   Utensils,
   Wallet,
   Zap,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
   wallet: Wallet,
   "credit-card": CreditCard,
   home: Home,
   car: Car,
   "shopping-cart": ShoppingCart,
   utensils: Utensils,
   plane: Plane,
   heart: Heart,
   "book-open": BookOpen,
   briefcase: Briefcase,
   package: Package,
   music: Music,
   coffee: Coffee,
   smartphone: Smartphone,
   dumbbell: Dumbbell,
   baby: Baby,
   gift: Gift,
   zap: Zap,
   fuel: Fuel,
};

export type CategoryRow = {
   id: string;
   name: string;
   isDefault: boolean;
   color: string | null;
   icon: string | null;
   type: string | null;
   subcategories: { id: string; name: string }[];
};

export function buildCategoryColumns(
   onEdit: (category: CategoryRow) => void,
   onDelete: (category: CategoryRow) => void,
): ColumnDef<CategoryRow>[] {
   return [
      {
         id: "expand",
         header: "",
         size: 40,
         cell: ({ row }) => {
            if (row.original.subcategories.length === 0) return null;
            return (
               <Button
                  className="size-6"
                  onClick={row.getToggleExpandedHandler()}
                  size="icon"
                  variant="ghost"
               >
                  {row.getIsExpanded() ? (
                     <ChevronDown className="size-3.5" />
                  ) : (
                     <ChevronRight className="size-3.5" />
                  )}
               </Button>
            );
         },
      },
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const { name, color, icon, isDefault } = row.original;
            const IconComponent = icon ? ICON_MAP[icon] : null;
            return (
               <div className="flex items-center gap-2 min-w-0">
                  {color || IconComponent ? (
                     <span
                        className="size-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color ?? "#6366f1" }}
                     >
                        {IconComponent && (
                           <IconComponent className="size-3.5 text-white" />
                        )}
                     </span>
                  ) : null}
                  <span className="font-medium truncate">{name}</span>
                  {isDefault && <Badge variant="outline">Padrão</Badge>}
               </div>
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => {
            const { type } = row.original;
            if (type === "income")
               return (
                  <Badge
                     className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
                     variant="outline"
                  >
                     Receita
                  </Badge>
               );
            if (type === "expense")
               return <Badge variant="destructive">Despesa</Badge>;
            return <span className="text-sm text-muted-foreground">—</span>;
         },
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => {
            if (row.original.isDefault) return null;
            return (
               // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for table row click
               <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
               >
                  <Button
                     onClick={() => onEdit(row.original)}
                     size="icon"
                     variant="ghost"
                  >
                     <Pencil className="size-4" />
                     <span className="sr-only">Editar</span>
                  </Button>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() => onDelete(row.original)}
                     size="icon"
                     variant="ghost"
                  >
                     <Trash2 className="size-4" />
                     <span className="sr-only">Excluir</span>
                  </Button>
               </div>
            );
         },
      },
   ];
}
```

### Step 2: Update `categories.tsx` — add `renderSubComponent` and expanded state

In `CategoriesList`, add `expanded` state and `renderSubComponent` to the `DataTable`:

```typescript
// Add to imports
import { useMemo, useCallback } from "react";

// Inside CategoriesList, before the `columns` line:
const expanded = useMemo(
   () => Object.fromEntries(categories.map((c) => [c.id, true])),
   [categories],
);

// Update the DataTable call — add renderSubComponent and expanded props:
<DataTable
   columns={columns}
   data={categories}
   enableRowSelection
   expanded={expanded}
   getRowId={(row) => row.id}
   onRowSelectionChange={onRowSelectionChange}
   renderSubComponent={({ row }) => {
      const subs = row.original.subcategories;
      if (subs.length === 0) return null;
      return (
         <div className="flex flex-col gap-1 pl-10 py-1">
            {subs.map((sub) => (
               <span className="text-sm text-muted-foreground" key={sub.id}>
                  {sub.name}
               </span>
            ))}
         </div>
      );
   }}
   renderMobileCard={/* existing renderMobileCard unchanged */}
   rowSelection={rowSelection}
/>
```

**Note:** `expanded` here is the initial state. `DataTable` uses `getExpandedRowModel()` internally. Check if `DataTable` accepts a controlled `expanded` prop — if it uses uncontrolled expansion internally, pass `initialState={{ expanded }}` instead. Read `@packages/ui/components/data-table` to confirm the prop name before writing.

### Step 3: Typecheck

```bash
bun run typecheck
```

### Step 4: Commit

```bash
git add apps/web/src/features/categories/ui/categories-columns.tsx \
        apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/categories.tsx
git commit -m "feat(categories): expandable subcategory rows in table"
```

---

## Task 4: TransactionExportCredenza

**Files:**

- Create: `apps/web/src/features/transactions/ui/transaction-export-credenza.tsx`

### Step 1: Create the file

The export modal:

1. Format selector: CSV | OFX (radio via `ToggleGroup`)
2. When OFX is selected: account selector is required (needed for OFX metadata)
3. Date range picker pre-filled with props `dateFrom` / `dateTo`
4. On download: fetch all transactions for the period, generate file, trigger browser download

```typescript
import { generateFromObjects } from "@f-o-t/csv";
import {
   generateBankStatement,
   generateCreditCardStatement,
} from "@f-o-t/ofx";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DateRangePicker } from "@packages/ui/components/date-range-picker";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

// Map from our bank account type to OFX account type
const BANK_ACCOUNT_TYPE_MAP: Record<string, "CHECKING" | "SAVINGS" | "MONEYMRKT" | "CREDITLINE"> = {
   checking: "CHECKING",
   savings: "SAVINGS",
   investment: "MONEYMRKT",
   cash: "CHECKING",
   other: "CHECKING",
};

interface TransactionExportCredenzaProps {
   dateFrom?: string; // YYYY-MM-DD
   dateTo?: string;   // YYYY-MM-DD
}

export function TransactionExportCredenza({
   dateFrom,
   dateTo,
}: TransactionExportCredenzaProps) {
   const today = new Date();
   const defaultFrom = dateFrom ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
   const defaultTo = dateTo ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

   const [format, setFormat] = useState<"csv" | "ofx">("csv");
   const [period, setPeriod] = useState<{ from: string; to: string }>({
      from: defaultFrom,
      to: defaultTo,
   });
   const [accountId, setAccountId] = useState<string>("");
   const [isPending, startTransition] = useTransition();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const accountOptions = bankAccounts.map((a) => ({
      value: a.id,
      label: a.name,
   }));

   const handleDownload = useCallback(() => {
      startTransition(async () => {
         try {
            // Fetch all transactions for the period (no pagination)
            const result = await orpc.transactions.getAll.call({
               dateFrom: period.from,
               dateTo: period.to,
               pageSize: 100,
               page: 1,
            });

            // NOTE: getAll is paginated (max 100). For export we need all pages.
            // Simple approach: fetch page by page until exhausted.
            // This is acceptable for typical export sizes (<1000 rows).
            let allTransactions = result.data;
            let page = 2;
            while (allTransactions.length < result.total) {
               const next = await orpc.transactions.getAll.call({
                  dateFrom: period.from,
                  dateTo: period.to,
                  pageSize: 100,
                  page,
               });
               allTransactions = [...allTransactions, ...next.data];
               page++;
            }

            const filename = `transacoes-${period.from}-${period.to}`;

            if (format === "csv") {
               const rows = allTransactions.map((t) => ({
                  data: t.date,
                  nome: t.name ?? "",
                  tipo: t.type === "income" ? "receita" : t.type === "expense" ? "despesa" : "transferencia",
                  valor: t.amount,
                  descricao: t.description ?? "",
                  conta: bankAccounts.find((a) => a.id === t.bankAccountId)?.name ?? t.bankAccountId,
                  conta_destino: t.destinationBankAccountId
                     ? (bankAccounts.find((a) => a.id === t.destinationBankAccountId)?.name ?? t.destinationBankAccountId)
                     : "",
                  categoria: "",
                  subcategoria: "",
                  tags: "",
               }));
               const csv = generateFromObjects(rows);
               triggerDownload(csv, `${filename}.csv`, "text/csv");
            } else {
               if (!accountId) {
                  toast.error("Selecione uma conta para exportar em OFX.");
                  return;
               }
               const account = bankAccounts.find((a) => a.id === accountId);
               if (!account) return;

               const filtered = allTransactions.filter(
                  (t) => t.bankAccountId === accountId,
               );
               const ofxTransactions = filtered.map((t) => ({
                  type: (t.type === "income" ? "CREDIT" : "DEBIT") as "CREDIT" | "DEBIT",
                  datePosted: new Date(t.date),
                  amount: t.type === "income" ? Number(t.amount) : -Number(t.amount),
                  fitId: t.id,
                  name: t.name ?? undefined,
                  memo: t.description ?? undefined,
               }));

               let ofx: string;
               if (account.type === "credit_card") {
                  ofx = generateCreditCardStatement({
                     accountId: account.id,
                     currency: "BRL",
                     startDate: new Date(period.from),
                     endDate: new Date(period.to),
                     transactions: ofxTransactions,
                  });
               } else {
                  ofx = generateBankStatement({
                     bankId: "MONTTE",
                     accountId: account.id,
                     accountType: BANK_ACCOUNT_TYPE_MAP[account.type] ?? "CHECKING",
                     currency: "BRL",
                     startDate: new Date(period.from),
                     endDate: new Date(period.to),
                     transactions: ofxTransactions,
                  });
               }
               triggerDownload(ofx, `${filename}.ofx`, "application/x-ofx");
            }

            toast.success("Arquivo exportado com sucesso.");
         } catch {
            toast.error("Erro ao exportar transações.");
         }
      });
   }, [format, period, accountId, bankAccounts]);

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Exportar Transações</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="space-y-4">
            <div className="space-y-1.5">
               <label className="text-sm font-medium">Formato</label>
               <ToggleGroup
                  className="justify-start"
                  onValueChange={(v) => v && setFormat(v as "csv" | "ofx")}
                  type="single"
                  value={format}
               >
                  <ToggleGroupItem value="csv">CSV</ToggleGroupItem>
                  <ToggleGroupItem value="ofx">OFX</ToggleGroupItem>
               </ToggleGroup>
            </div>

            <div className="space-y-1.5">
               <label className="text-sm font-medium">Período</label>
               <DateRangePicker
                  onChange={(range) => {
                     if (range?.from && range?.to) {
                        setPeriod({
                           from: range.from.toISOString().split("T")[0],
                           to: range.to.toISOString().split("T")[0],
                        });
                     }
                  }}
                  value={{
                     from: new Date(period.from),
                     to: new Date(period.to),
                  }}
               />
            </div>

            {format === "ofx" && (
               <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                     Conta <span className="text-destructive">*</span>
                  </label>
                  <Combobox
                     onChange={setAccountId}
                     options={accountOptions}
                     placeholder="Selecione uma conta"
                     value={accountId}
                  />
               </div>
            )}
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               disabled={isPending || (format === "ofx" && !accountId)}
               onClick={handleDownload}
            >
               {isPending ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
               ) : (
                  <Download className="size-4 mr-2" />
               )}
               Baixar
            </Button>
         </CredenzaFooter>
      </>
   );
}

function triggerDownload(content: string, filename: string, mimeType: string) {
   const blob = new Blob([content], { type: mimeType });
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}
```

**Important:** `orpc.transactions.getAll.call(input)` is the direct call pattern — check the actual orpc client pattern in the codebase. The pattern may be `orpc.transactions.getAll.queryOptions({ input: {...} })` used with `queryClient.fetchQuery(...)`. Use whichever is correct for non-hook context. Look at how other credenzas do data fetching inside callbacks.

### Step 2: Typecheck

```bash
bun run typecheck
```

### Step 3: Commit

```bash
git add apps/web/src/features/transactions/ui/transaction-export-credenza.tsx
git commit -m "feat(transactions): add TransactionExportCredenza"
```

---

## Task 5: TransactionImportCredenza

**Files:**

- Create: `apps/web/src/features/transactions/ui/transaction-import-credenza.tsx`

This is a 2-step modal. Use local `step` state: `"upload"` | `"preview"`.

### Step 1: Create the file

```typescript
import { parseOrThrow } from "@f-o-t/csv";
import { getTransactions, parse as parseOfx } from "@f-o-t/ofx";
import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
import { generateFromObjects } from "@f-o-t/csv";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Loader2, Upload } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

// CSV column headers for the template and for parsing
const CSV_HEADERS = [
   "data",
   "nome",
   "tipo",
   "valor",
   "descricao",
   "conta",
   "conta_destino",
   "categoria",
   "subcategoria",
   "tags",
] as const;

type ParsedRow = {
   data: string;        // DD/MM/YYYY or YYYY-MM-DD
   nome: string;
   tipo: string;        // receita / despesa / transferencia
   valor: string;       // "150.00"
   descricao: string;
   conta: string;       // account name or ID
   conta_destino: string;
   categoria: string;
   subcategoria: string;
   tags: string;        // comma-separated
};

type ImportRow = ParsedRow & {
   isDuplicate: boolean;
   selected: boolean;
};

// Map CSV tipo → transaction type
function parseTipo(tipo: string): "income" | "expense" | "transfer" {
   const t = tipo.toLowerCase().trim();
   if (t === "receita" || t === "income") return "income";
   if (t === "transferencia" || t === "transfer") return "transfer";
   return "expense";
}

// Parse DD/MM/YYYY or YYYY-MM-DD → YYYY-MM-DD
function normalizeDate(d: string): string {
   if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
      const [day, month, year] = d.split("/");
      return `${year}-${month}-${day}`;
   }
   return d;
}

interface Defaults {
   bankAccountId: string;
   categoryId: string;
   subcategoryId: string;
   tagIds: string[];
   description: string;
}

export function TransactionImportCredenza() {
   const [step, setStep] = useState<"upload" | "preview">("upload");
   const [rows, setRows] = useState<ImportRow[]>([]);
   const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);
   const [isVerifying, startVerifying] = useTransition();
   const [isPending, startTransition] = useTransition();
   const fileInputRef = useRef<HTMLInputElement>(null);

   const [defaults, setDefaults] = useState<Defaults>({
      bankAccountId: "",
      categoryId: "",
      subcategoryId: "",
      tagIds: [],
      description: "",
   });

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const importMutation = useMutation(
      orpc.transactions.importBulk.mutationOptions({
         onSuccess: ({ imported }) => {
            toast.success(`${imported} transações importadas com sucesso.`);
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao importar transações.");
         },
      }),
   );

   const bankAccountOptions = bankAccounts.map((a) => ({
      value: a.id,
      label: a.name,
   }));

   const categoryOptions = categories.map((c) => ({
      value: c.id,
      label: c.name,
   }));

   const selectedCategory = categories.find(
      (c) => c.id === defaults.categoryId,
   );
   const subcategoryOptions =
      selectedCategory?.subcategories.map((s) => ({
         value: s.id,
         label: s.name,
      })) ?? [];

   // --- Parse file ---
   const handleFileChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
         const file = e.target.files?.[0];
         if (!file) return;

         const text = await file.text();
         let parsed: ParsedRow[] = [];

         if (file.name.endsWith(".ofx")) {
            const result = parseOfx(text);
            if (!result.success) {
               toast.error("Arquivo OFX inválido.");
               return;
            }
            const txs = getTransactions(result.data);
            parsed = txs.map((t) => ({
               data: t.DTPOSTED.isoString.split("T")[0],
               nome: t.NAME ?? t.MEMO ?? "",
               tipo: t.TRNAMT >= 0 ? "receita" : "despesa",
               valor: Math.abs(t.TRNAMT).toFixed(2),
               descricao: t.MEMO ?? "",
               conta: "",
               conta_destino: "",
               categoria: "",
               subcategoria: "",
               tags: "",
            }));
         } else {
            // CSV: skip header row
            const matrix = parseOrThrow(text).rows;
            // matrix[0] is headers, matrix[1..] are data rows
            const dataRows = matrix.slice(1);
            parsed = dataRows
               .filter((row) => row.fields.some((f) => f.trim()))
               .map((row) => {
                  const f = row.fields;
                  return {
                     data: f[0] ?? "",
                     nome: f[1] ?? "",
                     tipo: f[2] ?? "despesa",
                     valor: f[3] ?? "0",
                     descricao: f[4] ?? "",
                     conta: f[5] ?? "",
                     conta_destino: f[6] ?? "",
                     categoria: f[7] ?? "",
                     subcategoria: f[8] ?? "",
                     tags: f[9] ?? "",
                  };
               });
         }

         setRows(
            parsed.map((r) => ({ ...r, isDuplicate: false, selected: true })),
         );
         setStep("preview");
      },
      [],
   );

   // --- Verify duplicates ---
   const handleVerify = useCallback(() => {
      startVerifying(async () => {
         // Get date range from imported rows
         const dates = rows.map((r) => normalizeDate(r.data)).sort();
         if (dates.length === 0) return;

         const existing = await Promise.resolve(
            // We use queryClient.fetchQuery in real usage — here we fetch directly
            // by calling the oRPC client. In the actual implementation, use:
            // queryClient.fetchQuery(orpc.transactions.getAll.queryOptions({
            //   input: { dateFrom: dates[0], dateTo: dates[dates.length - 1], pageSize: 500 }
            // }))
            // For now, approximate:
            { data: [] as typeof bankAccounts, total: 0 }
         );

         const updated = rows.map((row) => {
            const rowAmount = Number(row.valor);
            const rowDate = normalizeDate(row.data);
            const rowAccountId =
               bankAccounts.find(
                  (a) =>
                     a.name.toLowerCase() === row.conta.toLowerCase() ||
                     a.id === row.conta,
               )?.id ?? defaults.bankAccountId;

            let isDuplicate = false;
            for (const ex of existing.data as Array<{ amount: string; date: string; bankAccountId: string }>) {
               const result = evaluateConditionGroup(
                  {
                     id: "dup-check",
                     operator: "OR",
                     scoringMode: "weighted",
                     threshold: 0.8,
                     conditions: [
                        {
                           id: "amount",
                           type: "number",
                           field: "amount",
                           operator: "eq",
                           value: rowAmount,
                           options: { weight: 0.45 },
                        },
                        {
                           id: "date",
                           type: "string",
                           field: "date",
                           operator: "eq",
                           value: rowDate,
                           options: { weight: 0.35 },
                        },
                        {
                           id: "account",
                           type: "string",
                           field: "bankAccountId",
                           operator: "eq",
                           value: rowAccountId,
                           options: { weight: 0.20 },
                        },
                     ],
                  },
                  {
                     data: {
                        amount: Number(ex.amount),
                        date: ex.date,
                        bankAccountId: ex.bankAccountId,
                     },
                  },
               );
               if (result.passed) {
                  isDuplicate = true;
                  break;
               }
            }
            return { ...row, isDuplicate };
         });

         setRows(updated);
         const count = updated.filter((r) => r.isDuplicate).length;
         if (count > 0) {
            toast.warning(`${count} provável${count > 1 ? "is" : ""} duplicata${count > 1 ? "s" : ""} encontrada${count > 1 ? "s" : ""}.`);
         } else {
            toast.success("Nenhuma duplicata encontrada.");
         }
      });
   }, [rows, bankAccounts, defaults.bankAccountId]);

   // --- Template download ---
   const handleDownloadTemplate = useCallback(() => {
      const template = generateFromObjects(
         [
            {
               data: "01/03/2026",
               nome: "Exemplo",
               tipo: "despesa",
               valor: "150.00",
               descricao: "Descrição opcional",
               conta: "Conta Corrente",
               conta_destino: "",
               categoria: "Alimentação",
               subcategoria: "Mercado",
               tags: "tag1,tag2",
            },
         ],
         { headers: [...CSV_HEADERS] },
      );
      const blob = new Blob([template], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo-transacoes.csv";
      a.click();
      URL.revokeObjectURL(url);
   }, []);

   // --- Import ---
   const handleImport = useCallback(() => {
      startTransition(async () => {
         const toImport = rows.filter(
            (r) => r.selected && !(ignoreDuplicates && r.isDuplicate),
         );

         const transactions = toImport.map((r) => {
            const bankAccountId =
               bankAccounts.find(
                  (a) =>
                     a.name.toLowerCase() === r.conta.toLowerCase() ||
                     a.id === r.conta,
               )?.id ?? defaults.bankAccountId;

            const categoryId =
               categories.find(
                  (c) => c.name.toLowerCase() === r.categoria.toLowerCase(),
               )?.id ?? (defaults.categoryId || undefined);

            return {
               date: normalizeDate(r.data),
               name: r.nome || null,
               type: parseTipo(r.tipo),
               amount: r.valor,
               description: r.descricao || defaults.description || null,
               bankAccountId,
               destinationBankAccountId: null,
               categoryId: categoryId ?? null,
               subcategoryId: null,
               tagIds: [],
            };
         });

         await importMutation.mutateAsync({ transactions });
      });
   }, [rows, ignoreDuplicates, bankAccounts, categories, defaults, importMutation]);

   // =========================================================================
   // Render — Step: upload
   // =========================================================================
   if (step === "upload") {
      return (
         <>
            <CredenzaHeader>
               <CredenzaTitle>Importar Transações</CredenzaTitle>
            </CredenzaHeader>
            <CredenzaBody className="space-y-4">
               {/* File picker */}
               <div className="space-y-1.5">
                  <Label>Arquivo</Label>
                  <div
                     className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                     onClick={() => fileInputRef.current?.click()}
                     // biome-ignore lint/a11y/noStaticElementInteractions: file upload zone
                     onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                  >
                     <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
                     <p className="text-sm text-muted-foreground">
                        Clique ou arraste um arquivo <strong>.csv</strong> ou <strong>.ofx</strong>
                     </p>
                  </div>
                  <input
                     accept=".csv,.ofx"
                     className="hidden"
                     onChange={handleFileChange}
                     ref={fileInputRef}
                     type="file"
                  />
               </div>

               {/* Defaults */}
               <div className="space-y-3">
                  <p className="text-sm font-medium">Padrões (aplicados às células vazias)</p>

                  <div className="space-y-1.5">
                     <Label>Conta *</Label>
                     <Combobox
                        onChange={(v) => setDefaults((d) => ({ ...d, bankAccountId: v }))}
                        options={bankAccountOptions}
                        placeholder="Selecione uma conta"
                        value={defaults.bankAccountId}
                     />
                  </div>

                  <div className="space-y-1.5">
                     <Label>Categoria</Label>
                     <Combobox
                        onChange={(v) =>
                           setDefaults((d) => ({
                              ...d,
                              categoryId: v,
                              subcategoryId: "",
                           }))
                        }
                        options={categoryOptions}
                        placeholder="Selecione uma categoria"
                        value={defaults.categoryId}
                     />
                  </div>

                  {subcategoryOptions.length > 0 && (
                     <div className="space-y-1.5">
                        <Label>Subcategoria</Label>
                        <Combobox
                           onChange={(v) =>
                              setDefaults((d) => ({ ...d, subcategoryId: v }))
                           }
                           options={subcategoryOptions}
                           placeholder="Selecione uma subcategoria"
                           value={defaults.subcategoryId}
                        />
                     </div>
                  )}

                  <div className="space-y-1.5">
                     <Label>Observação</Label>
                     <Input
                        onChange={(e) =>
                           setDefaults((d) => ({
                              ...d,
                              description: e.target.value,
                           }))
                        }
                        placeholder="Observação padrão para todas as linhas"
                        value={defaults.description}
                     />
                  </div>
               </div>
            </CredenzaBody>
            <CredenzaFooter className="flex-col sm:flex-row gap-2">
               <Button onClick={handleDownloadTemplate} variant="outline">
                  <Download className="size-4 mr-2" />
                  Baixar modelo CSV
               </Button>
            </CredenzaFooter>
         </>
      );
   }

   // =========================================================================
   // Render — Step: preview
   // =========================================================================
   const visibleRows = ignoreDuplicates
      ? rows.filter((r) => !r.isDuplicate)
      : rows;
   const duplicateCount = rows.filter((r) => r.isDuplicate).length;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               Revisar Importação ({visibleRows.length} transações)
            </CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
               <Button
                  disabled={isVerifying}
                  onClick={handleVerify}
                  size="sm"
                  variant="outline"
               >
                  {isVerifying && (
                     <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  )}
                  Verificar duplicados
               </Button>

               {duplicateCount > 0 && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                     <Checkbox
                        checked={ignoreDuplicates}
                        onCheckedChange={(v) =>
                           setIgnoreDuplicates(v === true)
                        }
                     />
                     Ignorar {duplicateCount} duplicata
                     {duplicateCount > 1 ? "s" : ""}
                  </label>
               )}
            </div>

            <div className="rounded-md border overflow-auto max-h-72">
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Data</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Valor</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {visibleRows.map((row, i) => (
                        <TableRow key={`row-${i + 1}`}>
                           <TableCell>
                              {row.isDuplicate && (
                                 <AlertTriangle className="size-3.5 text-amber-500" />
                              )}
                           </TableCell>
                           <TableCell className="text-sm">
                              {row.data}
                           </TableCell>
                           <TableCell className="text-sm max-w-[160px] truncate">
                              {row.nome || "—"}
                           </TableCell>
                           <TableCell className="text-sm">{row.tipo}</TableCell>
                           <TableCell className="text-sm font-medium">
                              R$ {row.valor}
                           </TableCell>
                        </TableRow>
                     ))}
                  </TableBody>
               </Table>
            </div>
         </CredenzaBody>
         <CredenzaFooter className="flex-col sm:flex-row gap-2">
            <Button
               onClick={() => setStep("upload")}
               variant="outline"
            >
               Voltar
            </Button>
            <Button
               disabled={isPending || visibleRows.length === 0 || !defaults.bankAccountId}
               onClick={handleImport}
            >
               {isPending && (
                  <Loader2 className="size-4 mr-2 animate-spin" />
               )}
               Importar {visibleRows.length} transações
            </Button>
         </CredenzaFooter>
      </>
   );
}
```

**Note on `handleVerify`:** The snippet above has a placeholder for fetching existing transactions. In the real implementation, use `queryClient` from the TanStack Query context:

```typescript
import { useQueryClient } from "@tanstack/react-query";
const queryClient = useQueryClient();
// inside handleVerify:
const result = await queryClient.fetchQuery(
   orpc.transactions.getAll.queryOptions({
      input: {
         dateFrom: dates[0],
         dateTo: dates[dates.length - 1],
         pageSize: 500,
      },
   }),
);
const existing = result.data;
```

**Note on CSV parsing:** `parseOrThrow` returns a `CSVDocument`. Check the actual `CSVDocument` type — it may use `.rows[n].fields` or a different property name. Adjust accordingly.

### Step 2: Typecheck

```bash
bun run typecheck
```

### Step 3: Commit

```bash
git add apps/web/src/features/transactions/ui/transaction-import-credenza.tsx
git commit -m "feat(transactions): add TransactionImportCredenza with duplicate detection"
```

---

## Task 6: Wire Export + Import buttons to TransactionsPage

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx`

### Step 1: Add imports to `transactions.tsx`

At the top of the file, add alongside existing transaction imports:

```typescript
import { TransactionExportCredenza } from "@/features/transactions/ui/transaction-export-credenza";
import { TransactionImportCredenza } from "@/features/transactions/ui/transaction-import-credenza";
```

Add Lucide icons: `Download` and `Upload` to the existing icon imports.

### Step 2: Update `TransactionsPage` — add Export + Import buttons

`TransactionsPage` already has a `filters` state with `dateFrom` / `dateTo`. Pass those to `TransactionExportCredenza`.

Replace the `DefaultHeader` `actions` prop:

```typescript
// Before (current):
actions={
   <Button onClick={handleCreate} size="sm">
      <Plus className="size-4 mr-1" />
      Nova Transação
   </Button>
}

// After:
actions={
   <div className="flex items-center gap-2">
      <Button
         onClick={() =>
            openCredenza({
               children: (
                  <TransactionImportCredenza />
               ),
            })
         }
         size="sm"
         variant="outline"
      >
         <Upload className="size-4 mr-1" />
         Importar
      </Button>
      <Button
         onClick={() =>
            openCredenza({
               children: (
                  <TransactionExportCredenza
                     dateFrom={filters.dateFrom}
                     dateTo={filters.dateTo}
                  />
               ),
            })
         }
         size="sm"
         variant="outline"
      >
         <Download className="size-4 mr-1" />
         Exportar
      </Button>
      <Button onClick={handleCreate} size="sm">
         <Plus className="size-4 mr-1" />
         Nova Transação
      </Button>
   </div>
}
```

**Note:** Check the shape of `filters` — it may store dateFrom/dateTo as strings or as a `DateRange` object. Adjust accordingly.

### Step 3: Typecheck + run dev

```bash
bun run typecheck
bun dev
```

Verify buttons appear and open the correct modals.

### Step 4: Commit

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx
git commit -m "feat(transactions): wire Export and Import buttons to transactions page"
```

---

## Checklist

- [ ] Task 1: @f-o-t/csv and @f-o-t/ofx installed
- [ ] Task 2: `importBulk` oRPC procedure
- [ ] Task 3: Categories expandable subcategory rows
- [ ] Task 4: TransactionExportCredenza
- [ ] Task 5: TransactionImportCredenza
- [ ] Task 6: Buttons wired to TransactionsPage
