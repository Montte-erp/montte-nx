# Categories Import/Export Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the category import wizard to match the quality of the statement import (real Dropzone, Combobox mapping with sample values, localStorage memory, 4-step flow with StepBar, ConfirmStep); add XLSX export support.

**Architecture:** Extract logic into a `use-category-import.tsx` provider + context (same pattern as `use-statement-import.tsx`), then fully rewrite the credenza UI with isolated step components. XLSX export uses `useXlsxFile` + `useFileDownload` hooks from the categories page.

**Tech Stack:** `@packages/ui/components/dropzone`, `@packages/ui/components/stepper` (`defineStepper`, `useStepper`), `@packages/ui/components/combobox`, `@tanstack/react-virtual`, `foxact/use-local-storage`, `neverthrow`, `useCsvFile`, `useXlsxFile`, `useFileDownload`, `useCredenza`

**Reference files (read before implementing):**
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/use-statement-import.tsx` — provider/context pattern
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-transactions/statement-import-credenza.tsx` — StepBar, UploadStep, MapStep, ConfirmStep patterns
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx` — current (to be replaced)
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/export-categories-csv.ts` — current export
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx` — page component (handleImport/handleExport)
- `apps/web/src/hooks/use-csv-file.ts` — parse returns `{ headers: string[], rows: string[][] }`
- `apps/web/src/hooks/use-xlsx-file.ts` — generate takes `(rows: Record<string, string>[], headers: string[]): Blob`
- `apps/web/src/hooks/use-file-download.ts` — `useFileDownload()` returns `{ download }`

---

## Task 1: Logic layer — use-category-import.tsx

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/use-category-import.tsx`

**Step 1: Create the file with types, constants, pure helpers, context, provider, and hook**

```typescript
import { useCsvFile } from "@/hooks/use-csv-file";
import { fromPromise } from "neverthrow";
import { invariant } from "foxact/invariant";
import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export type RawData = { headers: string[]; rows: string[][] };

export type MappedCategory = {
   name: string;
   type: "income" | "expense" | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   subcategories: { name: string; keywords: string[] | null }[];
   valid: boolean;
};

export type ImportPayloadItem = {
   name: string;
   type: "income" | "expense";
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   subcategories: { name: string }[];
};

// ── Constants ──────────────────────────────────────────────────────────────

export const FIELD_OPTIONS = [
   { value: "__skip__", label: "Ignorar" },
   { value: "name", label: "Nome *" },
   { value: "type", label: "Tipo (receita/despesa)" },
   { value: "color", label: "Cor (hex)" },
   { value: "icon", label: "Ícone" },
   { value: "keywords", label: "Palavras-chave (separadas por ;)" },
   { value: "subcategory", label: "Subcategoria" },
   { value: "subcategoryKeywords", label: "Palavras-chave (Sub)" },
];

export const TEMPLATE_HEADERS = [
   "nome",
   "tipo",
   "cor",
   "icone",
   "palavras-chave",
   "subcategoria",
   "palavras-chave-sub",
] as const;

export const TEMPLATE_ROWS = [
   {
      nome: "Alimentação",
      tipo: "despesa",
      cor: "#ef4444",
      icone: "utensils",
      "palavras-chave": "mercado;restaurante",
      subcategoria: "Supermercado",
      "palavras-chave-sub": "pao;leite",
   },
   {
      nome: "Alimentação",
      tipo: "despesa",
      cor: "#ef4444",
      icone: "utensils",
      "palavras-chave": "mercado;restaurante",
      subcategoria: "Restaurante",
      "palavras-chave-sub": "almoco;jantar",
   },
   {
      nome: "Salário",
      tipo: "receita",
      cor: "#22c55e",
      icone: "wallet",
      "palavras-chave": "salario;pagamento",
      subcategoria: "",
      "palavras-chave-sub": "",
   },
];

// ── Pure helpers ───────────────────────────────────────────────────────────

const MAPPING_PATTERNS: Record<string, RegExp> = {
   name: /^(nome|name|categoria|category)$/i,
   type: /^(tipo|type)$/i,
   color: /^(cor|color)$/i,
   icon: /^(icone|ícone|icon)$/i,
   keywords: /^(palavras?.?chave|keywords?)$/i,
   subcategory: /^(subcategoria|subcategory|sub)$/i,
   subcategoryKeywords: /^(palavras?.?chave.*sub|sub.*keywords?)$/i,
};

function guessMapping(headers: string[]): Record<string, string> {
   const mapping: Record<string, string> = {};
   for (const header of headers) {
      let matched = false;
      for (const [field, regex] of Object.entries(MAPPING_PATTERNS)) {
         if (regex.test(header)) {
            mapping[header] = field;
            matched = true;
            break;
         }
      }
      if (!matched) mapping[header] = "__skip__";
   }
   return mapping;
}

export function getSampleValues(rawData: RawData, header: string): string {
   const idx = rawData.headers.indexOf(header);
   if (idx === -1) return "";
   return rawData.rows
      .slice(0, 3)
      .map((r) => r[idx] ?? "")
      .filter(Boolean)
      .join(", ");
}

function mappingStorageKey(headers: string[]): string {
   return `montte:categories:import:mapping:${[...headers].sort().join(",")}`;
}

function buildMappedCategories(
   rawData: RawData,
   mapping: Record<string, string>,
): MappedCategory[] {
   const getField = (row: string[], field: string): string => {
      const header = rawData.headers.find((h) => mapping[h] === field);
      if (!header) return "";
      const idx = rawData.headers.indexOf(header);
      return (row[idx] ?? "").trim();
   };

   const categoryMap = new Map<string, MappedCategory>();

   for (const row of rawData.rows) {
      const name = getField(row, "name");
      if (!name) continue;

      const typeRaw = getField(row, "type").toLowerCase();
      let type: "income" | "expense" | null = null;
      if (typeRaw === "receita" || typeRaw === "income") type = "income";
      else if (typeRaw === "despesa" || typeRaw === "expense") type = "expense";

      const color = getField(row, "color") || null;
      const icon = getField(row, "icon") || null;
      const keywordsRaw = getField(row, "keywords");
      const keywords = keywordsRaw
         ? keywordsRaw
              .split(/[;,]/)
              .map((k) => k.trim())
              .filter(Boolean)
         : null;

      const subName = getField(row, "subcategory");
      const subKeywordsRaw = getField(row, "subcategoryKeywords");
      const subKeywords = subKeywordsRaw
         ? subKeywordsRaw
              .split(/[;,]/)
              .map((k) => k.trim())
              .filter(Boolean)
         : null;

      if (!categoryMap.has(name)) {
         categoryMap.set(name, {
            name,
            type,
            color,
            icon,
            keywords,
            subcategories: [],
            valid: type !== null,
         });
      }

      if (subName) {
         categoryMap
            .get(name)
            ?.subcategories.push({ name: subName, keywords: subKeywords });
      }
   }

   return Array.from(categoryMap.values());
}

// ── Context ────────────────────────────────────────────────────────────────

type CategoryImportContextValue = {
   rawData: RawData | null;
   mapping: Record<string, string>;
   setMapping: (m: Record<string, string>) => void;
   savedMappingApplied: boolean;
   resetMapping: () => void;
   parseFile: (file: File) => Promise<void>;
   applyColumnMapping: (mapping: Record<string, string>) => void;
   mappedCategories: MappedCategory[];
   buildImportPayload: () => ImportPayloadItem[];
};

const CategoryImportContext = createContext<CategoryImportContextValue | null>(
   null,
);

export function CategoryImportProvider({ children }: { children: ReactNode }) {
   const { parse } = useCsvFile();
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [mapping, setMappingState] = useState<Record<string, string>>({});
   const [savedMappingApplied, setSavedMappingApplied] = useState(false);
   const [mappedCategories, setMappedCategories] = useState<MappedCategory[]>(
      [],
   );

   const parseFile = useCallback(
      async (file: File): Promise<void> => {
         const result = await fromPromise(parse(file), (e) => e);
         if (result.isErr())
            throw new Error("Arquivo CSV inválido ou corrompido.");
         const raw = result.value;
         setRawData(raw);

         const saved = localStorage.getItem(mappingStorageKey(raw.headers));
         if (saved) {
            const parsedMapping: Record<string, string> = JSON.parse(saved);
            setMappingState(parsedMapping);
            setSavedMappingApplied(true);
            return;
         }

         setMappingState(guessMapping(raw.headers));
         setSavedMappingApplied(false);
      },
      [parse],
   );

   const setMapping = useCallback((m: Record<string, string>) => {
      setMappingState(m);
   }, []);

   const applyColumnMapping = useCallback(
      (m: Record<string, string>) => {
         if (!rawData) return;
         localStorage.setItem(mappingStorageKey(rawData.headers), JSON.stringify(m));
         setMappedCategories(buildMappedCategories(rawData, m));
      },
      [rawData],
   );

   const resetMapping = useCallback(() => {
      if (!rawData) return;
      localStorage.removeItem(mappingStorageKey(rawData.headers));
      setSavedMappingApplied(false);
      setMappingState(guessMapping(rawData.headers));
   }, [rawData]);

   const buildImportPayload = useCallback((): ImportPayloadItem[] => {
      return mappedCategories
         .filter((c) => c.valid && (c.type === "income" || c.type === "expense"))
         .map((c) => ({
            name: c.name,
            type: c.type as "income" | "expense",
            color: c.color,
            icon: c.icon,
            keywords: c.keywords,
            subcategories: c.subcategories.map((s) => ({ name: s.name })),
         }));
   }, [mappedCategories]);

   return (
      <CategoryImportContext
         value={{
            rawData,
            mapping,
            setMapping,
            savedMappingApplied,
            resetMapping,
            parseFile,
            applyColumnMapping,
            mappedCategories,
            buildImportPayload,
         }}
      >
         {children}
      </CategoryImportContext>
   );
}

export function useCategoryImportContext(): CategoryImportContextValue {
   const ctx = useContext(CategoryImportContext);
   invariant(ctx, "useCategoryImportContext must be used inside CategoryImportProvider");
   return ctx;
}
```

**Step 2: Verify the file compiles**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "use-category-import"
```

Expected: no errors about this file.

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/use-category-import.tsx
git commit -m "feat(categories): add CategoryImportProvider context with logic layer"
```

---

## Task 2: Rewrite category-import-credenza.tsx

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx`

This file is a complete replacement. The current file has 3 steps (upload/mapping/preview) with fake drag-drop, numbered circles, Select (not Combobox), and no ConfirmStep. Replace entirely.

**Step 1: Replace the file with the new implementation**

```typescript
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxIndicator,
   ChoiceboxItem,
   ChoiceboxItemDescription,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
} from "@packages/ui/components/choicebox";
import { Combobox } from "@packages/ui/components/combobox";
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
import { Spinner } from "@packages/ui/components/spinner";
import { Badge } from "@packages/ui/components/badge";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { defineStepper } from "@packages/ui/components/stepper";
import { useMutation } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, CheckCircle2, ChevronRight, FileSpreadsheet, Loader2, Undo2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useFileDownload } from "@/hooks/use-file-download";
import {
   CategoryImportProvider,
   FIELD_OPTIONS,
   TEMPLATE_HEADERS,
   TEMPLATE_ROWS,
   getSampleValues,
   useCategoryImportContext,
} from "./use-category-import";

// ── Stepper definition ─────────────────────────────────────────────────────

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type StepperMethods = ReturnType<typeof useStepper>;

// ── StepBar ────────────────────────────────────────────────────────────────

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

// ── Template download credenza ─────────────────────────────────────────────

const TEMPLATE_OPTIONS = [
   {
      value: "csv" as const,
      label: "CSV",
      description: "Compatível com qualquer planilha ou editor de texto",
      icon: FileSpreadsheet,
      iconClass: "text-emerald-600",
      filename: "modelo-categorias.csv",
   },
   {
      value: "xlsx" as const,
      label: "XLSX",
      description: "Excel e Google Sheets — com formatação de colunas",
      icon: FileSpreadsheet,
      iconClass: "text-green-600",
      filename: "modelo-categorias.xlsx",
   },
] as const;

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
               {TEMPLATE_OPTIONS.map(({ value, label, description, icon: Icon, iconClass, filename }) => (
                  <ChoiceboxItem key={value} value={value} id={`template-${value}`}>
                     <ChoiceboxIndicator id={`template-${value}`} className="sr-only" />
                     <button
                        type="button"
                        className="flex flex-col gap-2 w-full cursor-pointer"
                        onClick={() => {
                           download(
                              generators[value].generate(
                                 TEMPLATE_ROWS as Record<string, string>[],
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
                           <ChoiceboxItemDescription>{description}</ChoiceboxItemDescription>
                        </ChoiceboxItemHeader>
                     </button>
                  </ChoiceboxItem>
               ))}
            </Choicebox>
         </CredenzaBody>
      </>
   );
}

// ── UploadStep ─────────────────────────────────────────────────────────────

function UploadStep({ methods }: { methods: StepperMethods }) {
   const { parseFile } = useCategoryImportContext();
   const [isPending, startTransition] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { openCredenza, closeCredenza } = useCredenza();

   function handleFile(file: File) {
      setSelectedFile(file);
      startTransition(async () => {
         const result = await fromPromise(parseFile(file), (e) => e);
         if (result.isErr()) {
            toast.error("Arquivo CSV inválido ou corrompido.");
            setSelectedFile(undefined);
            return;
         }
         methods.navigation.next();
      });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar Categorias</CredenzaTitle>
            <CredenzaDescription>
               Envie um arquivo CSV com suas categorias e subcategorias
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <Dropzone
                  accept={{ "text/csv": [".csv"] }}
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
                        renderChildren: () => (
                           <TemplateCredenza onClose={closeCredenza} />
                        ),
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

// ── MapStep ────────────────────────────────────────────────────────────────

function MapStep({ methods }: { methods: StepperMethods }) {
   const {
      rawData,
      mapping,
      setMapping,
      savedMappingApplied,
      resetMapping,
      applyColumnMapping,
   } = useCategoryImportContext();

   if (!rawData) return null;

   const canProceed = Object.values(mapping).some((v) => v === "name");

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
                        className="text-xs text-muted-foreground h-auto py-0 px-1 gap-1"
                        onClick={resetMapping}
                     >
                        <Undo2 className="size-3" />
                        Redefinir
                     </Button>
                  </div>
               )}

               <div className="flex flex-col gap-2">
                  <div className="grid grid-cols-[10rem_1fr] items-center gap-2 px-1 pb-1">
                     <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Campo
                     </span>
                     <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Coluna do arquivo
                     </span>
                  </div>
                  {rawData.headers.map((header) => {
                     const sample = getSampleValues(rawData, header);
                     return (
                        <div
                           className="grid grid-cols-[10rem_1fr] items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2 overflow-hidden"
                           key={header}
                        >
                           <div className="flex flex-col gap-1 pt-1">
                              <span className="text-sm font-medium truncate">{header}</span>
                              {sample && (
                                 <p className="text-xs text-muted-foreground truncate">
                                    {sample}
                                 </p>
                              )}
                           </div>
                           <Combobox
                              options={FIELD_OPTIONS}
                              onValueChange={(v) =>
                                 setMapping({ ...mapping, [header]: v })
                              }
                              value={mapping[header] ?? "__skip__"}
                           />
                        </div>
                     );
                  })}
               </div>

               <p className="text-xs text-muted-foreground">
                  {rawData.rows.length} linha(s) · {rawData.headers.length} colunas detectadas
               </p>

               <div className="flex gap-2">
                  <Button
                     className="flex-none"
                     onClick={() => methods.navigation.prev()}
                     type="button"
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={!canProceed}
                     onClick={handleNext}
                     type="button"
                  >
                     <span className="flex items-center gap-2">
                        Continuar
                        <ChevronRight className="size-4" />
                     </span>
                  </Button>
               </div>
            </div>
         </CredenzaBody>
      </>
   );
}

// ── PreviewStep ────────────────────────────────────────────────────────────

function PreviewStep({ methods }: { methods: StepperMethods }) {
   const { mappedCategories } = useCategoryImportContext();
   const previewRef = useRef<HTMLDivElement>(null);

   const validCount = mappedCategories.filter((c) => c.valid).length;
   const invalidCount = mappedCategories.filter((c) => !c.valid).length;

   const rowVirtualizer = useVirtualizer({
      count: mappedCategories.length,
      getScrollElement: () => previewRef.current,
      estimateSize: () => 56,
      overscan: 8,
   });

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Revisão</CredenzaTitle>
            <CredenzaDescription>
               {validCount} {validCount === 1 ? "categoria será importada" : "categorias serão importadas"}
               {invalidCount > 0 && ` — ${invalidCount} inválida(s) serão ignoradas`}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="h-56 overflow-auto" ref={previewRef}>
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead>Nome</TableHead>
                           <TableHead>Tipo</TableHead>
                           <TableHead>Subcategorias</TableHead>
                           <TableHead className="w-8" />
                        </TableRow>
                     </TableHeader>
                     <TableBody
                        style={{
                           height: `${rowVirtualizer.getTotalSize()}px`,
                           position: "relative",
                           display: "block",
                        }}
                     >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                           const cat = mappedCategories[virtualRow.index];
                           if (!cat) return null;
                           return (
                              <TableRow
                                 key={cat.name}
                                 style={{
                                    position: "absolute",
                                    top: 0,
                                    width: "100%",
                                    transform: `translateY(${virtualRow.start}px)`,
                                    display: "table",
                                    tableLayout: "fixed",
                                 }}
                              >
                                 <TableCell className="font-medium truncate">
                                    {cat.name}
                                 </TableCell>
                                 <TableCell>
                                    {cat.type === "income" ? (
                                       <Badge className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500" variant="outline">
                                          Receita
                                       </Badge>
                                    ) : cat.type === "expense" ? (
                                       <Badge variant="destructive">Despesa</Badge>
                                    ) : (
                                       <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                 </TableCell>
                                 <TableCell>
                                    {cat.subcategories.length > 0 ? (
                                       <Badge variant="secondary">{cat.subcategories.length}</Badge>
                                    ) : (
                                       <span className="text-sm text-muted-foreground">—</span>
                                    )}
                                 </TableCell>
                                 <TableCell>
                                    {cat.valid ? (
                                       <CheckCircle2 className="size-4 text-green-600" />
                                    ) : (
                                       <AlertCircle className="size-4 text-destructive" />
                                    )}
                                 </TableCell>
                              </TableRow>
                           );
                        })}
                     </TableBody>
                  </Table>
               </div>

               <div className="flex gap-2">
                  <Button
                     className="flex-none"
                     onClick={() => methods.navigation.prev()}
                     type="button"
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={validCount === 0}
                     onClick={() => methods.navigation.next()}
                     type="button"
                  >
                     <span className="flex items-center gap-2">
                        Continuar
                        <ChevronRight className="size-4" />
                     </span>
                  </Button>
               </div>
            </div>
         </CredenzaBody>
      </>
   );
}

// ── ConfirmStep ────────────────────────────────────────────────────────────

function ConfirmStep({
   methods,
   onSuccess,
}: {
   methods: StepperMethods;
   onSuccess: () => void;
}) {
   const { mappedCategories, buildImportPayload } = useCategoryImportContext();

   const validCount = mappedCategories.filter((c) => c.valid).length;
   const invalidCount = mappedCategories.filter((c) => !c.valid).length;

   const importMutation = useMutation(
      orpc.categories.importBatch.mutationOptions({
         onSuccess: () => {
            toast.success("Categorias importadas com sucesso.");
            onSuccess();
         },
         onError: (e) => {
            toast.error(e.message || "Erro ao importar categorias.");
         },
      }),
   );

   function handleImport() {
      importMutation.mutate({ categories: buildImportPayload() });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Tudo certo?</CredenzaTitle>
            <CredenzaDescription>
               Confira o resumo e clique em importar quando estiver pronto
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="rounded-xl border overflow-hidden">
                  <div className="divide-y">
                     <div className="flex items-center justify-between px-4 py-2">
                        <span className="text-sm text-muted-foreground">
                           Total no arquivo
                        </span>
                        <span className="text-sm font-medium">
                           {mappedCategories.length}
                        </span>
                     </div>
                     {invalidCount > 0 && (
                        <div className="flex items-center justify-between px-4 py-2">
                           <span className="text-sm text-muted-foreground">
                              Com erro (ignoradas)
                           </span>
                           <Badge variant="destructive">{invalidCount}</Badge>
                        </div>
                     )}
                     <div className="flex items-center justify-between bg-primary/5 px-4 py-2">
                        <span className="text-sm font-medium">
                           Serão importadas
                        </span>
                        <span className="text-sm font-bold text-primary">
                           {validCount}
                        </span>
                     </div>
                  </div>
               </div>

               <div className="flex gap-2">
                  <Button
                     className="flex-none"
                     disabled={importMutation.isPending}
                     onClick={() => methods.navigation.prev()}
                     type="button"
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={importMutation.isPending || validCount === 0}
                     onClick={handleImport}
                     type="button"
                  >
                     <span className="flex items-center gap-2">
                        {importMutation.isPending && (
                           <Loader2 className="size-4 animate-spin" />
                        )}
                        Importar {validCount} {validCount === 1 ? "categoria" : "categorias"}
                     </span>
                  </Button>
               </div>
            </div>
         </CredenzaBody>
      </>
   );
}

// ── Root component ─────────────────────────────────────────────────────────

function ImportWizard({
   methods,
   onSuccess,
}: {
   methods: StepperMethods;
   onSuccess: () => void;
}) {
   const currentId = methods.state.current.data.id;

   return (
      <>
         {currentId === "upload" && <UploadStep methods={methods} />}
         {currentId === "map" && <MapStep methods={methods} />}
         {currentId === "preview" && <PreviewStep methods={methods} />}
         {currentId === "confirm" && (
            <ConfirmStep methods={methods} onSuccess={onSuccess} />
         )}
      </>
   );
}

interface CategoryImportCredenzaProps {
   onSuccess: () => void;
}

export function CategoryImportCredenza({
   onSuccess,
}: CategoryImportCredenzaProps) {
   return (
      <CategoryImportProvider>
         <Stepper.Provider variant="line">
            {({ methods }) => (
               <ImportWizard methods={methods} onSuccess={onSuccess} />
            )}
         </Stepper.Provider>
      </CategoryImportProvider>
   );
}
```

**Step 2: Check for type errors**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "category-import"
```

Expected: no errors.

**Step 3: Check the Dropzone component API**

Before implementing, verify that `Dropzone` from `@packages/ui/components/dropzone` accepts `accept`, `disabled`, `maxFiles`, `onDrop`, and `src` props — look at the statement-import-credenza.tsx for the exact prop names (lines 273-321). If props differ, adjust accordingly.

Also verify that `Choicebox`, `ChoiceboxItem`, `ChoiceboxIndicator`, `ChoiceboxItemHeader`, `ChoiceboxItemTitle`, `ChoiceboxItemDescription` are exported from `@packages/ui/components/choicebox`.

**Step 4: Fix any TypeScript errors**

Run typecheck, fix any import or prop mismatches. Common issues:
- `Stepper.Provider` may not accept `variant` prop — remove if it causes an error
- `CredenzaFooter` may not be needed (footer buttons are inside `CredenzaBody` per statement import pattern)

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/category-import-credenza.tsx
git commit -m "feat(categories): rewrite import credenza — 4 steps, StepBar, Dropzone, Combobox mapping"
```

---

## Task 3: XLSX export support

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

The export currently calls `exportCategoriesCsv()` directly in `handleExport`. We need to add an XLSX option.

**Step 1: Add `useXlsxFile` and `useFileDownload` hooks and `handleExportXlsx` to the `CategoriesPage` component**

In `categories.tsx`, find `CategoriesPage` (the outermost component that renders the page). It currently has `handleExport` using `exportCategoriesCsv`. Add XLSX export alongside it.

```typescript
// Add to imports at top of file:
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useFileDownload } from "@/hooks/use-file-download";

// Inside CategoriesPage function body, alongside handleExport:
const { generate: generateXlsx } = useXlsxFile();
const { download } = useFileDownload();

const handleExportXlsx = useCallback(async () => {
   const result = await fromPromise(
      orpc.categories.exportAll.call({}),
      (e) => e,
   );
   if (result.isErr()) {
      toast.error("Erro ao exportar categorias.");
      return;
   }

   const categories = result.value;
   const parents = categories.filter((c) => c.parentId === null);
   const rows: Record<string, string>[] = [];

   for (const parent of parents) {
      const subs = categories.filter((c) => c.parentId === parent.id);
      const typeLabel =
         parent.type === "income"
            ? "Receita"
            : parent.type === "expense"
              ? "Despesa"
              : "";

      if (subs.length === 0) {
         rows.push({
            Nome: parent.name,
            Tipo: typeLabel,
            Cor: parent.color ?? "",
            Ícone: parent.icon ?? "",
            "Palavras-chave": parent.keywords?.join("; ") ?? "",
            Subcategoria: "",
            "Palavras-chave-Sub": "",
         });
      } else {
         for (const sub of subs) {
            rows.push({
               Nome: parent.name,
               Tipo: typeLabel,
               Cor: parent.color ?? "",
               Ícone: parent.icon ?? "",
               "Palavras-chave": parent.keywords?.join("; ") ?? "",
               Subcategoria: sub.name,
               "Palavras-chave-Sub": sub.keywords?.join("; ") ?? "",
            });
         }
      }
   }

   const headers = ["Nome", "Tipo", "Cor", "Ícone", "Palavras-chave", "Subcategoria", "Palavras-chave-Sub"];
   const blob = generateXlsx(rows, headers);
   download(blob, "categorias.xlsx");
   toast.success("Categorias exportadas com sucesso.");
}, [generateXlsx, download]);
```

**Step 2: Update the dropdown in the JSX**

Find the DropdownMenuContent section (around line 713-722) and update it:

```tsx
<DropdownMenuContent align="end">
   <DropdownMenuItem onClick={handleImport}>
      <Upload />
      Importar CSV
   </DropdownMenuItem>
   <DropdownMenuItem onClick={handleExport}>
      <Download />
      Exportar CSV
   </DropdownMenuItem>
   <DropdownMenuItem onClick={handleExportXlsx}>
      <Download />
      Exportar XLSX
   </DropdownMenuItem>
</DropdownMenuContent>
```

**Step 3: Verify types compile**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep "categories.tsx"
```

Expected: no errors.

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): add XLSX export option to dropdown"
```

---

## Verification

After all tasks:

1. Open the categories page in the browser
2. Click the `...` menu → "Importar CSV"
3. Verify:
   - Dropzone shows (real drag-drop, not fake `<label>`)
   - "Baixar modelo" link works → opens TemplateCredenza with CSV/XLSX choice
   - Uploading a CSV advances to MapStep with colored StepBar
   - Each header has a Combobox with FIELD_OPTIONS
   - Sample values visible below each header
   - "Continuar" advances to PreviewStep with virtualized table
   - Invalid rows show AlertCircle, valid rows show CheckCircle2
   - "Continuar" advances to ConfirmStep with summary panel
   - "Importar N categorias" triggers mutation and closes credenza on success
   - Uploading same file a second time re-applies saved mapping (shows "Mapeamento anterior aplicado")
4. Click "Exportar CSV" → downloads CSV file
5. Click "Exportar XLSX" → downloads XLSX file
