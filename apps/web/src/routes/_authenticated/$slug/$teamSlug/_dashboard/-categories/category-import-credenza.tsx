import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxItem,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
   ChoiceboxItemDescription,
   ChoiceboxIndicator,
} from "@packages/ui/components/choicebox";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import { defineStepper } from "@packages/ui/components/stepper";
import { useMutation } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
   AlertCircle,
   CheckCircle2,
   ChevronRight,
   FileSpreadsheet,
   Loader2,
   Undo2,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useRef, useTransition, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useFileDownload } from "@/hooks/use-file-download";
import {
   CategoryImportProvider,
   useCategoryImportContext,
   FIELD_OPTIONS,
   TEMPLATE_HEADERS,
   TEMPLATE_ROWS,
   getSampleValues,
} from "./use-category-import";

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type StepperMethods = ReturnType<typeof useStepper>;

function TemplateCredenza({ onClose }: { onClose?: () => void }) {
   const csv = useCsvFile();
   const xlsx = useXlsxFile();
   const { download } = useFileDownload();

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
               <ChoiceboxItem value="csv" id="template-csv">
                  <ChoiceboxIndicator id="template-csv" className="sr-only" />
                  <button
                     type="button"
                     className="flex flex-col gap-2 w-full cursor-pointer"
                     onClick={() => {
                        download(
                           csv.generate(TEMPLATE_ROWS, [...TEMPLATE_HEADERS]),
                           "modelo-categorias.csv",
                        );
                        onClose?.();
                     }}
                  >
                     <FileSpreadsheet className="size-5 shrink-0 text-emerald-600" />
                     <ChoiceboxItemHeader>
                        <ChoiceboxItemTitle>CSV</ChoiceboxItemTitle>
                        <ChoiceboxItemDescription>
                           Compatível com qualquer planilha ou editor de texto
                        </ChoiceboxItemDescription>
                     </ChoiceboxItemHeader>
                  </button>
               </ChoiceboxItem>
               <ChoiceboxItem value="xlsx" id="template-xlsx">
                  <ChoiceboxIndicator id="template-xlsx" className="sr-only" />
                  <button
                     type="button"
                     className="flex flex-col gap-2 w-full cursor-pointer"
                     onClick={() => {
                        download(
                           xlsx.generate(TEMPLATE_ROWS, [...TEMPLATE_HEADERS]),
                           "modelo-categorias.xlsx",
                        );
                        onClose?.();
                     }}
                  >
                     <FileSpreadsheet className="size-5 shrink-0 text-green-600" />
                     <ChoiceboxItemHeader>
                        <ChoiceboxItemTitle>XLSX</ChoiceboxItemTitle>
                        <ChoiceboxItemDescription>
                           Excel e Google Sheets — com formatação de colunas
                        </ChoiceboxItemDescription>
                     </ChoiceboxItemHeader>
                  </button>
               </ChoiceboxItem>
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
   const { parseFile } = useCategoryImportContext();
   const [isPending, startTransition] = useTransition();
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { openCredenza, closeCredenza } = useCredenza();

   const handleFile = useCallback(
      (file: File) => {
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
      },
      [parseFile, methods.navigation],
   );

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar categorias</CredenzaTitle>
            <CredenzaDescription>
               Envie um arquivo CSV com suas categorias
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
                           <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                              <FileSpreadsheet className="size-3.5 text-emerald-600" />
                              <span className="text-xs font-medium">CSV</span>
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

function MapStep({ methods }: { methods: StepperMethods }) {
   const {
      rawData,
      mapping,
      setMapping,
      savedMappingApplied,
      resetMapping,
      applyColumnMapping,
   } = useCategoryImportContext();

   const handleNext = useCallback(() => {
      applyColumnMapping(mapping);
      methods.navigation.next();
   }, [applyColumnMapping, mapping, methods.navigation]);

   if (!rawData) return null;

   const canProceed = Object.values(mapping).some((v) => v === "name");

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
                        <Undo2 className="size-3" />
                        Redefinir
                     </Button>
                  </div>
               )}

               <div className="flex flex-col gap-2">
                  {rawData.headers.map((header) => {
                     const sample = getSampleValues(rawData, header);
                     return (
                        <div
                           className="grid grid-cols-[10rem_1fr] items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 overflow-hidden"
                           key={header}
                        >
                           <div className="flex flex-col gap-2 pt-1">
                              <span className="text-sm font-medium">
                                 {header}
                              </span>
                              {sample && (
                                 <span className="text-xs text-muted-foreground truncate">
                                    {sample}
                                 </span>
                              )}
                           </div>
                           <Combobox
                              options={FIELD_OPTIONS}
                              value={mapping[header] ?? "__skip__"}
                              onValueChange={(v) =>
                                 setMapping({ ...mapping, [header]: v })
                              }
                           />
                        </div>
                     );
                  })}
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

function PreviewStep({ methods }: { methods: StepperMethods }) {
   const { mappedCategories } = useCategoryImportContext();
   const previewRef = useRef<HTMLDivElement>(null);

   const virtualizer = useVirtualizer({
      count: mappedCategories.length,
      getScrollElement: () => previewRef.current,
      estimateSize: () => 56,
      overscan: 8,
   });

   const validCount = mappedCategories.filter((c) => c.valid).length;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Prévia</CredenzaTitle>
            <CredenzaDescription>
               Revise as categorias antes de importar
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="h-56 overflow-auto" ref={previewRef}>
                  <div
                     style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        position: "relative",
                     }}
                  >
                     {virtualizer.getVirtualItems().map((virtualRow) => {
                        const cat = mappedCategories[virtualRow.index];
                        if (!cat) return null;
                        return (
                           <div
                              key={cat.name}
                              style={{
                                 position: "absolute",
                                 top: 0,
                                 left: 0,
                                 width: "100%",
                                 height: `${virtualRow.size}px`,
                                 transform: `translateY(${virtualRow.start}px)`,
                              }}
                              className="grid grid-cols-[1fr_6rem_6rem_2rem] items-center gap-2 border-b px-3 py-2"
                           >
                              <span className="text-sm font-medium truncate">
                                 {cat.name}
                              </span>
                              <span>
                                 {cat.type === "income" ? (
                                    <Badge
                                       variant="outline"
                                       className="text-green-600 border-green-600"
                                    >
                                       Receita
                                    </Badge>
                                 ) : cat.type === "expense" ? (
                                    <Badge variant="destructive">Despesa</Badge>
                                 ) : (
                                    <span className="text-sm text-muted-foreground">
                                       —
                                    </span>
                                 )}
                              </span>
                              <span>
                                 {cat.subcategories.length > 0 ? (
                                    <Badge variant="secondary">
                                       {cat.subcategories.length}
                                    </Badge>
                                 ) : (
                                    <span className="text-sm text-muted-foreground">
                                       —
                                    </span>
                                 )}
                              </span>
                              <span>
                                 {cat.valid ? (
                                    <CheckCircle2 className="size-4 text-green-600" />
                                 ) : (
                                    <AlertCircle className="size-4 text-destructive" />
                                 )}
                              </span>
                           </div>
                        );
                     })}
                  </div>
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

   const handleImport = useCallback(() => {
      importMutation.mutate({ categories: buildImportPayload() });
   }, [importMutation, buildImportPayload]);

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
                           {mappedCategories.length}
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
                        Importar {validCount} categoria(s)
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

export function CategoryImportCredenza({
   onSuccess,
}: {
   onSuccess: () => void;
}) {
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
