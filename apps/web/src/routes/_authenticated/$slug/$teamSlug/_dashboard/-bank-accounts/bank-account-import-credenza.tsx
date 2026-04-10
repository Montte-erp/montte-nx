import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Input } from "@packages/ui/components/input";
import {
   Choicebox,
   ChoiceboxIndicator,
   ChoiceboxItem,
   ChoiceboxItemDescription,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
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
import { Combobox } from "@packages/ui/components/combobox";
import { defineStepper } from "@packages/ui/components/stepper";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
   AlertTriangle,
   ChevronRight,
   CreditCard,
   FileSpreadsheet,
   Landmark,
   Loader2,
   PiggyBank,
   Table2,
   TrendingUp,
   Undo2,
   Wallet,
   X,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import type React from "react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useFileDownload } from "@/hooks/use-file-download";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import {
   BankAccountImportProvider,
   BANK_TYPES,
   COLUMN_FIELDS,
   FIELD_LABELS,
   REQUIRED_FIELDS,
   TEMPLATE_HEADERS,
   TEMPLATE_ROWS,
   getSampleValues,
   toCreateInput,
   useBankAccountImportContext,
} from "./use-bank-account-import";
import { format, of, sumOrZero } from "@f-o-t/money";
import { TYPE_LABELS, formatBRL } from "./bank-accounts-columns";

import type { ResolvedBankAccountType } from "./use-bank-account-import";

const ACCOUNT_TYPE_ICONS: Record<ResolvedBankAccountType, React.ReactElement> =
   {
      cash: <Wallet className="size-4" />,
      checking: <Landmark className="size-4" />,
      savings: <PiggyBank className="size-4" />,
      payment: <CreditCard className="size-4" />,
      investment: <TrendingUp className="size-4" />,
   };

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
                     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                        [".xlsx"],
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
                  {COLUMN_FIELDS.map((field) => {
                     const sample = mapping[field]
                        ? getSampleValues(rawData, mapping[field])
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
                                    ...rawData.headers.map((h) => ({
                                       value: h,
                                       label: h,
                                    })),
                                 ]}
                                 onValueChange={(v) =>
                                    setMapping({
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
                  {rawData.rows.length} linha(s) · {rawData.headers.length}{" "}
                  colunas detectadas
               </p>
            </div>
         </CredenzaBody>
         <CredenzaFooter className="grid grid-cols-2 gap-2">
            <Button
               className="w-full"
               onClick={() => methods.navigation.prev()}
               type="button"
               variant="outline"
            >
               Voltar
            </Button>
            <Button
               className="w-full"
               disabled={!canProceed}
               onClick={handleNext}
               type="button"
            >
               <span className="flex items-center gap-2">
                  Continuar
                  <ChevronRight className="size-4" />
               </span>
            </Button>
         </CredenzaFooter>
      </>
   );
}

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function PreviewStep({ methods }: { methods: StepperMethods }) {
   const { previewRows, ignoredIndices, setIgnoredIndices, updateRow } =
      useBankAccountImportContext();
   const { openAlertDialog } = useAlertDialog();

   const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
      new Set(),
   );
   const [bulkBankCode, setBulkBankCode] = useState("");

   const parentRef = useRef<HTMLDivElement>(null);

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

   function ignoreIndices(indices: Iterable<number>) {
      const arr = [...indices];
      const nextIgnored = new Set(ignoredIndices);
      for (const i of arr) nextIgnored.add(i);
      setIgnoredIndices(nextIgnored);
      setSelectedIndices((prev) => {
         const next = new Set(prev);
         for (const i of arr) next.delete(i);
         return next;
      });
   }

   function unignoreIndex(index: number) {
      const next = new Set(ignoredIndices);
      next.delete(index);
      setIgnoredIndices(next);
   }

   const selectableIndices = previewRows
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => r._valid && !ignoredIndices.has(i))
      .map(({ i }) => i);

   const allSelected =
      selectableIndices.length > 0 &&
      selectableIndices.every((i) => selectedIndices.has(i));
   const someSelected = selectableIndices.some((i) => selectedIndices.has(i));
   const isIndeterminate = someSelected && !allSelected;
   const validCount = previewRows.filter((r) => r._valid).length;
   const errorCount = previewRows.length - validCount;

   function toggleSelectAll() {
      if (allSelected) {
         clearIndices();
         return;
      }
      setSelectedIndices(new Set(selectableIndices));
   }

   const selectedAreBankTypes = [...selectedIndices].some((i) => {
      const row = previewRows[i];
      return row?._resolvedType && BANK_TYPES.includes(row._resolvedType);
   });

   function applyBulkBankCode() {
      if (!bulkBankCode.trim()) return;
      for (const i of selectedIndices) {
         const row = previewRows[i];
         if (row?._resolvedType && BANK_TYPES.includes(row._resolvedType)) {
            updateRow(i, { codigo_banco: bulkBankCode.trim() });
         }
      }
      setBulkBankCode("");
   }

   const virtualizer = useVirtualizer({
      count: previewRows.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 44,
      overscan: 8,
   });

   const canContinue = previewRows.some(
      (r, i) => r._valid && !ignoredIndices.has(i),
   );

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Prévia da importação</CredenzaTitle>
            <CredenzaDescription>
               {validCount} conta(s) válida(s)
               {errorCount > 0 ? ` · ${errorCount} com erro` : ""}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <TooltipProvider>
               <div className="flex flex-col gap-4">
                  <StepBar methods={methods} />

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
                     {errorCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                           {errorCount} com erro
                        </Badge>
                     )}
                  </div>

                  <div className="rounded-lg border overflow-hidden">
                     <div className="grid grid-cols-[2rem_2rem_1fr_7rem_6rem_2rem] items-center gap-2 border-b bg-muted/50 px-3 py-2">
                        <span />
                        <span />
                        <span className="text-xs font-medium text-muted-foreground">
                           Nome
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                           Cód. banco
                        </span>
                        <span className="text-xs font-medium text-muted-foreground text-right">
                           Saldo inicial
                        </span>
                        <span />
                     </div>
                     <div ref={parentRef} className="h-64 overflow-auto">
                        <div
                           style={{
                              height: virtualizer.getTotalSize(),
                              position: "relative",
                           }}
                        >
                           {virtualizer.getVirtualItems().map((virtualRow) => {
                              const row = previewRows[virtualRow.index];
                              const originalIndex = virtualRow.index;
                              const isSelected =
                                 selectedIndices.has(originalIndex);
                              const isIgnored =
                                 ignoredIndices.has(originalIndex);
                              const resolvedColor = HEX_COLOR_REGEX.test(
                                 row.cor,
                              )
                                 ? row.cor
                                 : "#6366f1";
                              const resolvedType =
                                 row._resolvedType ?? "checking";
                              const needsBankCode =
                                 row._resolvedType &&
                                 BANK_TYPES.includes(row._resolvedType);

                              const rowEl = (
                                 <div
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
                                       "grid grid-cols-[2rem_2rem_1fr_7rem_6rem_2rem] items-center gap-2 border-b px-3 min-h-11",
                                       !row._valid || isIgnored
                                          ? "opacity-40"
                                          : "",
                                       isIgnored
                                          ? "bg-muted/60 line-through"
                                          : "",
                                       isSelected ? "bg-primary/5" : "",
                                    ]
                                       .filter(Boolean)
                                       .join(" ")}
                                 >
                                    <Checkbox
                                       checked={isSelected}
                                       disabled={!row._valid || isIgnored}
                                       onCheckedChange={() => {
                                          if (row._valid && !isIgnored)
                                             toggleRow(originalIndex);
                                       }}
                                    />
                                    <span
                                       className="flex size-6 shrink-0 items-center justify-center rounded-full text-white"
                                       style={{ background: resolvedColor }}
                                    >
                                       {ACCOUNT_TYPE_ICONS[resolvedType]}
                                    </span>
                                    <div className="flex flex-col min-w-0 py-1">
                                       <span className="text-xs font-medium truncate">
                                          {row.nome || "—"}
                                       </span>
                                       <span className="text-xs text-muted-foreground truncate">
                                          {TYPE_LABELS[resolvedType]}
                                       </span>
                                    </div>
                                    {needsBankCode && !isIgnored ? (
                                       <Input
                                          className="h-7 text-xs px-2"
                                          placeholder="Ex: 260"
                                          value={row.codigo_banco}
                                          onChange={(e) =>
                                             updateRow(originalIndex, {
                                                codigo_banco: e.target.value,
                                             })
                                          }
                                          onClick={(e) => e.stopPropagation()}
                                       />
                                    ) : (
                                       <span className="text-xs text-muted-foreground">
                                          —
                                       </span>
                                    )}
                                    <span className="text-xs tabular-nums text-right text-muted-foreground">
                                       {formatBRL(
                                          row.saldo_inicial.replace(",", ".") ||
                                             "0",
                                       )}
                                    </span>
                                    <span className="flex items-center justify-end">
                                       {!row._valid ? (
                                          <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                                       ) : isIgnored ? (
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
                                       ) : (
                                          <Button
                                             type="button"
                                             variant="ghost"
                                             size="icon-xs"
                                             className="text-muted-foreground hover:text-destructive shrink-0"
                                             tooltip="Ignorar conta"
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                ignoreIndices([originalIndex]);
                                             }}
                                          >
                                             <X className="size-3.5" />
                                          </Button>
                                       )}
                                    </span>
                                 </div>
                              );

                              if (!row._valid && row._errors.length > 0) {
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
                                                {row._errors.map((e) => (
                                                   <li key={e}>{e}</li>
                                                ))}
                                             </ul>
                                          </TooltipContent>
                                       </Tooltip>
                                    </TooltipProvider>
                                 );
                              }

                              return (
                                 <div key={`prev-${originalIndex + 1}`}>
                                    {rowEl}
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                  </div>

                  {selectedIndices.size > 0 && (
                     <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-medium tabular-nums shrink-0">
                              {selectedIndices.size} de {validCount}{" "}
                              selecionadas
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
                                    title: `Ignorar ${selectedIndices.size} conta${selectedIndices.size === 1 ? "" : "s"}`,
                                    description:
                                       "As contas selecionadas serão marcadas como ignoradas e não serão importadas.",
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
                        </div>
                        {selectedAreBankTypes && (
                           <div className="flex items-center gap-2">
                              <Input
                                 className="h-7 text-xs px-2 flex-1"
                                 placeholder="Código do banco para as selecionadas (ex: 260)"
                                 value={bulkBankCode}
                                 onChange={(e) =>
                                    setBulkBankCode(e.target.value)
                                 }
                                 onKeyDown={(e) => {
                                    if (e.key === "Enter") applyBulkBankCode();
                                 }}
                              />
                              <Button
                                 type="button"
                                 size="sm"
                                 variant="outline"
                                 className="h-7 px-2 text-xs shrink-0"
                                 disabled={!bulkBankCode.trim()}
                                 onClick={applyBulkBankCode}
                              >
                                 Aplicar
                              </Button>
                           </div>
                        )}
                     </div>
                  )}
               </div>
            </TooltipProvider>
         </CredenzaBody>
         <CredenzaFooter className="grid grid-cols-2 gap-2">
            <Button
               className="w-full"
               onClick={() => methods.navigation.prev()}
               type="button"
               variant="outline"
            >
               Voltar
            </Button>
            <Button
               className="w-full"
               disabled={!canContinue}
               onClick={() => methods.navigation.next()}
               type="button"
            >
               <span className="flex items-center gap-2">
                  Continuar
                  <ChevronRight className="size-4" />
               </span>
            </Button>
         </CredenzaFooter>
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
   const { previewRows, ignoredIndices } = useBankAccountImportContext();
   const [isPending, startTransition] = useTransition();
   const bulkCreate = useMutation(
      orpc.bankAccounts.bulkCreate.mutationOptions(),
   );

   const validRows = previewRows.filter(
      (r, i) => r._valid && !ignoredIndices.has(i),
   );

   const totalBalance = sumOrZero(
      validRows.map((row) =>
         of(row.saldo_inicial.replace(",", ".") || "0", "BRL"),
      ),
      "BRL",
   );

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
         onClose?.();
      });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Confirmar importação</CredenzaTitle>
            <CredenzaDescription>
               {validRows.length} conta(s) · Saldo inicial total:{" "}
               {format(totalBalance, "pt-BR")}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex flex-col divide-y rounded-lg border overflow-hidden max-h-72 overflow-y-auto">
                  {validRows.map((row, i) => {
                     const resolvedColor = /^#[0-9a-fA-F]{6}$/.test(row.cor)
                        ? row.cor
                        : "#6366f1";
                     const resolvedType = row._resolvedType ?? "checking";
                     return (
                        <div
                           key={`confirm-${i + 1}`}
                           className="flex items-center gap-2 px-3 py-2.5"
                        >
                           <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
                              style={{ background: resolvedColor }}
                           >
                              {ACCOUNT_TYPE_ICONS[resolvedType]}
                           </span>
                           <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-sm font-medium truncate">
                                 {row.nome}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                 {TYPE_LABELS[resolvedType]}
                              </span>
                           </div>
                           <span className="text-sm tabular-nums shrink-0">
                              {formatBRL(
                                 row.saldo_inicial.replace(",", ".") || "0",
                              )}
                           </span>
                        </div>
                     );
                  })}
               </div>

               <div className="rounded-xl border overflow-hidden">
                  <div className="divide-y">
                     {previewRows.length - validRows.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                           <span className="text-sm text-muted-foreground">
                              Ignoradas
                           </span>
                           <Badge variant="secondary">
                              {previewRows.length - validRows.length}
                           </Badge>
                        </div>
                     )}
                     <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                        <span className="text-sm font-medium">
                           Total a importar
                        </span>
                        <span className="text-sm font-bold text-primary">
                           {validRows.length}
                        </span>
                     </div>
                  </div>
               </div>
            </div>
         </CredenzaBody>
         <CredenzaFooter className="grid grid-cols-2 gap-2">
            <Button
               className="w-full"
               disabled={isPending}
               onClick={() => methods.navigation.prev()}
               type="button"
               variant="outline"
            >
               Voltar
            </Button>
            <Button
               className="w-full"
               disabled={isPending || validRows.length === 0}
               onClick={handleImport}
               type="button"
            >
               <span className="flex items-center gap-2">
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Importar {validRows.length} conta(s)
               </span>
            </Button>
         </CredenzaFooter>
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
         {currentId === "upload" && <UploadStep methods={methods} />}
         {currentId === "map" && <MapStep methods={methods} />}
         {currentId === "preview" && <PreviewStep methods={methods} />}
         {currentId === "confirm" && (
            <ConfirmStep methods={methods} onClose={onClose} />
         )}
      </>
   );
}

export function BankAccountImportCredenza({
   onClose,
}: {
   onClose?: () => void;
}) {
   return (
      <BankAccountImportProvider>
         <Stepper.Provider variant="line">
            {({ methods }) => (
               <ImportWizard methods={methods} onClose={onClose} />
            )}
         </Stepper.Provider>
      </BankAccountImportProvider>
   );
}
