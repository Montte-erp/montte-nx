# Credit Cards Import Credenza Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a multi-step CSV/XLSX import credenza for credit cards and wire an Upload button into the credit-cards route's DefaultHeader.

**Architecture:** A `CreditCardsImportCredenza` component using `defineStepper` from `@packages/ui/components/stepper` with 4 steps: Upload → Mapeamento → Preview → Importar. The credenza reads CSV/XLSX files, maps columns to card fields, validates the parsed rows, then calls `orpc.creditCards.bulkCreate`.

**Tech Stack:** TanStack Query, oRPC, `@packages/ui/components/stepper`, `@packages/ui/components/credenza`, `@packages/ui/components/dropzone`, `@packages/ui/components/select`, `@packages/ui/components/table`, `useCsvFile`, `useXlsxFile`.

---

### Task 1: Create the import credenza file

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-credit-cards/credit-cards-import-credenza.tsx`

**Step 1: Write the full component**

The file contents should be:

```tsx
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { defineStepper } from "@packages/ui/components/stepper";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Mapeamento" },
   { id: "preview", title: "Prévia" },
   { id: "importar", title: "Importar" },
);

type StepperMethods = ReturnType<typeof useStepper>;

type ColumnMapping = {
   nome: string;
   limite_credito: string;
   dia_fechamento: string;
   dia_vencimento: string;
   conta_bancaria_id: string;
   status: string;
   bandeira: string;
};

type ParsedCard = {
   nome: string;
   creditLimit: string;
   closingDay: string;
   dueDay: string;
   bankAccountId: string;
   status: string;
   brand: string;
   errors: string[];
};

type RawFileData = {
   headers: string[];
   rows: string[][];
};

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
   nome: "Nome *",
   limite_credito: "Limite de Crédito *",
   dia_fechamento: "Dia de Fechamento *",
   dia_vencimento: "Dia de Vencimento *",
   conta_bancaria_id: "ID da Conta Bancária *",
   status: "Status",
   bandeira: "Bandeira",
};

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = [
   "nome",
   "limite_credito",
   "dia_fechamento",
   "dia_vencimento",
   "conta_bancaria_id",
];

function guessMapping(headers: string[]): Partial<ColumnMapping> {
   const mapping: Partial<ColumnMapping> = {};
   const lower = headers.map((h) => h.toLowerCase().trim());

   const patterns: Record<keyof ColumnMapping, string[]> = {
      nome: ["nome", "name", "cartao", "card"],
      limite_credito: ["limite", "credito", "credit_limit", "limite_credito"],
      dia_fechamento: ["fechamento", "closing", "dia_fechamento", "closing_day"],
      dia_vencimento: ["vencimento", "due", "dia_vencimento", "due_day"],
      conta_bancaria_id: ["conta", "bank", "conta_bancaria", "bank_account"],
      status: ["status", "estado"],
      bandeira: ["bandeira", "brand", "bandeira_cartao"],
   };

   for (const [field, candidates] of Object.entries(patterns)) {
      const idx = lower.findIndex((h) =>
         candidates.some((c) => h.includes(c)),
      );
      if (idx !== -1) {
         mapping[field as keyof ColumnMapping] = headers[idx];
      }
   }

   return mapping;
}

function parseCards(
   headers: string[],
   rows: string[][],
   mapping: ColumnMapping,
): ParsedCard[] {
   const get = (row: string[], field: keyof ColumnMapping): string => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx !== -1 ? (row[idx] ?? "").trim() : "";
   };

   return rows.map((row) => {
      const nome = get(row, "nome");
      const creditLimit = get(row, "limite_credito").replace(/[^\d.]/g, "");
      const closingDay = get(row, "dia_fechamento");
      const dueDay = get(row, "dia_vencimento");
      const bankAccountId = get(row, "conta_bancaria_id");
      const status = get(row, "status") || "active";
      const brand = get(row, "bandeira");

      const errors: string[] = [];
      if (!nome) errors.push("Nome obrigatório");
      if (!creditLimit || Number.isNaN(Number(creditLimit)))
         errors.push("Limite de crédito inválido");
      const cd = Number(closingDay);
      if (!closingDay || cd < 1 || cd > 31)
         errors.push("Dia de fechamento inválido (1-31)");
      const dd = Number(dueDay);
      if (!dueDay || dd < 1 || dd > 31)
         errors.push("Dia de vencimento inválido (1-31)");
      if (!bankAccountId) errors.push("ID da conta bancária obrigatório");

      return { nome, creditLimit, closingDay, dueDay, bankAccountId, status, brand, errors };
   });
}

function StepIndicator({ methods }: { methods: StepperMethods }) {
   const steps = methods.state.all;
   const currentIndex = methods.lookup.getIndex(methods.state.current.data.id);

   return (
      <div className="flex items-center gap-2">
         {steps.map((step, idx) => (
            <div
               className={[
                  "h-1 rounded-full transition-all duration-300 flex-1",
                  idx === currentIndex
                     ? "bg-primary"
                     : idx < currentIndex
                       ? "bg-primary/50"
                       : "bg-muted",
               ].join(" ")}
               key={step.id}
            />
         ))}
      </div>
   );
}

interface UploadStepProps {
   methods: StepperMethods;
   onFileReady: (data: RawFileData) => void;
}

function UploadStep({ methods, onFileReady }: UploadStepProps) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   async function processFile(file: File) {
      setSelectedFile(file);
      setIsParsing(true);
      try {
         const isCsv = file.name.toLowerCase().endsWith(".csv");
         const data = isCsv ? await parseCsv(file) : await parseXlsx(file);
         onFileReady(data);
         methods.next();
      } catch {
         toast.error("Erro ao processar arquivo. Verifique o formato.");
      } finally {
         setIsParsing(false);
      }
   }

   return (
      <div className="flex flex-col gap-4">
         <Dropzone
            accept={{ "text/csv": [".csv"], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] }}
            maxFiles={1}
            onDropAccepted={(files) => {
               const file = files[0];
               if (file) processFile(file);
            }}
         >
            <DropzoneEmptyState />
            <DropzoneContent />
         </Dropzone>
         {selectedFile && (
            <p className="text-muted-foreground text-sm">
               {isParsing ? "Processando..." : selectedFile.name}
            </p>
         )}
         <CredenzaFooter>
            <Button disabled={isParsing} onClick={() => methods.next()} type="button" variant="outline">
               Próximo
            </Button>
         </CredenzaFooter>
      </div>
   );
}

interface MapStepProps {
   methods: StepperMethods;
   headers: string[];
   mapping: Partial<ColumnMapping>;
   onMappingChange: (mapping: Partial<ColumnMapping>) => void;
   onNext: () => void;
}

function MapStep({ methods, headers, mapping, onMappingChange, onNext }: MapStepProps) {
   const NONE = "__none__";

   function canProceed() {
      return REQUIRED_FIELDS.every((f) => Boolean(mapping[f]));
   }

   return (
      <div className="flex flex-col gap-4">
         <FieldGroup>
            {(Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]).map((field) => (
               <Field key={field}>
                  <FieldLabel>{FIELD_LABELS[field]}</FieldLabel>
                  <Select
                     onValueChange={(val) =>
                        onMappingChange({
                           ...mapping,
                           [field]: val === NONE ? "" : val,
                        })
                     }
                     value={mapping[field] ?? NONE}
                  >
                     <SelectTrigger>
                        <SelectValue placeholder="Selecionar coluna" />
                     </SelectTrigger>
                     <SelectContent>
                        <SelectItem value={NONE}>— Não mapear —</SelectItem>
                        {headers.map((h) => (
                           <SelectItem key={h} value={h}>
                              {h}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </Field>
            ))}
         </FieldGroup>
         <CredenzaFooter>
            <Button onClick={() => methods.prev()} type="button" variant="outline">
               Voltar
            </Button>
            <Button disabled={!canProceed()} onClick={onNext} type="button">
               Próximo
            </Button>
         </CredenzaFooter>
      </div>
   );
}

interface PreviewStepProps {
   methods: StepperMethods;
   cards: ParsedCard[];
   onNext: () => void;
}

function PreviewStep({ methods, cards, onNext }: PreviewStepProps) {
   const validCount = cards.filter((c) => c.errors.length === 0).length;
   const invalidCount = cards.length - validCount;

   return (
      <div className="flex flex-col gap-4">
         <div className="flex gap-4 text-sm">
            <span className="text-green-600">{validCount} válidos</span>
            {invalidCount > 0 && (
               <span className="text-destructive">{invalidCount} com erros</span>
            )}
         </div>
         <div className="max-h-64 overflow-auto rounded-md border">
            <Table>
               <TableHeader>
                  <TableRow>
                     <TableHead>Status</TableHead>
                     <TableHead>Nome</TableHead>
                     <TableHead>Limite</TableHead>
                     <TableHead>Fechamento</TableHead>
                     <TableHead>Vencimento</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {cards.map((card, idx) => (
                     <TableRow key={`card-${idx + 1}`}>
                        <TableCell>
                           {card.errors.length === 0 ? (
                              <CheckCircle2 className="size-4 text-green-600" />
                           ) : (
                              <AlertCircle className="size-4 text-destructive" title={card.errors.join(", ")} />
                           )}
                        </TableCell>
                        <TableCell>{card.nome}</TableCell>
                        <TableCell>{card.creditLimit}</TableCell>
                        <TableCell>{card.closingDay}</TableCell>
                        <TableCell>{card.dueDay}</TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         </div>
         <CredenzaFooter>
            <Button onClick={() => methods.prev()} type="button" variant="outline">
               Voltar
            </Button>
            <Button disabled={validCount === 0} onClick={onNext} type="button">
               Importar {validCount} cartão{validCount !== 1 ? "ões" : ""}
            </Button>
         </CredenzaFooter>
      </div>
   );
}

interface ImportStepProps {
   cards: ParsedCard[];
   onClose: () => void;
}

function ImportStep({ cards, onClose }: ImportStepProps) {
   const [result, setResult] = useState<{ created: number } | null>(null);

   const importMutation = useMutation(
      orpc.creditCards.bulkCreate.mutationOptions({
         onSuccess: (data) => {
            setResult(data);
            toast.success(`${data.created} cartão${data.created !== 1 ? "ões" : ""} importado${data.created !== 1 ? "s" : ""} com sucesso.`);
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao importar cartões.");
         },
      }),
   );

   const validCards = cards.filter((c) => c.errors.length === 0);

   function handleImport() {
      importMutation.mutate({
         cards: validCards.map((c) => ({
            name: c.nome,
            creditLimit: c.creditLimit,
            closingDay: Number(c.closingDay),
            dueDay: Number(c.dueDay),
            bankAccountId: c.bankAccountId,
            status: c.status as "active" | "blocked" | "cancelled" | undefined,
            brand: c.brand || undefined,
         })),
      });
   }

   if (result) {
      return (
         <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-green-600">
               <CheckCircle2 className="size-5" />
               <p>{result.created} cartão{result.created !== 1 ? "ões" : ""} importado{result.created !== 1 ? "s" : ""} com sucesso.</p>
            </div>
            <CredenzaFooter>
               <Button onClick={onClose} type="button">
                  Fechar
               </Button>
            </CredenzaFooter>
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-4">
         <p className="text-muted-foreground text-sm">
            {validCards.length} cartão{validCards.length !== 1 ? "ões" : ""} pronto{validCards.length !== 1 ? "s" : ""} para importação.
         </p>
         <CredenzaFooter>
            <Button
               disabled={importMutation.isPending}
               onClick={handleImport}
               type="button"
            >
               {importMutation.isPending ? "Importando..." : "Confirmar Importação"}
            </Button>
         </CredenzaFooter>
      </div>
   );
}

interface CreditCardsImportCredenzaProps {
   onClose: () => void;
}

export function CreditCardsImportCredenza({ onClose }: CreditCardsImportCredenzaProps) {
   const [rawData, setRawData] = useState<RawFileData | null>(null);
   const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
   const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);

   function handleFileReady(data: RawFileData) {
      setRawData(data);
      setMapping(guessMapping(data.headers));
   }

   function handleMappingNext() {
      if (!rawData) return;
      const fullMapping = mapping as ColumnMapping;
      const cards = parseCards(rawData.headers, rawData.rows, fullMapping);
      setParsedCards(cards);
   }

   return (
      <Stepper.Provider>
         {({ methods }) => (
            <>
               <CredenzaHeader>
                  <CredenzaTitle>Importar Cartões de Crédito</CredenzaTitle>
                  <StepIndicator methods={methods} />
               </CredenzaHeader>
               <CredenzaBody>
                  <Stepper.Step of="upload">
                     <UploadStep methods={methods} onFileReady={handleFileReady} />
                  </Stepper.Step>
                  <Stepper.Step of="map">
                     <MapStep
                        headers={rawData?.headers ?? []}
                        mapping={mapping}
                        methods={methods}
                        onMappingChange={setMapping}
                        onNext={() => {
                           handleMappingNext();
                           methods.next();
                        }}
                     />
                  </Stepper.Step>
                  <Stepper.Step of="preview">
                     <PreviewStep
                        cards={parsedCards}
                        methods={methods}
                        onNext={() => methods.next()}
                     />
                  </Stepper.Step>
                  <Stepper.Step of="importar">
                     <ImportStep cards={parsedCards} onClose={onClose} />
                  </Stepper.Step>
               </CredenzaBody>
            </>
         )}
      </Stepper.Provider>
   );
}
```

**Step 2: Verify the file exists**

```bash
ls apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-credit-cards/credit-cards-import-credenza.tsx
```

Expected: file listed without error.

**Step 3: Commit**

```bash
git add "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-credit-cards/credit-cards-import-credenza.tsx"
git commit -m "feat(credit-cards): add import credenza with CSV/XLSX column mapping"
```

---

### Task 2: Wire Upload button into credit-cards route

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx`

**Step 1: Add Upload import from lucide-react**

In the existing import `{ CreditCard, Download, Pencil, Plus, Trash2 }` from `lucide-react`, add `Upload`.

**Step 2: Add CreditCardsImportCredenza import**

Add after the existing `./-credit-cards/credit-cards-export-credenza` import:
```tsx
import { CreditCardsImportCredenza } from "./-credit-cards/credit-cards-import-credenza";
```

**Step 3: Add handleImport function inside CreditCardsPage**

After the `handleExport` function, add:
```tsx
function handleImport() {
   openCredenza({
      children: <CreditCardsImportCredenza onClose={closeCredenza} />,
   });
}
```

**Step 4: Add Upload button to DefaultHeader actions**

Inside the `<div className="flex gap-2">` in `DefaultHeader actions`, add an Upload button before the Export button:
```tsx
<Button
   variant="outline"
   onClick={handleImport}
   type="button"
>
   <Upload className="size-4" />
   Importar
</Button>
```

**Step 5: Commit**

```bash
git add "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/credit-cards.tsx"
git commit -m "feat(credit-cards): wire import button into DefaultHeader"
```

---

### Task 3: Typecheck and fix errors

**Step 1: Run typecheck**

```bash
npx tsgo --project apps/web/tsconfig.json 2>&1 | grep "error TS" | head -20
```

**Step 2: Fix any errors found**

Common issues to watch for:
- `Stepper.Provider` vs `Stepper` — check actual API from `defineStepper` return. The transaction credenza wraps `<Stepper>` directly as a function child `{({ methods }) => ...}`. Use the same approach.
- `Stepper.Step of="..."` syntax — exact prop name from stepper component.
- `bulkCreate` input types — ensure `creditLimit` matches what the router expects (string vs number).

**Step 3: Commit fixes if any**

```bash
git add -p
git commit -m "fix(credit-cards): fix typecheck errors in import credenza"
```

---

## Key Implementation Notes

### Stepper API
From `packages/ui/src/components/stepper.tsx`, `defineStepper` returns `{ Stepper, useStepper, steps }`. `Stepper` has sub-components. The transaction import credenza uses:
```tsx
const { Stepper, useStepper } = defineStepper(...)
// ...
<Stepper>{({ methods }) => (...)}</Stepper>
```
Note: In the transaction import, `Stepper` itself is the container with a function child. `useStepper()` is used inside child components for step control. Check whether `Stepper.Provider`, `Stepper.Step` etc exist or whether the pattern is different.

### bulkCreate input type
The procedure accepts `cards: Array<{ name, creditLimit, closingDay, dueDay, bankAccountId, status?, brand?, color? }>`. Verify if `creditLimit` is string or number in the schema — adjust the parsed value accordingly.

### No `as` casts
When accessing `mapping` fields that are `Partial<ColumnMapping>`, use type guards or ensure required fields are present before calling `parseCards`. The `canProceed()` check gates the next button, but TypeScript may still complain — use early returns or non-null assertions only if the value was already checked.
