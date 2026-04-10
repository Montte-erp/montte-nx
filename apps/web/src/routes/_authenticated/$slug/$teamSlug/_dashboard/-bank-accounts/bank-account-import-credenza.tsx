import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
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
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { defineStepper } from "@packages/ui/components/stepper";
import { useMutation } from "@tanstack/react-query";
import {
   CheckCircle2,
   ChevronRight,
   FileSpreadsheet,
   Loader2,
   Table2,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useCredenza } from "@/hooks/use-credenza";
import { useFileDownload } from "@/hooks/use-file-download";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
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
               onClick={() => methods.navigation.prev()}
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
                           <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              Tipo
                           </th>
                           <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              Nome
                           </th>
                           <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                              Saldo inicial
                           </th>
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
                                    <Badge
                                       variant="destructive"
                                       className="text-xs"
                                    >
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
               onClick={() => methods.navigation.prev()}
            >
               Voltar
            </Button>
            <Button
               type="button"
               disabled={validCount === 0}
               onClick={() => methods.navigation.next()}
            >
               Importar {validCount} conta(s){" "}
               <ChevronRight className="size-4" />
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
   const { previewRows } = useBankAccountImportContext();
   const [isPending, startTransition] = useTransition();
   const bulkCreate = useMutation(
      orpc.bankAccounts.bulkCreate.mutationOptions(),
   );

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
         onClose?.();
      });
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
                           {previewRows.length}
                        </span>
                     </div>
                     {previewRows.length - validRows.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                           <span className="text-sm text-muted-foreground">
                              Com erro (ignoradas)
                           </span>
                           <Badge variant="destructive">
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
               <div className="flex gap-2">
                  <Button
                     className="flex-none"
                     disabled={isPending}
                     onClick={() => methods.navigation.prev()}
                     type="button"
                     variant="outline"
                  >
                     Voltar
                  </Button>
                  <Button
                     className="flex-1"
                     disabled={isPending || validRows.length === 0}
                     onClick={handleImport}
                     type="button"
                  >
                     {isPending && <Loader2 className="size-4 animate-spin" />}
                     Importar {validRows.length} conta(s)
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
