import { of as moneyOf, format as moneyFormat, sumOrZero } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxItem,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
   ChoiceboxItemDescription,
   ChoiceboxIndicator,
} from "@packages/ui/components/choicebox";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandInput,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
import { Calendar } from "@packages/ui/components/calendar";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Toggle } from "@packages/ui/components/toggle";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
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
import { QueryBoundary } from "@/components/query-boundary";
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
   FileSpreadsheet,
   FileText,
   Loader2,
   Sparkles,
   Table2,
   Undo2,
   X,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useFileDownload } from "@/hooks/use-file-download";
import {
   COLUMN_FIELDS,
   FIELD_LABELS,
   REQUIRED_FIELDS,
   TEMPLATE_HEADERS,
   TEMPLATE_ROWS,
   StatementImportProvider,
   formatMoney,
   getSampleValues,
   parseAmount,
   parseDate,
   validateRow,
   useStatementImportContext,
} from "./use-statement-import";

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
      filename: "modelo-importacao.csv",
   },
   {
      value: "xlsx" as const,
      label: "XLSX",
      description: "Excel e Google Sheets — com formatação de colunas",
      icon: Table2,
      iconClass: "text-green-600",
      filename: "modelo-importacao.xlsx",
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
               {TEMPLATE_OPTIONS.map(
                  ({
                     value,
                     label,
                     description,
                     icon: Icon,
                     iconClass,
                     filename,
                  }) => (
                     <ChoiceboxItem
                        key={value}
                        value={value}
                        id={`template-${value}`}
                     >
                        <ChoiceboxIndicator
                           id={`template-${value}`}
                           className="sr-only"
                        />
                        <button
                           type="button"
                           className="flex flex-col gap-2 w-full cursor-pointer"
                           onClick={() => {
                              download(
                                 generators[value].generate(TEMPLATE_ROWS, [
                                    ...TEMPLATE_HEADERS,
                                 ]),
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

function UploadStep({ methods }: { methods: StepperMethods }) {
   const {
      bankAccountId,
      setBankAccountId: onBankAccountChange,
      parseFile,
   } = useStatementImportContext();
   const [isPending, startTransition] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { openCredenza, closeCredenza } = useCredenza();
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

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
                  disabled={isPending || !bankAccountId}
                  maxFiles={1}
                  onDrop={([file]) => {
                     if (file) void handleFile(file);
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

function MapStep({ methods }: { methods: StepperMethods }) {
   const {
      rawData: raw,
      mapping,
      setMapping: onMappingChange,
      savedMappingApplied,
      applyColumnMapping: onApplyColumnMapping,
      resetMapping: onDismissSavedMapping,
   } = useStatementImportContext();

   if (!raw) return null;
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
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground h-auto py-0 px-1"
                        onClick={onDismissSavedMapping}
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

function BulkDateCredenza({
   selectedCount,
   onApply,
   onCancel,
}: {
   selectedCount: number;
   onApply: (date: Date) => void;
   onCancel: () => void;
}) {
   const [date, setDate] = useState<Date | undefined>();

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Alterar data</CredenzaTitle>
            <CredenzaDescription>
               Aplicar data a {selectedCount}{" "}
               {selectedCount === 1 ? "lançamento" : "lançamentos"}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <DatePicker
               date={date}
               onSelect={setDate}
               placeholder="Selecionar data"
            />
         </CredenzaBody>
         <CredenzaFooter className="grid grid-cols-2 gap-2">
            <Button
               className="w-full"
               onClick={onCancel}
               variant="outline"
               type="button"
            >
               Cancelar
            </Button>
            <Button
               className="w-full"
               disabled={!date}
               type="button"
               onClick={() => {
                  if (!date) return;
                  onApply(date);
               }}
            >
               Aplicar
            </Button>
         </CredenzaFooter>
      </>
   );
}

function BulkCategoryCredenza({
   selectedCount,
   categoryOptions,
   onApply,
   onCancel,
}: {
   selectedCount: number;
   categoryOptions: { value: string; label: string }[];
   onApply: (categoryId: string) => void;
   onCancel: () => void;
}) {
   const [categoryId, setCategoryId] = useState("");

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Alterar categoria</CredenzaTitle>
            <CredenzaDescription>
               Aplicar categoria a {selectedCount}{" "}
               {selectedCount === 1 ? "lançamento" : "lançamentos"}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <Combobox
               options={categoryOptions}
               onValueChange={setCategoryId}
               value={categoryId}
               placeholder="Selecionar categoria..."
               searchPlaceholder="Buscar categoria..."
               emptyMessage="Nenhuma categoria encontrada."
            />
         </CredenzaBody>
         <CredenzaFooter className="grid grid-cols-2 gap-2">
            <Button
               className="w-full"
               onClick={onCancel}
               variant="outline"
               type="button"
            >
               Cancelar
            </Button>
            <Button
               className="w-full"
               disabled={!categoryId}
               type="button"
               onClick={() => {
                  if (!categoryId) return;
                  onApply(categoryId);
               }}
            >
               Aplicar
            </Button>
         </CredenzaFooter>
      </>
   );
}

function PreviewStep({ methods }: { methods: StepperMethods }) {
   const {
      rows,
      setRows: onRowsChange,
      duplicateFlags,
      format,
      setConfirmedIndices: onSelectionReady,
      minImportDate,
   } = useStatementImportContext();
   type EditingCell = { type: "desc"; index: number; value: string } | null;

   const [filterDuplicates, setFilterDuplicates] = useState(false);
   const [editingCell, setEditingCell] = useState<EditingCell>(null);
   const { openCredenza, closeTopCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

   const categoryOptions = categories.map((c) => ({
      value: c.id,
      label: c.name,
   }));

   const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
      new Set(),
   );
   const [ignoredIndices, setIgnoredIndices] = useState<Set<number>>(new Set());

   function toggleRow(index: number) {
      setSelectedIndices((prev) => {
         const next = new Set(prev);
         if (next.has(index)) next.delete(index);
         else next.add(index);
         return next;
      });
   }

   function clearIndices() {
      setSelectedIndices(new Set());
   }

   function replaceIndices(next: Set<number>) {
      setSelectedIndices(new Set(next));
   }

   function ignoreIndices(indices: Iterable<number>) {
      const arr = [...indices];
      setIgnoredIndices((prev) => {
         const next = new Set(prev);
         for (const i of arr) next.add(i);
         return next;
      });
      setSelectedIndices((prev) => {
         const next = new Set(prev);
         for (const i of arr) next.delete(i);
         return next;
      });
   }

   function unignoreIndex(index: number) {
      setIgnoredIndices((prev) => {
         const next = new Set(prev);
         next.delete(index);
         return next;
      });
   }

   const validCount = rows.filter((r) => r.isValid).length;

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
      .filter(({ r, i }) => r.isValid && !ignoredIndices.has(i))
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
      ignoreIndices([index]);
   }

   function applyBulkDate(date: Date) {
      const dateStr = dayjs(date).format("YYYY-MM-DD");
      const updated = rows.map((r, i) =>
         selectedIndices.has(i) ? { ...r, date: dateStr } : r,
      );
      onRowsChange(updated);
   }

   function applyBulkCategory(categoryId: string) {
      const updated = rows.map((r, i) =>
         selectedIndices.has(i) ? { ...r, categoryId } : r,
      );
      onRowsChange(updated);
   }

   function autoCategorize() {
      let matched = 0;
      const updated = rows.map((r) => {
         if (r.categoryId || !r.isValid) return r;
         const text = (r.description || r.name || "").toLowerCase();
         for (const cat of categories) {
            const terms = [
               cat.name.toLowerCase(),
               ...(cat.keywords ?? []).map((k: string) => k.toLowerCase()),
            ];
            if (terms.some((t) => text.includes(t))) {
               matched++;
               return { ...r, categoryId: cat.id };
            }
         }
         return r;
      });
      onRowsChange(updated);
      if (matched > 0) {
         toast.success(
            `${matched} lançamento(s) categorizados automaticamente.`,
         );
      } else {
         toast.info("Nenhum lançamento pôde ser categorizado automaticamente.");
      }
   }

   function commitDescEdit(originalIndex: number) {
      if (editingCell?.type !== "desc") return;
      const editingDescValue = editingCell.value;
      const updated = rows.map((r, i) =>
         i === originalIndex ? { ...r, description: editingDescValue } : r,
      );
      onRowsChange(updated);
      setEditingCell(null);
   }

   const canEditDesc = format !== "ofx";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Revise as transações</CredenzaTitle>
            <CredenzaDescription>
               Todos os lançamentos válidos serão importados — duplicatas já
               estão ignoradas automaticamente
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex items-center gap-2">
                  {[
                     {
                        label: "Entradas",
                        value: moneyFormat(totalIncome, "pt-BR"),
                        className: "text-emerald-500",
                     },
                     {
                        label: "Saídas",
                        value: moneyFormat(totalExpense, "pt-BR"),
                        className: "text-destructive",
                     },
                  ].map(({ label, value, className }) => (
                     <Announcement key={label}>
                        <AnnouncementTag>{label}</AnnouncementTag>
                        <AnnouncementTitle>
                           <span className={className}>{value}</span>
                        </AnnouncementTitle>
                     </Announcement>
                  ))}
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
                     <Label
                        htmlFor="select-all"
                        className="text-xs text-muted-foreground cursor-pointer"
                     >
                        Selecionar todas válidas
                     </Label>
                  </div>
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
               </div>

               <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-[2rem_6rem_1fr_4rem_1fr_6rem_2rem] items-center gap-2 border-b bg-muted/50 px-3 py-2">
                     <span />
                     <span className="text-xs font-medium text-muted-foreground">
                        Data
                     </span>
                     <span className="text-xs font-medium text-muted-foreground">
                        Descrição
                     </span>
                     <span className="text-xs font-medium text-muted-foreground">
                        Tipo
                     </span>
                     <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                           Categoria
                        </span>
                        <TooltipProvider>
                           <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              className="border-primary/40 text-primary hover:bg-primary/10"
                              tooltip="Categorização automática"
                              onClick={autoCategorize}
                           >
                              <Sparkles className="size-3.5" />
                           </Button>
                        </TooltipProvider>
                     </div>
                     <span className="text-xs font-medium text-muted-foreground">
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
                           const isIgnored = ignoredIndices.has(originalIndex);
                           const isEditingDesc =
                              editingCell?.type === "desc" &&
                              editingCell.index === originalIndex;
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
                                    "grid grid-cols-[2rem_6rem_1fr_4rem_1fr_6rem_2rem] items-center gap-2 border-b px-3 h-10",
                                    !row.isValid || isIgnored
                                       ? "opacity-40"
                                       : "",
                                    isIgnored ? "bg-muted/60 line-through" : "",
                                    isSelected ? "bg-primary/5" : "",
                                 ]
                                    .filter(Boolean)
                                    .join(" ")}
                              >
                                 <Checkbox
                                    checked={isSelected}
                                    disabled={!row.isValid || isIgnored}
                                    onCheckedChange={() => {
                                       if (row.isValid && !isIgnored)
                                          toggleRow(originalIndex);
                                    }}
                                 />
                                 {row.isValid ? (
                                    <Popover>
                                       <PopoverTrigger asChild>
                                          <span className="text-xs tabular-nums cursor-pointer hover:underline hover:decoration-dotted">
                                             {parseDate(row.date)
                                                ? dayjs(
                                                     parseDate(row.date),
                                                  ).format("DD/MM/YYYY")
                                                : row.date || "—"}
                                          </span>
                                       </PopoverTrigger>
                                       <PopoverContent
                                          className="w-auto p-0"
                                          align="start"
                                          side="bottom"
                                       >
                                          <Calendar
                                             mode="single"
                                             selected={
                                                parseDate(row.date)
                                                   ? dayjs(
                                                        parseDate(row.date),
                                                     ).toDate()
                                                   : undefined
                                             }
                                             onSelect={(d) => {
                                                if (!d) return;
                                                const newDate =
                                                   dayjs(d).format(
                                                      "YYYY-MM-DD",
                                                   );
                                                const updated = rows.map(
                                                   (r, i) =>
                                                      i === originalIndex
                                                         ? validateRow(
                                                              {
                                                                 ...r,
                                                                 date: newDate,
                                                              },
                                                              minImportDate,
                                                           )
                                                         : r,
                                                );
                                                onRowsChange(updated);
                                             }}
                                          />
                                       </PopoverContent>
                                    </Popover>
                                 ) : (
                                    <span className="text-xs tabular-nums">
                                       {parseDate(row.date)
                                          ? dayjs(parseDate(row.date)).format(
                                               "DD/MM/YYYY",
                                            )
                                          : row.date || "—"}
                                    </span>
                                 )}
                                 {canEditDesc &&
                                 row.isValid &&
                                 isEditingDesc ? (
                                    <Input
                                       autoFocus
                                       className="text-xs h-7 py-0"
                                       value={
                                          editingCell?.type === "desc"
                                             ? editingCell.value
                                             : ""
                                       }
                                       onChange={(e) =>
                                          setEditingCell({
                                             type: "desc",
                                             index: originalIndex,
                                             value: e.target.value,
                                          })
                                       }
                                       onBlur={() =>
                                          commitDescEdit(originalIndex)
                                       }
                                       onKeyDown={(e) => {
                                          if (e.key === "Enter")
                                             commitDescEdit(originalIndex);
                                          if (e.key === "Escape")
                                             setEditingCell(null);
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
                                                   setEditingCell({
                                                      type: "desc",
                                                      index: originalIndex,
                                                      value:
                                                         row.description ||
                                                         row.name ||
                                                         "",
                                                   });
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
                                 {row.isValid ? (
                                    <Popover>
                                       <PopoverTrigger asChild>
                                          <span className="text-xs truncate cursor-pointer hover:underline hover:decoration-dotted">
                                             {row.categoryId
                                                ? (categoryMap.get(
                                                     row.categoryId,
                                                  ) ?? "—")
                                                : "—"}
                                          </span>
                                       </PopoverTrigger>
                                       <PopoverContent
                                          className="w-48 p-0"
                                          align="start"
                                          side="bottom"
                                       >
                                          <Command>
                                             <CommandInput placeholder="Buscar..." />
                                             <CommandList>
                                                <CommandEmpty>
                                                   Nenhuma categoria
                                                </CommandEmpty>
                                                <CommandGroup>
                                                   {categoryOptions.map(
                                                      (opt) => (
                                                         <CommandItem
                                                            key={opt.value}
                                                            value={opt.value}
                                                            onSelect={(v) => {
                                                               const updated =
                                                                  rows.map(
                                                                     (r, i) =>
                                                                        i ===
                                                                        originalIndex
                                                                           ? {
                                                                                ...r,
                                                                                categoryId:
                                                                                   v,
                                                                             }
                                                                           : r,
                                                                  );
                                                               onRowsChange(
                                                                  updated,
                                                               );
                                                            }}
                                                         >
                                                            {opt.label}
                                                         </CommandItem>
                                                      ),
                                                   )}
                                                </CommandGroup>
                                             </CommandList>
                                          </Command>
                                       </PopoverContent>
                                    </Popover>
                                 ) : (
                                    <span className="text-xs truncate">
                                       {row.categoryId
                                          ? (categoryMap.get(row.categoryId) ??
                                            "—")
                                          : "—"}
                                    </span>
                                 )}
                                 <span className="text-xs tabular-nums">
                                    {formatMoney(row.amount)}
                                 </span>
                                 <span className="flex items-center justify-end gap-1">
                                    {!row.isValid ? (
                                       <AlertTriangle className="size-3.5 text-destructive" />
                                    ) : isIgnored ? (
                                       <TooltipProvider>
                                          <Button
                                             type="button"
                                             variant="ghost"
                                             size="icon-xs"
                                             className="text-muted-foreground hover:text-foreground shrink-0"
                                             tooltip="Desfazer"
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                unignoreIndex(originalIndex);
                                             }}
                                          >
                                             <Undo2 className="size-3.5" />
                                          </Button>
                                       </TooltipProvider>
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

               {selectedIndices.size > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                     <span className="text-xs font-medium tabular-nums shrink-0">
                        {selectedIndices.size} de {validCount} selecionadas
                     </span>
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-2 px-2 text-xs"
                        onClick={clearIndices}
                     >
                        <X className="size-3.5" />
                        Limpar
                     </Button>
                     <div className="h-4 w-px bg-border" />
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                           openAlertDialog({
                              title: `Ignorar ${selectedIndices.size} transaç${selectedIndices.size === 1 ? "ão" : "ões"}`,
                              description:
                                 "As transações selecionadas serão marcadas como ignoradas e não serão importadas.",
                              actionLabel: "Ignorar",
                              cancelLabel: "Cancelar",
                              variant: "destructive",
                              onAction: async () => {
                                 ignoreIndices(selectedIndices);
                              },
                           });
                        }}
                     >
                        Ignorar selecionadas
                     </Button>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                           openCredenza({
                              className: "sm:max-w-sm",
                              children: (
                                 <BulkDateCredenza
                                    selectedCount={selectedIndices.size}
                                    onApply={(date) => {
                                       applyBulkDate(date);
                                       closeTopCredenza();
                                    }}
                                    onCancel={closeTopCredenza}
                                 />
                              ),
                           })
                        }
                     >
                        Alterar data
                     </Button>
                     <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                           openCredenza({
                              className: "sm:max-w-sm",
                              children: (
                                 <BulkCategoryCredenza
                                    selectedCount={selectedIndices.size}
                                    categoryOptions={categoryOptions}
                                    onApply={(id) => {
                                       applyBulkCategory(id);
                                       closeTopCredenza();
                                    }}
                                    onCancel={closeTopCredenza}
                                 />
                              ),
                           })
                        }
                     >
                        Alterar categoria
                     </Button>
                  </div>
               )}

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
                     disabled={selectableIndices.length === 0}
                     onClick={() => {
                        const confirmedSet = new Set(selectableIndices);
                        const duplicateCount = selectableIndices.filter(
                           (i) => duplicateFlags[i],
                        ).length;
                        if (duplicateCount > 0) {
                           openAlertDialog({
                              title: `${duplicateCount} possível${duplicateCount === 1 ? "" : "is"} duplicata${duplicateCount === 1 ? "" : "s"} detectada${duplicateCount === 1 ? "" : "s"}`,
                              description: `${duplicateCount === 1 ? "Um lançamento parece já existir" : `${duplicateCount} lançamentos parecem já existir`} na sua conta. Deseja importar mesmo assim?`,
                              actionLabel: "Importar mesmo assim",
                              cancelLabel: "Revisar",
                              variant: "destructive",
                              onAction: async () => {
                                 onSelectionReady(confirmedSet);
                                 methods.navigation.next();
                              },
                           });
                           return;
                        }
                        onSelectionReady(confirmedSet);
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

function ConfirmStep({
   methods,
   onClose,
}: {
   methods: StepperMethods;
   onClose?: () => void;
}) {
   const {
      rows,
      format,
      bankAccountId,
      confirmedIndices: selectedIndices,
      buildImportPayload,
   } = useStatementImportContext();
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
                           Serão importadas
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
                        Importar {selectedCount} lançamento(s)
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
   onClose,
}: {
   methods: StepperMethods;
   onClose?: () => void;
}) {
   const currentId = methods.state.current.data.id;

   return (
      <>
         {currentId === "upload" && (
            <QueryBoundary
               fallback={
                  <div className="flex items-center justify-center p-4">
                     <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
               }
               errorTitle="Erro ao carregar contas"
            >
               <UploadStep methods={methods} />
            </QueryBoundary>
         )}
         {currentId === "map" && <MapStep methods={methods} />}
         {currentId === "preview" && (
            <QueryBoundary
               fallback={
                  <div className="flex items-center justify-center p-4">
                     <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
               }
               errorTitle="Erro ao carregar categorias"
            >
               <PreviewStep methods={methods} />
            </QueryBoundary>
         )}
         {currentId === "confirm" && (
            <ConfirmStep methods={methods} onClose={onClose} />
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
      <StatementImportProvider teamId={teamId}>
         <Stepper.Provider variant="line">
            {({ methods }) => (
               <ImportWizard methods={methods} onClose={onClose} />
            )}
         </Stepper.Provider>
      </StatementImportProvider>
   );
}
