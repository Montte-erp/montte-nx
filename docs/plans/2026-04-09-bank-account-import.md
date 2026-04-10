# Bank Account Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a multi-step CSV/XLSX import flow for bank accounts, matching the transaction import UX exactly (stepper, panelAction button, TemplateCredenza, StepBar, context provider pattern).

**Architecture:** Two colocated files in `-bank-accounts/`: `use-bank-account-import.tsx` (context + state + parsing logic, mirrors `use-statement-import.tsx`) and `bank-account-import-credenza.tsx` (UI steps, mirrors `statement-import-credenza.tsx`). A new `bulkCreate` oRPC procedure + `bulkCreateBankAccounts` repository function. Import button added as a `panelAction` in `bank-accounts.tsx`.

**Tech Stack:** `useCsvFile`, `useXlsxFile`, `useFileDownload` hooks; `defineStepper`; `Choicebox` for template download; `useCredenza`; oRPC `protectedProcedure`; Drizzle bulk insert; `neverthrow`.

---

### Task 1: Add `bulkCreateBankAccounts` repository function

**Files:**
- Modify: `core/database/src/repositories/bank-accounts-repository.ts`

**Step 1: Add import for `bulkCreateBankAccounts` at the top — no new imports needed, all already imported**

**Step 2: Add the function after `createBankAccount`**

```typescript
export async function bulkCreateBankAccounts(
   db: DatabaseInstance,
   teamId: string,
   items: CreateBankAccountInput[],
) {
   const validated = items.map((item) => validateInput(createBankAccountSchema, item));
   try {
      const rows = await db
         .insert(bankAccounts)
         .values(validated.map((v) => ({ ...v, teamId })))
         .returning();
      return rows;
   } catch (err) {
      propagateError(err);
      throw AppError.database("Failed to bulk create bank accounts");
   }
}
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add core/database/src/repositories/bank-accounts-repository.ts
git commit -m "feat(bank-accounts): add bulkCreateBankAccounts repository function"
```

---

### Task 2: Add `bulkCreate` oRPC procedure

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/bank-accounts.ts`

**Step 1: Add `bulkCreateBankAccounts` to the repository import**

**Step 2: Add `createBankAccountSchema` to the schema import (it's in `@core/database/schemas/bank-accounts`)**

**Step 3: Add the procedure**

```typescript
export const bulkCreate = protectedProcedure
   .input(
      z.object({
         accounts: z.array(createBankAccountSchema).min(1).max(500),
      }),
   )
   .handler(async ({ context, input }) => {
      const rows = await bulkCreateBankAccounts(
         context.db,
         context.teamId,
         input.accounts,
      );
      return { created: rows.length };
   });
```

**Step 4: Register in the router**

Find where the bankAccounts router object is assembled (search for `bankAccounts` in `apps/web/src/integrations/orpc/router/`). Add `bulkCreate` alongside `create`, `getAll`, `getById`, `update`, `remove`.

```bash
grep -r "bankAccounts" apps/web/src/integrations/orpc/router/ --include="*.ts" -l
```

**Step 5: Typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add apps/web/src/integrations/orpc/router/bank-accounts.ts
git commit -m "feat(bank-accounts): add bulkCreate oRPC procedure"
```

---

### Task 3: Create `use-bank-account-import.tsx` context

This mirrors `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.tsx` exactly in structure, but with bank-account-specific fields.

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/use-bank-account-import.tsx`

**Step 1: Define types and constants**

```typescript
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useLocalStorage } from "foxact/use-local-storage";
import { invariant } from "foxact/invariant";
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

export type FileFormat = "csv" | "xlsx";

export type RawData = {
   headers: string[];
   rows: string[][];
};

export type ColumnField = "tipo" | "nome" | "descricao" | "saldo_inicial" | "cor";

export type ColumnMapping = Record<ColumnField, string>;

export const COLUMN_FIELDS: ColumnField[] = [
   "tipo",
   "nome",
   "descricao",
   "saldo_inicial",
   "cor",
];

export const REQUIRED_FIELDS: ColumnField[] = ["tipo", "nome"];

export const FIELD_LABELS: Record<ColumnField, string> = {
   tipo: "Tipo de conta *",
   nome: "Nome *",
   descricao: "Descrição",
   saldo_inicial: "Saldo inicial",
   cor: "Cor (hex)",
};

export const TEMPLATE_HEADERS = [
   "tipo",
   "nome",
   "descricao",
   "saldo_inicial",
   "cor",
] as const;

export const TEMPLATE_ROWS = [
   {
      tipo: "corrente",
      nome: "Nubank",
      descricao: "Conta principal",
      saldo_inicial: "1500.00",
      cor: "#6366f1",
   },
   {
      tipo: "poupanca",
      nome: "Caixa Econômica",
      descricao: "",
      saldo_inicial: "500.00",
      cor: "#22c55e",
   },
] as const;

// Accepts Portuguese aliases + raw enum values
export const TYPE_MAP: Record<string, string> = {
   caixa: "cash",
   "caixa fisico": "cash",
   "caixa físico": "cash",
   cash: "cash",
   corrente: "checking",
   "conta corrente": "checking",
   checking: "checking",
   poupanca: "savings",
   poupança: "savings",
   "conta poupanca": "savings",
   "conta poupança": "savings",
   savings: "savings",
   pagamento: "payment",
   "conta pagamento": "payment",
   payment: "payment",
   investimento: "investment",
   "conta investimento": "investment",
   investment: "investment",
};

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export type PreviewRow = {
   tipo: string;
   nome: string;
   descricao: string;
   saldo_inicial: string;
   cor: string;
   _resolvedType: string | null;
   _valid: boolean;
   _errors: string[];
};

export function buildPreviewRows(
   rawData: RawData,
   mapping: ColumnMapping,
): PreviewRow[] {
   return rawData.rows.map((row) => {
      const get = (field: ColumnField) => {
         const col = mapping[field];
         if (!col) return "";
         const idx = rawData.headers.indexOf(col);
         return idx >= 0 ? (row[idx] ?? "").trim() : "";
      };
      const tipo = get("tipo");
      const nome = get("nome");
      const resolvedType = TYPE_MAP[tipo.toLowerCase().trim()] ?? null;
      const errors: string[] = [];
      if (!resolvedType) errors.push("Tipo inválido");
      if (nome.length < 2) errors.push("Nome muito curto");
      return {
         tipo,
         nome,
         descricao: get("descricao"),
         saldo_inicial: get("saldo_inicial"),
         cor: get("cor"),
         _resolvedType: resolvedType,
         _valid: errors.length === 0,
         _errors: errors,
      };
   });
}

export function toCreateInput(row: PreviewRow) {
   const resolvedColor = HEX_COLOR_REGEX.test(row.cor) ? row.cor : "#6366f1";
   const rawBalance = row.saldo_inicial.replace(",", ".");
   const resolvedBalance = Number.isNaN(Number(rawBalance))
      ? "0"
      : String(Number(rawBalance));
   return {
      type: row._resolvedType as
         | "checking"
         | "savings"
         | "investment"
         | "payment"
         | "cash",
      name: row.nome.trim(),
      notes: row.descricao || null,
      initialBalance: resolvedBalance,
      color: resolvedColor,
   };
}
```

**Step 2: Create context + provider**

```typescript
const EMPTY_MAPPING: ColumnMapping = {
   tipo: "",
   nome: "",
   descricao: "",
   saldo_inicial: "",
   cor: "",
};

function autoDetectMapping(headers: string[]): ColumnMapping {
   const mapped = { ...EMPTY_MAPPING };
   for (const field of COLUMN_FIELDS) {
      const match = headers.find(
         (h) => h.toLowerCase().trim() === field.replace("_", " "),
      );
      if (match) mapped[field] = match;
   }
   return mapped;
}

type BankAccountImportContextValue = {
   rawData: RawData | null;
   mapping: ColumnMapping;
   setMapping: (m: ColumnMapping) => void;
   savedMappingApplied: boolean;
   parseFile: (file: File) => Promise<void>;
   applyColumnMapping: (m: ColumnMapping) => void;
   resetMapping: () => void;
   previewRows: PreviewRow[];
};

const BankAccountImportContext =
   createContext<BankAccountImportContextValue | null>(null);

export function useBankAccountImportContext() {
   const ctx = useContext(BankAccountImportContext);
   invariant(ctx, "useBankAccountImportContext must be used inside BankAccountImportProvider");
   return ctx;
}

export function BankAccountImportProvider({ children }: { children: ReactNode }) {
   const csv = useCsvFile();
   const xlsx = useXlsxFile();
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [mapping, setMappingState] = useState<ColumnMapping>(EMPTY_MAPPING);
   const [savedMappingApplied, setSavedMappingApplied] = useState(false);
   const [savedMapping, setSavedMapping] = useLocalStorage<ColumnMapping | null>(
      "montte:bank-account-import:mapping",
      null,
   );

   const parseFile = useCallback(
      async (file: File) => {
         const ext = file.name.split(".").pop()?.toLowerCase();
         const data =
            ext === "xlsx" || ext === "xls"
               ? await xlsx.parse(file)
               : await csv.parse(file);
         setRawData(data);
         const auto = autoDetectMapping(data.headers);
         if (savedMapping) {
            // only apply saved keys that exist in current headers
            const applied = { ...auto };
            for (const field of COLUMN_FIELDS) {
               if (
                  savedMapping[field] &&
                  data.headers.includes(savedMapping[field])
               ) {
                  applied[field] = savedMapping[field];
               }
            }
            setMappingState(applied);
            setSavedMappingApplied(true);
         } else {
            setMappingState(auto);
            setSavedMappingApplied(false);
         }
      },
      [csv, xlsx, savedMapping],
   );

   const applyColumnMapping = useCallback(
      (m: ColumnMapping) => {
         setMappingState(m);
         setSavedMapping(m);
         setSavedMappingApplied(false);
      },
      [setSavedMapping],
   );

   const resetMapping = useCallback(() => {
      if (!rawData) return;
      const auto = autoDetectMapping(rawData.headers);
      setMappingState(auto);
      setSavedMappingApplied(false);
   }, [rawData]);

   const previewRows = rawData
      ? buildPreviewRows(rawData, mapping)
      : [];

   return (
      <BankAccountImportContext.Provider
         value={{
            rawData,
            mapping,
            setMapping: setMappingState,
            savedMappingApplied,
            parseFile,
            applyColumnMapping,
            resetMapping,
            previewRows,
         }}
      >
         {children}
      </BankAccountImportContext.Provider>
   );
}
```

**Step 3: Typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/use-bank-account-import.tsx
git commit -m "feat(bank-accounts): add bank account import context and logic"
```

---

### Task 4: Create `bank-account-import-credenza.tsx` UI

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/bank-account-import-credenza.tsx`

**Step 1: Imports + stepper + StepBar**

```typescript
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxItem,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
   ChoiceboxItemDescription,
   ChoiceboxIndicator,
} from "@packages/ui/components/choicebox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Badge } from "@packages/ui/components/badge";
import { defineStepper } from "@packages/ui/components/stepper";
import { useMutation } from "@tanstack/react-query";
import { ChevronRight, FileSpreadsheet, Loader2, Table2, CheckCircle2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { fromPromise } from "neverthrow";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useFileDownload } from "@/hooks/use-file-download";
import {
   BankAccountImportProvider,
   COLUMN_FIELDS,
   FIELD_LABELS,
   REQUIRED_FIELDS,
   TEMPLATE_HEADERS,
   TEMPLATE_ROWS,
   toCreateInput,
   useBankAccountImportContext,
} from "./use-bank-account-import";

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type StepperMethods = ReturnType<typeof useStepper>;

const TEMPLATE_OPTIONS = [
   {
      value: "csv" as const,
      label: "CSV",
      description: "Compatível com qualquer planilha ou editor de texto",
      icon: FileSpreadsheet,
      iconClass: "text-emerald-600",
      filename: "modelo-contas-bancarias.csv",
   },
   {
      value: "xlsx" as const,
      label: "XLSX",
      description: "Excel e Google Sheets — com formatação de colunas",
      icon: Table2,
      iconClass: "text-green-600",
      filename: "modelo-contas-bancarias.xlsx",
   },
] as const;

function StepBar({ methods }: { methods: StepperMethods }) {
   const steps = methods.state.all;
   const current = methods.lookup.getIndex(methods.state.current.data.id);
   return (
      <div className="flex items-center gap-2">
         {steps.map((_s, i) => (
            <div
               className={[
                  "h-1 rounded-full flex-1 transition-all",
                  i === current
                     ? "bg-primary"
                     : i < current
                       ? "bg-primary/40"
                       : "bg-muted",
               ].join(" ")}
               key={`step-${i + 1}`}
            />
         ))}
      </div>
   );
}
```

**Step 2: `TemplateCredenza` component**

```typescript
function TemplateCredenza({ onClose }: { onClose?: () => void }) {
   const csv = useCsvFile();
   const xlsx = useXlsxFile();
   const { download } = useFileDownload();
   const generators = { csv, xlsx } as const;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Baixar modelo</CredenzaTitle>
            <CredenzaDescription>
               Use como referência para formatar seu arquivo antes de importar
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <Choicebox className="grid grid-cols-2 gap-2">
               {TEMPLATE_OPTIONS.map(
                  ({ value, label, description, icon: Icon, iconClass, filename }) => (
                     <ChoiceboxItem key={value} value={value} id={`template-${value}`}>
                        <ChoiceboxIndicator id={`template-${value}`} className="sr-only" />
                        <button
                           type="button"
                           className="flex flex-col gap-2 w-full cursor-pointer"
                           onClick={() => {
                              download(
                                 generators[value].generate(
                                    TEMPLATE_ROWS.map((r) => ({ ...r })),
                                    [...TEMPLATE_HEADERS],
                                 ),
                                 filename,
                              );
                              onClose?.();
                           }}
                        >
                           <Icon className={`size-5 shrink-0 ${iconClass}`} />
                           <ChoiceboxItemHeader>
                              <ChoiceboxItemTitle>{label}</ChoiceboxItemTitle>
                              <ChoiceboxItemDescription>
                                 {description}
                              </ChoiceboxItemDescription>
                           </ChoiceboxItemHeader>
                        </button>
                     </ChoiceboxItem>
                  ),
               )}
            </Choicebox>
         </CredenzaBody>
      </>
   );
}
```

**Step 3: `UploadStep` component**

```typescript
function UploadStep({ methods }: { methods: StepperMethods }) {
   const { parseFile } = useBankAccountImportContext();
   const [isPending, startTransition] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { openCredenza, closeCredenza } = useCredenza();

   function handleFile(file: File) {
      setSelectedFile(file);
      startTransition(async () => {
         try {
            await parseFile(file);
            methods.navigation.next();
         } catch {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") {
               toast.error("Erro ao processar planilha XLSX.");
            } else {
               toast.error("Erro ao processar arquivo CSV.");
            }
            setSelectedFile(undefined);
         }
      });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar contas bancárias</CredenzaTitle>
            <CredenzaDescription>
               Envie um arquivo CSV ou XLSX com suas contas bancárias
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />
               <Dropzone
                  accept={{
                     "text/csv": [".csv"],
                     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
                     "application/vnd.ms-excel": [".xls"],
                  }}
                  disabled={isPending}
                  maxFiles={1}
                  onDrop={([file]) => {
                     if (file) handleFile(file);
                  }}
                  src={selectedFile ? [selectedFile] : undefined}
               >
                  <DropzoneEmptyState>
                     {isPending ? (
                        <Loader2 className="size-8 text-primary animate-spin" />
                     ) : (
                        <>
                           <FileSpreadsheet className="size-8 text-muted-foreground" />
                           <p className="font-medium text-sm">
                              Arraste e solte ou clique para selecionar
                           </p>
                           <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                                 <FileSpreadsheet className="size-3.5 text-emerald-600" />
                                 <span className="text-xs font-medium">CSV</span>
                              </div>
                              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                                 <FileSpreadsheet className="size-3.5 text-green-600" />
                                 <span className="text-xs font-medium">XLSX</span>
                              </div>
                           </div>
                        </>
                     )}
                  </DropzoneEmptyState>
                  <DropzoneContent />
               </Dropzone>
               <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="self-start px-0 text-muted-foreground"
                  onClick={() =>
                     openCredenza({
                        children: <TemplateCredenza onClose={closeCredenza} />,
                     })
                  }
               >
                  Baixar modelo
               </Button>
            </div>
         </CredenzaBody>
      </>
   );
}
```

**Step 4: `MapStep` component**

```typescript
function MapStep({ methods }: { methods: StepperMethods }) {
   const {
      rawData,
      mapping,
      setMapping,
      savedMappingApplied,
      applyColumnMapping,
      resetMapping,
   } = useBankAccountImportContext();

   if (!rawData) return null;
   const canProceed = REQUIRED_FIELDS.every((f) => mapping[f] !== "");

   function handleNext() {
      applyColumnMapping(mapping);
      methods.navigation.next();
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Mapeie as colunas</CredenzaTitle>
            <CredenzaDescription>
               Diga ao sistema o que cada coluna representa
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />
               {savedMappingApplied && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                     <p className="text-xs text-muted-foreground">
                        Mapeamento anterior aplicado
                     </p>
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground h-auto py-0 px-1"
                        onClick={resetMapping}
                     >
                        Redefinir
                     </Button>
                  </div>
               )}
               <div className="flex flex-col gap-1">
                  <div className="grid grid-cols-[10rem_1fr] items-center gap-2 px-1 pb-1">
                     <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Campo
                     </span>
                     <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Coluna do arquivo
                     </span>
                  </div>
                  {COLUMN_FIELDS.map((field) => (
                     <div
                        key={field}
                        className="grid grid-cols-[10rem_1fr] items-center gap-2 rounded-md px-1 py-1.5 hover:bg-muted/30"
                     >
                        <span className="text-sm font-medium truncate">
                           {FIELD_LABELS[field]}
                        </span>
                        <Select
                           value={mapping[field] ?? ""}
                           onValueChange={(v) =>
                              setMapping({ ...mapping, [field]: v })
                           }
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Não importar" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="">Não importar</SelectItem>
                              {rawData.headers.map((h) => (
                                 <SelectItem key={h} value={h}>
                                    {h}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  ))}
               </div>
            </div>
         </CredenzaBody>
         <CredenzaFooter className="flex gap-2">
            <Button
               variant="outline"
               type="button"
               onClick={() => methods.navigation.back()}
            >
               Voltar
            </Button>
            <Button type="button" disabled={!canProceed} onClick={handleNext}>
               Continuar <ChevronRight className="size-4" />
            </Button>
         </CredenzaFooter>
      </>
   );
}
```

**Step 5: `PreviewStep` component**

```typescript
function PreviewStep({ methods }: { methods: StepperMethods }) {
   const { previewRows } = useBankAccountImportContext();
   const validCount = previewRows.filter((r) => r._valid).length;
   const invalidCount = previewRows.length - validCount;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Prévia da importação</CredenzaTitle>
            <CredenzaDescription>
               {validCount} conta(s) válida(s)
               {invalidCount > 0
                  ? ` · ${invalidCount} com erro (serão ignoradas)`
                  : ""}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />
               <div className="max-h-72 overflow-y-auto rounded-md border">
                  <table className="w-full text-sm">
                     <thead className="border-b bg-muted/50">
                        <tr>
                           <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                           <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nome</th>
                           <th className="px-3 py-2 text-left font-medium text-muted-foreground">Saldo inicial</th>
                           <th className="px-3 py-2 text-left font-medium text-muted-foreground" />
                        </tr>
                     </thead>
                     <tbody>
                        {previewRows.slice(0, 50).map((row, i) => (
                           <tr
                              key={`preview-row-${i + 1}`}
                              className={row._valid ? "" : "opacity-50"}
                           >
                              <td className="px-3 py-2">{row.tipo}</td>
                              <td className="px-3 py-2">{row.nome}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                 {row.saldo_inicial || "0"}
                              </td>
                              <td className="px-3 py-2">
                                 {row._valid ? (
                                    <CheckCircle2 className="size-4 text-green-600" />
                                 ) : (
                                    <Badge variant="destructive" className="text-xs">
                                       {row._errors[0]}
                                    </Badge>
                                 )}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </CredenzaBody>
         <CredenzaFooter className="flex gap-2">
            <Button
               variant="outline"
               type="button"
               onClick={() => methods.navigation.back()}
            >
               Voltar
            </Button>
            <Button
               type="button"
               disabled={validCount === 0}
               onClick={() => methods.navigation.next()}
            >
               Importar {validCount} conta(s) <ChevronRight className="size-4" />
            </Button>
         </CredenzaFooter>
      </>
   );
}
```

**Step 6: `ConfirmStep` component**

```typescript
function ConfirmStep({
   onSuccess,
}: {
   onSuccess: () => void;
}) {
   const { previewRows } = useBankAccountImportContext();
   const [isPending, startTransition] = useTransition();
   const bulkCreate = useMutation(orpc.bankAccounts.bulkCreate.mutationOptions());

   const validRows = previewRows.filter((r) => r._valid);

   function handleImport() {
      const accounts = validRows.map(toCreateInput);
      startTransition(async () => {
         const result = await fromPromise(
            bulkCreate.mutateAsync({ accounts }),
            (e) => e,
         );
         if (result.isErr()) {
            const err = result.error;
            toast.error(
               err instanceof Error ? err.message : "Erro ao importar contas.",
            );
            return;
         }
         toast.success(
            `${result.value.created} conta(s) importada(s) com sucesso.`,
         );
         onSuccess();
      });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Confirmar importação</CredenzaTitle>
            <CredenzaDescription>
               {validRows.length} conta(s) serão criadas.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <StepBar methods={useStepper()} />
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               className="w-full gap-2"
               disabled={isPending}
               type="button"
               onClick={handleImport}
            >
               {isPending && <Loader2 className="size-4 animate-spin" />}
               Confirmar importação
            </Button>
         </CredenzaFooter>
      </>
   );
}
```

> **Note:** `ConfirmStep` calls `useStepper()` directly for the StepBar — check if this is the correct API by looking at how other steps in `statement-import-credenza.tsx` pass the `methods` prop vs call the hook. Mirror exactly.

**Step 7: Root `BankAccountImportCredenza` export**

```typescript
export function BankAccountImportCredenza({ onClose }: { onClose: () => void }) {
   return (
      <BankAccountImportProvider>
         <Stepper.Provider>
            {({ methods }) => (
               <>
                  <Stepper.Step of={Stepper} step={methods.when("upload")}>
                     <UploadStep methods={methods} />
                  </Stepper.Step>
                  <Stepper.Step of={Stepper} step={methods.when("map")}>
                     <MapStep methods={methods} />
                  </Stepper.Step>
                  <Stepper.Step of={Stepper} step={methods.when("preview")}>
                     <PreviewStep methods={methods} />
                  </Stepper.Step>
                  <Stepper.Step of={Stepper} step={methods.when("confirm")}>
                     <ConfirmStep onSuccess={onClose} />
                  </Stepper.Step>
               </>
            )}
         </Stepper.Provider>
      </BankAccountImportProvider>
   );
}
```

> **Critical:** The `Stepper.Provider` / `Stepper.Step` API shape depends on the actual `defineStepper` implementation. Read `statement-import-credenza.tsx` lines 200–500 to see the exact JSX structure used, then mirror it verbatim. Do NOT guess.

**Step 8: Typecheck**

```bash
bun run typecheck
```

**Step 9: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/bank-account-import-credenza.tsx
git commit -m "feat(bank-accounts): add bank account import credenza UI"
```

---

### Task 5: Wire import button into bank-accounts page

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx`

**Step 1: Add imports**

```typescript
import { Upload } from "lucide-react"; // already imported? check
import type { PanelAction } from "@/features/context-panel/context-panel-store";
import { BankAccountImportCredenza } from "./-bank-accounts/bank-account-import-credenza";
```

**Step 2: Add `panelActions` in `BankAccountsPage` — same pattern as `transactions.tsx`**

```typescript
const panelActions: PanelAction[] = [
   {
      icon: Upload,
      label: "Importar",
      onClick: () =>
         openCredenza({
            children: (
               <BankAccountImportCredenza onClose={closeCredenza} />
            ),
         }),
   },
];
```

**Step 3: Pass `panelActions` to `DefaultHeader`**

```typescript
<DefaultHeader
   actions={
      <Button onClick={handleCreate}>
         <Plus className="size-4" />
         Nova Conta
      </Button>
   }
   description="Gerencie suas contas bancárias e saldos"
   panelActions={panelActions}
   title="Contas Bancárias"
/>
```

**Step 4: Typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx
git commit -m "feat(bank-accounts): wire import panelAction in bank accounts page"
```

---

### Task 6: Cross-check stepper API and fix mismatches

**Step 1: Read the actual stepper render structure from `statement-import-credenza.tsx`**

```bash
# Read lines 500-700 to see Stepper.Provider usage
```

**Step 2: Compare `ConfirmStep` — does it receive `methods` as prop or call `useStepper()` internally?**

Fix any mismatches in `bank-account-import-credenza.tsx` to mirror exactly.

**Step 3: Final typecheck**

```bash
bun run typecheck
```

**Step 4: Commit any fixes**

```bash
git add -p
git commit -m "fix(bank-accounts): align stepper API with statement import pattern"
```

---

### Task 7: Manual smoke test checklist

Run `bun dev` and verify:

1. Contas Bancárias page loads — confirm panel menu (kebab/actions) has "Importar" entry with Upload icon, matching the transaction page style.
2. Click "Importar" — Credenza opens at step 1 (Arquivo) with 4-step progress bar.
3. Click "Baixar modelo" — nested credenza opens with CSV/XLSX Choicebox. Download both and verify headers match `TEMPLATE_HEADERS`.
4. Drop the CSV template — stepper advances to step 2 (Colunas). Verify columns are auto-detected.
5. Drop the XLSX template — same behavior.
6. Step 2: confirm "tipo" and "nome" are required (marked with `*`). Click Continuar with both mapped.
7. Step 3 (Prévia): template rows show green checkmarks. Edit the template to add a row with invalid type — verify it shows red badge and error text.
8. Click "Importar N conta(s)" — step 4 (Importar) confirms count.
9. Click "Confirmar importação" — spinner, then toast "N conta(s) importada(s) com sucesso." Credenza closes.
10. New accounts appear in the list immediately (query invalidated by global MutationCache).
11. Re-open import — verify saved column mapping is restored with "Mapeamento anterior aplicado" banner.
