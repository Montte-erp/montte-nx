import { generateFromObjects } from "@f-o-t/csv";
import {
   of as moneyOf,
   format as moneyFormat,
   add as moneyAdd,
   zero as moneyZero,
} from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { defineStepper } from "@packages/ui/components/stepper";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import {
   useSelectionToolbar,
   SelectionActionButton,
} from "@/hooks/use-selection-toolbar";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs from "dayjs";
import {
   AlertTriangle,
   ChevronRight,
   Download,
   FileSpreadsheet,
   FileText,
   Loader2,
   Table2,
   X,
} from "lucide-react";
import { useDebouncedState } from "foxact/use-debounced-state";
import { Suspense, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import {
   type ColumnMapping,
   type FileFormat,
   type RawData,
   type ValidatedRow,
   COLUMN_FIELDS,
   FIELD_LABELS,
   REQUIRED_FIELDS,
   getSampleValues,
   parseAmount,
   parseDate,
   useStatementImport,
} from "./use-statement-import";

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type StepperMethods = ReturnType<typeof useStepper>;

function formatMoney(value: string): string {
   const normalized = parseAmount(value) ?? value;
   try {
      return moneyFormat(moneyOf(normalized, "BRL"), "pt-BR");
   } catch {
      return value;
   }
}

const TEMPLATE_ROWS = [
   {
      data: "15/01/2024",
      nome: "Pagamento fornecedor",
      tipo: "despesa",
      valor: "1500.00",
      descricao: "NF 123",
   },
   {
      data: "20/01/2024",
      nome: "Recebimento cliente",
      tipo: "receita",
      valor: "3200.00",
      descricao: "Fatura 456",
   },
];

const TEMPLATE_HEADERS = [
   "data",
   "nome",
   "tipo",
   "valor",
   "descricao",
] as const;

function triggerDownload(blob: Blob, filename: string) {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

function TemplateCredenza({ onClose }: { onClose?: () => void }) {
   function downloadCsv() {
      const csv = generateFromObjects(TEMPLATE_ROWS, {
         headers: [...TEMPLATE_HEADERS],
      });
      triggerDownload(
         new Blob([csv], { type: "text/csv;charset=utf-8;" }),
         "modelo-importacao.csv",
      );
   }

   function downloadXlsx() {
      const ws = xlsxUtils.json_to_sheet(TEMPLATE_ROWS, {
         header: [...TEMPLATE_HEADERS],
      });
      const wb = xlsxUtils.book_new();
      xlsxUtils.book_append_sheet(wb, ws, "Modelo");
      const data = xlsxWrite(wb, { type: "array", bookType: "xlsx" });
      triggerDownload(
         new Blob([data], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
         }),
         "modelo-importacao.xlsx",
      );
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Baixar modelo</CredenzaTitle>
            <CredenzaDescription>
               Use como referência para formatar seu arquivo antes de importar
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col gap-2">
               <button
                  type="button"
                  className="flex items-center gap-4 rounded-lg border bg-muted/20 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => {
                     downloadCsv();
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
               </button>
               <button
                  type="button"
                  className="flex items-center gap-4 rounded-lg border bg-muted/20 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  onClick={() => {
                     downloadXlsx();
                     onClose?.();
                  }}
               >
                  <Table2 className="size-5 text-green-600 shrink-0" />
                  <div className="flex flex-col gap-0.5 flex-1">
                     <span className="text-sm font-medium">XLSX</span>
                     <span className="text-xs text-muted-foreground">
                        Excel e Google Sheets — com formatação de colunas
                     </span>
                  </div>
                  <Download className="size-4 text-muted-foreground shrink-0" />
               </button>
            </div>
         </CredenzaBody>
      </>
   );
}

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

interface UploadStepProps {
   methods: StepperMethods;
   parseFile: (file: File) => Promise<void>;
   bankAccountId: string;
   onBankAccountChange: (id: string) => void;
}

function UploadStep({
   methods,
   parseFile,
   bankAccountId,
   onBankAccountChange,
}: UploadStepProps) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { openCredenza, closeCredenza } = useCredenza();
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   async function handleFile(file: File) {
      if (!bankAccountId) return;
      setSelectedFile(file);
      setIsParsing(true);
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
      } finally {
         setIsParsing(false);
      }
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar extrato</CredenzaTitle>
            <CredenzaDescription>
               Selecione a conta e envie o arquivo do seu banco
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Conta bancária</span>
                  <Combobox
                     emptyMessage="Nenhuma conta encontrada."
                     onValueChange={onBankAccountChange}
                     options={bankAccounts.map((a) => ({
                        value: a.id,
                        label: a.name,
                     }))}
                     placeholder="Selecionar conta..."
                     searchPlaceholder="Buscar conta..."
                     value={bankAccountId}
                  />
               </div>

               <Dropzone
                  accept={{
                     "text/csv": [".csv"],
                     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                        [".xlsx"],
                     "application/vnd.ms-excel": [".xls"],
                     "application/x-ofx": [".ofx"],
                  }}
                  disabled={isParsing || !bankAccountId}
                  maxFiles={1}
                  onDrop={([file]) => {
                     if (file) void handleFile(file);
                  }}
                  src={selectedFile ? [selectedFile] : undefined}
               >
                  <DropzoneEmptyState>
                     {isParsing ? (
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
                                 <span className="text-xs font-medium">
                                    CSV
                                 </span>
                              </div>
                              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                                 <FileSpreadsheet className="size-3.5 text-green-600" />
                                 <span className="text-xs font-medium">
                                    XLSX
                                 </span>
                              </div>
                              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                                 <FileText className="size-3.5 text-blue-600" />
                                 <span className="text-xs font-medium">
                                    OFX
                                 </span>
                              </div>
                           </div>
                        </>
                     )}
                  </DropzoneEmptyState>
                  <DropzoneContent />
               </Dropzone>

               <button
                  type="button"
                  className="text-xs text-muted-foreground underline underline-offset-2 self-start"
                  onClick={() =>
                     openCredenza({
                        children: <TemplateCredenza onClose={closeCredenza} />,
                     })
                  }
               >
                  Baixar modelo
               </button>
            </div>
         </CredenzaBody>
      </>
   );
}

interface MapStepProps {
   methods: StepperMethods;
   raw: RawData;
   mapping: ColumnMapping;
   savedMappingApplied: boolean;
   onMappingChange: (m: ColumnMapping) => void;
   onApplyColumnMapping: (m: ColumnMapping) => Promise<void>;
   onDismissSavedMapping: () => void;
}

function MapStep({
   methods,
   raw,
   mapping,
   savedMappingApplied,
   onMappingChange,
   onApplyColumnMapping,
   onDismissSavedMapping,
}: MapStepProps) {
   const canProceed = REQUIRED_FIELDS.every((f) => mapping[f] !== "");

   async function handleNext() {
      await onApplyColumnMapping(mapping);
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
                     <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={onDismissSavedMapping}
                     >
                        Redefinir
                     </button>
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
                  {COLUMN_FIELDS.map((field) => {
                     const sample = mapping[field]
                        ? getSampleValues(raw, mapping[field])
                        : null;
                     return (
                        <div
                           className="grid grid-cols-[10rem_1fr] items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 overflow-hidden"
                           key={field}
                        >
                           <div className="flex flex-col gap-0.5 pt-1">
                              <span className="text-sm font-medium">
                                 {FIELD_LABELS[field]}
                              </span>
                           </div>
                           <div className="flex flex-col gap-1 min-w-0">
                              <Combobox
                                 options={[
                                    {
                                       value: "__none__",
                                       label: "— Não mapear —",
                                    },
                                    ...raw.headers.map((h) => ({
                                       value: h,
                                       label: h,
                                    })),
                                 ]}
                                 onValueChange={(v) =>
                                    onMappingChange({
                                       ...mapping,
                                       [field]: v === "__none__" ? "" : v,
                                    })
                                 }
                                 value={mapping[field] || "__none__"}
                              />
                              {sample && (
                                 <p className="text-xs text-muted-foreground px-1 truncate">
                                    {sample}
                                 </p>
                              )}
                           </div>
                        </div>
                     );
                  })}
               </div>

               <p className="text-xs text-muted-foreground">
                  {raw.rows.length} linha(s) · {raw.headers.length} colunas
                  detectadas
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

interface PreviewStepProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
   duplicateFlags: boolean[];
   format: FileFormat;
   onRowsChange: (rows: ValidatedRow[]) => void;
   onSelectionReady: (indices: Set<number>) => void;
}

function PreviewStep({
   methods,
   rows,
   duplicateFlags,
   format,
   onRowsChange,
   onSelectionReady,
}: PreviewStepProps) {
   const [filterDuplicates, setFilterDuplicates] = useState(false);
   const [editingDescIdx, setEditingDescIdx] = useState<number | null>(null);
   const [editingDescValue, setEditingDescValue] = useState("");
   const [bulkDate, , setBulkDate] = useDebouncedState<Date | undefined>(
      undefined,
      300,
   );
   const [bulkCategoryId, , setBulkCategoryId] = useDebouncedState("", 300);

   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

   const categoryOptions = categories.map((c) => ({
      value: c.id,
      label: c.name,
   }));

   const {
      selectedIndices,
      toggle: toggleRow,
      remove: removeIndex,
      clear: clearIndices,
      replace: replaceIndices,
   } = useSelectionToolbar(({ selectedIndices: _sel, clear: _clearSel }) => (
      <>
         <Popover>
            <PopoverTrigger asChild>
               <SelectionActionButton>Alterar data</SelectionActionButton>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center" side="top">
               <DatePicker
                  date={bulkDate}
                  onSelect={(d) => {
                     if (d) applyBulkDate(d);
                  }}
                  placeholder="Selecionar data"
               />
            </PopoverContent>
         </Popover>
         <Popover>
            <PopoverTrigger asChild>
               <SelectionActionButton>Alterar categoria</SelectionActionButton>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="center" side="top">
               <Combobox
                  options={categoryOptions}
                  onValueChange={(v) => {
                     if (v) {
                        applyBulkCategory(v);
                        setBulkCategoryId("");
                     }
                  }}
                  value={bulkCategoryId}
                  placeholder="Alterar categoria"
                  searchPlaceholder="Buscar categoria..."
                  emptyMessage="Nenhuma categoria"
                  className="w-full"
               />
            </PopoverContent>
         </Popover>
      </>
   ));

   const validCount = rows.filter((r) => r.isValid).length;

   const totalIncome = rows
      .filter((r) => r.isValid && r.type === "income")
      .reduce((sum, r) => {
         try {
            return moneyAdd(sum, moneyOf(parseAmount(r.amount) ?? "0", "BRL"));
         } catch {
            return sum;
         }
      }, moneyZero("BRL"));
   const totalExpense = rows
      .filter((r) => r.isValid && r.type === "expense")
      .reduce((sum, r) => {
         try {
            return moneyAdd(sum, moneyOf(parseAmount(r.amount) ?? "0", "BRL"));
         } catch {
            return sum;
         }
      }, moneyZero("BRL"));

   const validDates = rows
      .filter((r) => r.isValid)
      .map((r) => parseDate(r.date))
      .filter((d): d is string => d !== null);
   const minDate = validDates.length
      ? validDates.reduce((a, b) => (a < b ? a : b))
      : null;
   const maxDate = validDates.length
      ? validDates.reduce((a, b) => (a > b ? a : b))
      : null;

   const displayRows = filterDuplicates
      ? rows
           .map((r, i) => ({ row: r, originalIndex: i }))
           .filter(({ originalIndex }) => duplicateFlags[originalIndex])
      : rows.map((r, i) => ({ row: r, originalIndex: i }));

   const parentRef = useRef<HTMLDivElement>(null);
   const virtualizer = useVirtualizer({
      count: displayRows.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 40,
      overscan: 8,
   });

   const selectableIndices = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.isValid)
      .map(({ i }) => i);

   const allSelected =
      selectableIndices.length > 0 &&
      selectableIndices.every((i) => selectedIndices.has(i));
   const someSelected = selectableIndices.some((i) => selectedIndices.has(i));
   const isIndeterminate = someSelected && !allSelected;

   function toggleSelectAll() {
      if (allSelected) {
         clearIndices();
         return;
      }
      replaceIndices(new Set(selectableIndices));
   }

   function ignoreRow(index: number) {
      removeIndex(index);
   }

   function applyBulkDate(date: Date) {
      const dateStr = dayjs(date).format("YYYY-MM-DD");
      const updated = rows.map((r, i) =>
         selectedIndices.has(i) ? { ...r, date: dateStr } : r,
      );
      onRowsChange(updated);
      setBulkDate(undefined);
   }

   function applyBulkCategory(categoryId: string) {
      const updated = rows.map((r, i) =>
         selectedIndices.has(i) ? { ...r, categoryId } : r,
      );
      onRowsChange(updated);
      setBulkCategoryId("");
   }

   function commitDescEdit(originalIndex: number) {
      if (editingDescIdx === null) return;
      const updated = rows.map((r, i) =>
         i === originalIndex ? { ...r, description: editingDescValue } : r,
      );
      onRowsChange(updated);
      setEditingDescIdx(null);
   }

   const canEditDesc = format !== "ofx";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Revise as transações</CredenzaTitle>
            <CredenzaDescription>
               Desmarque o que não deseja importar — duplicatas já estão
               desmarcadas
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                     <span className="text-xs text-muted-foreground">
                        Entradas
                     </span>
                     <span className="text-xs font-semibold text-emerald-600">
                        {moneyFormat(totalIncome, "pt-BR")}
                     </span>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                     <span className="text-xs text-muted-foreground">
                        Saídas
                     </span>
                     <span className="text-xs font-semibold text-destructive">
                        {moneyFormat(totalExpense, "pt-BR")}
                     </span>
                  </div>
                  {minDate && maxDate ? (
                     <p className="text-xs text-muted-foreground">
                        {dayjs(minDate).format("DD/MM/YYYY")} –{" "}
                        {dayjs(maxDate).format("DD/MM/YYYY")}
                     </p>
                  ) : null}
               </div>

               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <Checkbox
                        checked={
                           isIndeterminate ? "indeterminate" : allSelected
                        }
                        onCheckedChange={toggleSelectAll}
                        id="select-all"
                     />
                     <label
                        htmlFor="select-all"
                        className="text-xs text-muted-foreground cursor-pointer"
                     >
                        Selecionar todas válidas
                     </label>
                  </div>
                  <div className="flex items-center gap-2">
                     <button
                        type="button"
                        onClick={() => setFilterDuplicates(false)}
                        className={[
                           "rounded-full px-3 py-1 text-xs transition-colors",
                           !filterDuplicates
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                        ].join(" ")}
                     >
                        Todas
                     </button>
                     <button
                        type="button"
                        onClick={() => setFilterDuplicates(true)}
                        className={[
                           "rounded-full px-3 py-1 text-xs transition-colors",
                           filterDuplicates
                              ? "bg-yellow-500 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80",
                        ].join(" ")}
                     >
                        Duplicatas
                     </button>
                  </div>
               </div>

               <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-[2rem_6rem_1fr_4rem_6rem_5.5rem_2rem] items-center gap-2 border-b bg-muted/50 px-3 py-2">
                     <span />
                     <span className="text-xs font-medium text-muted-foreground">
                        Data
                     </span>
                     <span className="text-xs font-medium text-muted-foreground">
                        {canEditDesc
                           ? "Descrição (clique para editar)"
                           : "Descrição"}
                     </span>
                     <span className="text-xs font-medium text-muted-foreground">
                        Tipo
                     </span>
                     <span className="text-xs font-medium text-muted-foreground">
                        Categoria
                     </span>
                     <span className="text-xs font-medium text-muted-foreground text-right">
                        Valor
                     </span>
                     <span />
                  </div>
                  <div ref={parentRef} className="h-56 overflow-auto">
                     <div
                        style={{
                           height: virtualizer.getTotalSize(),
                           position: "relative",
                        }}
                     >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                           const { row, originalIndex } =
                              displayRows[virtualRow.index];
                           const isDuplicate = duplicateFlags[originalIndex];
                           const isSelected =
                              selectedIndices.has(originalIndex);
                           const isEditingDesc =
                              editingDescIdx === originalIndex;
                           const rowEl = (
                              <div
                                 key={
                                    row.isValid
                                       ? `prev-${originalIndex + 1}`
                                       : undefined
                                 }
                                 data-index={virtualRow.index}
                                 ref={(el) => {
                                    if (el) virtualizer.measureElement(el);
                                 }}
                                 style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    transform: `translateY(${virtualRow.start}px)`,
                                 }}
                                 className={[
                                    "grid grid-cols-[2rem_6rem_1fr_4rem_6rem_5.5rem_2rem] items-center gap-2 border-b px-3 h-10",
                                    !row.isValid ? "opacity-40" : "",
                                    isDuplicate && row.isValid
                                       ? "border-l-2 border-yellow-400"
                                       : "",
                                    isSelected ? "bg-primary/5" : "",
                                 ]
                                    .filter(Boolean)
                                    .join(" ")}
                              >
                                 <Checkbox
                                    checked={isSelected}
                                    disabled={!row.isValid}
                                    onCheckedChange={() => {
                                       if (row.isValid)
                                          toggleRow(originalIndex);
                                    }}
                                 />
                                 <span className="text-xs tabular-nums">
                                    {parseDate(row.date)
                                       ? dayjs(parseDate(row.date)).format(
                                            "DD/MM/YYYY",
                                         )
                                       : row.date || "—"}
                                 </span>
                                 {canEditDesc &&
                                 row.isValid &&
                                 isEditingDesc ? (
                                    <input
                                       autoFocus
                                       className="text-xs border rounded px-1 py-0.5 w-full bg-background"
                                       value={editingDescValue}
                                       onChange={(e) =>
                                          setEditingDescValue(e.target.value)
                                       }
                                       onBlur={() =>
                                          commitDescEdit(originalIndex)
                                       }
                                       onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                             commitDescEdit(originalIndex);
                                          if (e.key === "Escape")
                                             setEditingDescIdx(null);
                                       }}
                                       onClick={(e) => e.stopPropagation()}
                                    />
                                 ) : (
                                    <TooltipProvider>
                                       <Tooltip
                                          disableHoverableContent={!row.isValid}
                                       >
                                          <TooltipTrigger asChild>
                                             <span
                                                className={[
                                                   "text-xs truncate",
                                                   canEditDesc && row.isValid
                                                      ? "cursor-text hover:underline hover:decoration-dotted"
                                                      : "",
                                                ].join(" ")}
                                                onClick={(e) => {
                                                   if (
                                                      !canEditDesc ||
                                                      !row.isValid
                                                   )
                                                      return;
                                                   e.stopPropagation();
                                                   setEditingDescIdx(
                                                      originalIndex,
                                                   );
                                                   setEditingDescValue(
                                                      row.description ||
                                                         row.name ||
                                                         "",
                                                   );
                                                }}
                                             >
                                                {row.description ||
                                                   row.name ||
                                                   "—"}
                                             </span>
                                          </TooltipTrigger>
                                          {(row.description || row.name) &&
                                          row.isValid ? (
                                             <TooltipContent side="top">
                                                <p className="max-w-xs">
                                                   {row.description || row.name}
                                                </p>
                                             </TooltipContent>
                                          ) : null}
                                       </Tooltip>
                                    </TooltipProvider>
                                 )}
                                 <Badge
                                    variant={
                                       row.type === "income"
                                          ? "success"
                                          : "destructive"
                                    }
                                    className="text-[10px] px-1.5 py-0"
                                 >
                                    {row.type === "income"
                                       ? "Entrada"
                                       : "Saída"}
                                 </Badge>
                                 <span className="text-xs text-muted-foreground truncate">
                                    {row.categoryId
                                       ? (categoryMap.get(row.categoryId) ??
                                         "—")
                                       : "—"}
                                 </span>
                                 <span className="text-xs text-right tabular-nums">
                                    {formatMoney(row.amount)}
                                 </span>
                                 <span className="flex items-center justify-end gap-1">
                                    {!row.isValid ? (
                                       <AlertTriangle className="size-3.5 text-destructive" />
                                    ) : (
                                       <>
                                          {isDuplicate && (
                                             <TooltipProvider>
                                                <Tooltip>
                                                   <TooltipTrigger asChild>
                                                      <AlertTriangle className="size-3.5 text-yellow-500 shrink-0" />
                                                   </TooltipTrigger>
                                                   <TooltipContent side="top">
                                                      <p>Possível duplicata</p>
                                                   </TooltipContent>
                                                </Tooltip>
                                             </TooltipProvider>
                                          )}
                                          <TooltipProvider>
                                             <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-xs"
                                                className="text-muted-foreground hover:text-destructive shrink-0"
                                                tooltip="Ignorar lançamento"
                                                onClick={(e) => {
                                                   e.stopPropagation();
                                                   ignoreRow(originalIndex);
                                                }}
                                             >
                                                <X className="size-3.5" />
                                             </Button>
                                          </TooltipProvider>
                                       </>
                                    )}
                                 </span>
                              </div>
                           );
                           if (!row.isValid && row.errors.length > 0) {
                              return (
                                 <TooltipProvider
                                    key={`prev-${originalIndex + 1}`}
                                 >
                                    <Tooltip>
                                       <TooltipTrigger asChild>
                                          {rowEl}
                                       </TooltipTrigger>
                                       <TooltipContent
                                          side="top"
                                          className="max-w-xs"
                                       >
                                          <p className="font-medium text-xs mb-1">
                                             Não pode ser importado:
                                          </p>
                                          <ul className="list-disc list-inside text-xs space-y-0.5">
                                             {row.errors.map((e) => (
                                                <li key={e}>{e}</li>
                                             ))}
                                          </ul>
                                       </TooltipContent>
                                    </Tooltip>
                                 </TooltipProvider>
                              );
                           }
                           return rowEl;
                        })}
                     </div>
                  </div>
               </div>

               <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                     {selectedIndices.size} de {validCount} selecionadas
                  </p>
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
                     disabled={selectedIndices.size === 0}
                     onClick={() => {
                        onSelectionReady(selectedIndices);
                        methods.navigation.next();
                     }}
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

interface ConfirmStepProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
   format: FileFormat;
   bankAccountId: string;
   selectedIndices: Set<number>;
   buildImportPayload: () => Array<{
      name?: string;
      type: "income" | "expense";
      amount: string;
      date: string;
      description?: string;
      categoryId?: string;
   }>;
   onClose?: () => void;
}

function ConfirmStep({
   methods,
   rows,
   format,
   bankAccountId,
   selectedIndices,
   buildImportPayload,
   onClose,
}: ConfirmStepProps) {
   const selectedCount = selectedIndices.size;
   const invalidCount = rows.filter((r) => !r.isValid).length;

   const importMutation = useMutation(
      orpc.transactions.importStatement.mutationOptions({}),
   );

   async function handleImport() {
      if (!bankAccountId) {
         toast.error("Selecione uma conta bancária.");
         return;
      }

      const transactions = buildImportPayload();
      await importMutation.mutateAsync({ bankAccountId, format, transactions });

      toast.success(
         `${transactions.length} transação(ões) importada(s) com sucesso.`,
      );
      onClose?.();
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
                     <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">
                           Total no arquivo
                        </span>
                        <span className="text-sm font-medium">
                           {rows.length}
                        </span>
                     </div>
                     {invalidCount > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                           <span className="text-sm text-muted-foreground">
                              Com erro (ignoradas)
                           </span>
                           <Badge variant="destructive">{invalidCount}</Badge>
                        </div>
                     )}
                     <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                        <span className="text-sm font-medium">
                           Total selecionadas
                        </span>
                        <span className="text-sm font-bold text-primary">
                           {selectedIndices.size}
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
                     disabled={
                        importMutation.isPending ||
                        selectedCount === 0 ||
                        !bankAccountId
                     }
                     onClick={handleImport}
                     type="button"
                  >
                     <span className="flex items-center gap-2">
                        {importMutation.isPending && (
                           <Loader2 className="size-4 animate-spin" />
                        )}
                        Importar {selectedCount} transação(ões)
                     </span>
                  </Button>
               </div>
            </div>
         </CredenzaBody>
      </>
   );
}

function ImportWizard({
   methods,
   teamId,
   onClose,
}: {
   methods: StepperMethods;
   teamId: string;
   onClose?: () => void;
}) {
   const currentId = methods.state.current.data.id;
   const [confirmedIndices, setConfirmedIndices] = useState<Set<number>>(
      new Set(),
   );
   const {
      rawData,
      rows,
      setRows,
      duplicateFlags,
      format,
      bankAccountId,
      setBankAccountId,
      mapping,
      setMapping,
      savedMappingApplied,
      parseFile,
      applyColumnMapping,
      resetMapping,
      buildImportPayload,
   } = useStatementImport({
      teamId,
      onInitSelection: (s) => setConfirmedIndices(s),
   });

   return (
      <>
         {currentId === "upload" && (
            <ErrorBoundary
               FallbackComponent={createErrorFallback({
                  errorTitle: "Erro ao carregar contas",
               })}
            >
               <Suspense
                  fallback={
                     <div className="flex items-center justify-center p-8">
                        <Loader2 className="size-6 animate-spin text-muted-foreground" />
                     </div>
                  }
               >
                  <UploadStep
                     bankAccountId={bankAccountId}
                     methods={methods}
                     onBankAccountChange={setBankAccountId}
                     parseFile={parseFile}
                  />
               </Suspense>
            </ErrorBoundary>
         )}
         {currentId === "map" && rawData && (
            <MapStep
               mapping={mapping}
               methods={methods}
               raw={rawData}
               savedMappingApplied={savedMappingApplied}
               onApplyColumnMapping={applyColumnMapping}
               onMappingChange={setMapping}
               onDismissSavedMapping={resetMapping}
            />
         )}
         {currentId === "preview" && (
            <PreviewStep
               duplicateFlags={duplicateFlags}
               format={format}
               methods={methods}
               rows={rows}
               onRowsChange={setRows}
               onSelectionReady={setConfirmedIndices}
            />
         )}
         {currentId === "confirm" && (
            <ConfirmStep
               bankAccountId={bankAccountId}
               buildImportPayload={() => buildImportPayload(confirmedIndices)}
               format={format}
               methods={methods}
               rows={rows}
               selectedIndices={confirmedIndices}
               onClose={onClose}
            />
         )}
      </>
   );
}

export function StatementImportCredenza({
   teamId,
   onClose,
}: {
   teamId: string;
   onClose?: () => void;
}) {
   return (
      <Stepper.Provider variant="line">
         {({ methods }) => (
            <ImportWizard methods={methods} teamId={teamId} onClose={onClose} />
         )}
      </Stepper.Provider>
   );
}
