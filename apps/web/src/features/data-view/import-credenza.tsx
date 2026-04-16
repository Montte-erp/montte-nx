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
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { defineStepper } from "@packages/ui/components/stepper";
import { Button } from "@packages/ui/components/button";
import {
   AlertTriangle,
   ChevronRight,
   FileSpreadsheet,
   FileText,
   Loader2,
} from "lucide-react";
import { Suspense, useTransition, useState } from "react";
import { toast } from "sonner";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import type {
   ImportConfig,
   ImportableColumn,
   ParsedRow,
} from "@/features/data-view/data-table";

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "mapping", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type ImportStepperMethods = ReturnType<typeof useStepper>;
type RawData = { headers: string[]; rows: string[][] };
type ColumnMapping = Record<string, string>;

// =============================================================================
// StepIndicator
// =============================================================================

function StepIndicator({ methods }: { methods: ImportStepperMethods }) {
   const steps = methods.state.all;
   const currentIndex = methods.lookup.getIndex(methods.state.current.data.id);
   return (
      <div className="flex items-center gap-2">
         {steps.map((step, idx) => (
            <div
               key={step.id}
               className={[
                  "h-1 rounded-full transition-all duration-300 flex-1",
                  idx === currentIndex
                     ? "bg-primary"
                     : idx < currentIndex
                       ? "bg-primary/50"
                       : "bg-muted",
               ].join(" ")}
            />
         ))}
      </div>
   );
}

// =============================================================================
// StepLoadingFallback
// =============================================================================

function StepLoadingFallback({ title }: { title: string }) {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{title}</CredenzaTitle>
            <CredenzaDescription>
               Aguarde enquanto processamos...
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <div className="flex items-center justify-center py-12">
               <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
         </CredenzaBody>
      </>
   );
}

// =============================================================================
// guessMapping
// =============================================================================

function guessMapping(
   headers: string[],
   columns: ImportableColumn[],
): ColumnMapping {
   const mapping: ColumnMapping = {};
   const lower = headers.map((h) => h.toLowerCase().trim());
   for (const col of columns) {
      const patterns = [
         col.key.toLowerCase(),
         col.label.toLowerCase(),
         ...col.fieldPatterns.map((p) => p.toLowerCase()),
      ];
      let idx = lower.findIndex((h) => patterns.includes(h));
      if (idx === -1)
         idx = lower.findIndex((h) => patterns.some((p) => h.includes(p)));
      if (idx !== -1) mapping[col.key] = headers[idx] ?? "";
   }
   return mapping;
}

// =============================================================================
// UploadStep
// =============================================================================

function UploadStep({
   methods,
   config,
   columns,
   onReady,
}: {
   methods: ImportStepperMethods;
   config: ImportConfig;
   columns: ImportableColumn[];
   onReady: (raw: RawData) => void;
}) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   function handleTemplateDownload() {
      const headers = columns.map((c) => c.key);
      const exampleRow = Object.fromEntries(columns.map((c) => [c.key, ""]));
      const blob = generateCsv([exampleRow], headers);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modelo-${config.label.toLowerCase().replace(/\s+/g, "-")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
   }

   async function processFile(file: File) {
      setSelectedFile(file);
      setIsParsing(true);
      try {
         const ext = file.name.split(".").pop()?.toLowerCase();
         const data =
            ext === "xlsx" || ext === "xls"
               ? await parseXlsx(file)
               : await parseCsv(file);
         onReady(data);
         methods.navigation.next();
      } catch {
         toast.error("Erro ao processar o arquivo. Verifique o formato.");
         setSelectedFile(undefined);
      } finally {
         setIsParsing(false);
      }
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar {config.label}</CredenzaTitle>
            <CredenzaDescription>
               Importe seus dados via arquivo CSV ou XLSX
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <div className="flex flex-col gap-4 w-full overflow-auto">
               <StepIndicator methods={methods} />
               <Dropzone
                  accept={{
                     "text/csv": [".csv"],
                     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                        [".xlsx"],
                  }}
                  disabled={isParsing}
                  maxFiles={1}
                  onDrop={([file]) => {
                     if (file) processFile(file);
                  }}
                  src={selectedFile ? [selectedFile] : undefined}
               >
                  <DropzoneEmptyState>
                     {isParsing ? (
                        <Loader2 className="size-8 text-primary animate-spin" />
                     ) : (
                        <div className="flex flex-col gap-2 items-center">
                           <FileSpreadsheet className="size-8 text-muted-foreground" />
                           <p className="font-medium text-sm">
                              Arraste e solte ou clique para selecionar
                           </p>
                           <p className="text-xs text-muted-foreground">
                              Suporta arquivos <strong>.CSV</strong> e{" "}
                              <strong>.XLSX</strong>
                           </p>
                           <div className="flex items-center gap-2">
                              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                                 <FileSpreadsheet className="size-3.5 text-emerald-600" />
                                 <span className="text-xs font-medium">
                                    CSV
                                 </span>
                              </div>
                              <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                                 <FileText className="size-3.5 text-blue-600" />
                                 <span className="text-xs font-medium">
                                    XLSX
                                 </span>
                              </div>
                           </div>
                        </div>
                     )}
                  </DropzoneEmptyState>
                  <DropzoneContent />
               </Dropzone>
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               className="w-full"
               onClick={handleTemplateDownload}
               size="sm"
               type="button"
               variant="outline"
            >
               <FileSpreadsheet className="size-4" />
               Baixar modelo CSV
            </Button>
         </CredenzaFooter>
      </>
   );
}

// =============================================================================
// MappingStep
// =============================================================================

function MappingStep({
   methods,
   raw,
   columns,
   mapping,
   onMappingChange,
   onApply,
}: {
   methods: ImportStepperMethods;
   raw: RawData;
   columns: ImportableColumn[];
   mapping: ColumnMapping;
   onMappingChange: (m: ColumnMapping) => void;
   onApply: (rows: ParsedRow[]) => void;
}) {
   const headerOptions = [
      { value: "__none__", label: "— Ignorar —" },
      ...raw.headers.map((h) => ({ value: h, label: h })),
   ];
   const requiredCols = columns.filter((c) => c.required);
   const optionalCols = columns.filter((c) => !c.required);
   const canProceed = requiredCols.every(
      (c) => mapping[c.key] && mapping[c.key] !== "__none__",
   );

   function handleApply() {
      const rows: ParsedRow[] = raw.rows.map((row) =>
         Object.fromEntries(
            columns.map((col) => {
               const header = mapping[col.key];
               if (!header || header === "__none__") return [col.key, ""];
               const idx = raw.headers.indexOf(header);
               return [col.key, idx >= 0 ? (row[idx] ?? "") : ""];
            }),
         ),
      );
      onApply(rows);
      methods.navigation.next();
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Mapear Colunas</CredenzaTitle>
            <CredenzaDescription>
               Relacione as colunas do arquivo com os campos do sistema
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <div className="flex flex-col gap-4">
               <StepIndicator methods={methods} />
               <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b">
                     <p className="text-xs font-medium text-muted-foreground">
                        Prévia do arquivo ({raw.rows.length} linhas encontradas)
                     </p>
                  </div>
                  <div className="overflow-auto max-h-24">
                     <Table>
                        <TableHeader>
                           <TableRow>
                              {raw.headers.map((h) => (
                                 <TableHead
                                    className="text-xs whitespace-nowrap"
                                    key={h}
                                 >
                                    {h}
                                 </TableHead>
                              ))}
                           </TableRow>
                        </TableHeader>
                        <TableBody>
                           {raw.rows.slice(0, 3).map((row, i) => (
                              <TableRow key={`preview-${i + 1}`}>
                                 {row.map((cell, j) => (
                                    <TableCell
                                       className="text-xs whitespace-nowrap"
                                       key={`cell-${i + 1}-${j + 1}`}
                                    >
                                       {cell || "—"}
                                    </TableCell>
                                 ))}
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </div>
               </div>
               {requiredCols.length > 0 && (
                  <div className="grid gap-4 grid-cols-4">
                     {requiredCols.map((col) => (
                        <div className="flex flex-col gap-2" key={col.key}>
                           <label className="text-xs font-medium text-muted-foreground">
                              {col.label}
                              <span className="text-destructive ml-0.5">*</span>
                           </label>
                           <Combobox
                              className="w-full h-8 text-xs"
                              emptyMessage="Nenhuma coluna"
                              onValueChange={(v) =>
                                 onMappingChange({
                                    ...mapping,
                                    [col.key]: v === "__none__" ? "" : v,
                                 })
                              }
                              options={headerOptions}
                              placeholder="Selecionar coluna..."
                              searchPlaceholder="Buscar coluna..."
                              value={mapping[col.key] || "__none__"}
                           />
                        </div>
                     ))}
                  </div>
               )}
               {optionalCols.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                     {optionalCols.map((col) => (
                        <div className="flex flex-col gap-2" key={col.key}>
                           <label className="text-xs font-medium text-muted-foreground">
                              {col.label}
                           </label>
                           <Combobox
                              className="w-full h-8 text-xs"
                              emptyMessage="Nenhuma coluna"
                              onValueChange={(v) =>
                                 onMappingChange({
                                    ...mapping,
                                    [col.key]: v === "__none__" ? "" : v,
                                 })
                              }
                              options={headerOptions}
                              placeholder="— Ignorar —"
                              searchPlaceholder="Buscar coluna..."
                              value={mapping[col.key] || "__none__"}
                           />
                        </div>
                     ))}
                  </div>
               )}
            </div>
         </CredenzaBody>
         <CredenzaFooter>
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
                  onClick={handleApply}
                  type="button"
               >
                  Aplicar mapeamento
                  <ChevronRight className="size-4" />
               </Button>
            </div>
         </CredenzaFooter>
      </>
   );
}

// =============================================================================
// PreviewStep
// =============================================================================

function PreviewStep({
   methods,
   rows,
   columns,
}: {
   methods: ImportStepperMethods;
   rows: ParsedRow[];
   columns: ImportableColumn[];
}) {
   const visibleColumns = columns.filter(
      (c) => c.required || rows.some((r) => r[c.key]),
   );

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Prévia dos Dados</CredenzaTitle>
            <CredenzaDescription>
               {rows.length} linha(s) encontrada(s) no arquivo
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <div className="flex flex-col gap-4 w-full">
               <StepIndicator methods={methods} />
               <div className="overflow-auto max-h-52 rounded-lg border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                           {visibleColumns.map((col) => (
                              <TableHead className="text-xs p-2" key={col.key}>
                                 {col.label}
                              </TableHead>
                           ))}
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {rows.map((row, i) => (
                           <TableRow key={`row-${i + 1}`}>
                              {visibleColumns.map((col) => (
                                 <TableCell
                                    className="p-2 text-xs"
                                    key={col.key}
                                 >
                                    {row[col.key] || (
                                       <span className="text-muted-foreground">
                                          —
                                       </span>
                                    )}
                                 </TableCell>
                              ))}
                           </TableRow>
                        ))}
                        {rows.length === 0 && (
                           <TableRow>
                              <TableCell
                                 className="py-6 text-center text-xs text-muted-foreground"
                                 colSpan={visibleColumns.length}
                              >
                                 Nenhum dado para importar
                              </TableCell>
                           </TableRow>
                        )}
                     </TableBody>
                  </Table>
               </div>
            </div>
         </CredenzaBody>
         <CredenzaFooter>
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
                  disabled={rows.length === 0}
                  onClick={() => methods.navigation.next()}
                  type="button"
               >
                  Continuar
                  <ChevronRight className="size-4" />
               </Button>
            </div>
         </CredenzaFooter>
      </>
   );
}

// =============================================================================
// ConfirmStep
// =============================================================================

function ConfirmStep({
   rows,
   config,
   onClose,
}: {
   rows: ParsedRow[];
   config: ImportConfig;
   onClose: () => void;
}) {
   const [isPending, startTransition] = useTransition();

   function handleImport() {
      startTransition(async () => {
         try {
            const result = await config.onImport(rows);
            toast.success(
               `${result.imported} item(s) importado(s) com sucesso.`,
            );
            onClose();
         } catch (e) {
            toast.error(
               e instanceof Error
                  ? e.message
                  : "Erro ao importar. Tente novamente.",
            );
         }
      });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Confirmar Importação</CredenzaTitle>
            <CredenzaDescription>
               Revise o resumo antes de importar
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <div className="flex flex-col gap-4">
               <div className="rounded-xl border overflow-hidden">
                  <div className="bg-muted/40 px-4 py-2.5 border-b">
                     <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Resumo
                     </p>
                  </div>
                  <div className="divide-y">
                     <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">
                           Total no arquivo
                        </span>
                        <span className="text-sm font-medium">
                           {rows.length}
                        </span>
                     </div>
                     <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                        <span className="text-sm font-medium">
                           Serão importados
                        </span>
                        <span className="text-sm font-bold text-primary">
                           {rows.length}
                        </span>
                     </div>
                  </div>
               </div>
               {rows.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                     <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                     <p className="text-xs text-amber-700">
                        Não há dados para importar.
                     </p>
                  </div>
               )}
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <div className="flex gap-2">
               <Button
                  className="flex-none"
                  disabled={isPending}
                  onClick={onClose}
                  type="button"
                  variant="outline"
               >
                  Cancelar
               </Button>
               <Button
                  className="flex-1"
                  disabled={isPending || rows.length === 0}
                  onClick={handleImport}
                  type="button"
               >
                  {isPending ? (
                     <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Importar {rows.length} item(s)
               </Button>
            </div>
         </CredenzaFooter>
      </>
   );
}

// =============================================================================
// ImportWizard
// =============================================================================

function ImportWizard({
   methods,
   columns,
   config,
   onClose,
}: {
   methods: ImportStepperMethods;
   columns: ImportableColumn[];
   config: ImportConfig;
   onClose: () => void;
}) {
   const currentId = methods.state.current.data.id;
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [mapping, setMapping] = useState<ColumnMapping>(() =>
      Object.fromEntries(columns.map((c) => [c.key, ""])),
   );
   const [rows, setRows] = useState<ParsedRow[]>([]);

   function handleReady(data: RawData) {
      setRawData(data);
      setMapping((prev) => ({
         ...prev,
         ...guessMapping(data.headers, columns),
      }));
   }

   return (
      <>
         {currentId === "upload" && (
            <UploadStep
               columns={columns}
               config={config}
               methods={methods}
               onReady={handleReady}
            />
         )}
         {currentId === "mapping" && rawData && (
            <MappingStep
               columns={columns}
               mapping={mapping}
               methods={methods}
               onApply={setRows}
               onMappingChange={setMapping}
               raw={rawData}
            />
         )}
         {currentId === "preview" && (
            <Suspense
               fallback={<StepLoadingFallback title="Prévia dos Dados" />}
            >
               <PreviewStep columns={columns} methods={methods} rows={rows} />
            </Suspense>
         )}
         {currentId === "confirm" && (
            <Suspense
               fallback={<StepLoadingFallback title="Confirmar Importação" />}
            >
               <ConfirmStep config={config} onClose={onClose} rows={rows} />
            </Suspense>
         )}
      </>
   );
}

// =============================================================================
// ImportCredenza (public export)
// =============================================================================

export function ImportCredenza({
   columns,
   config,
   onClose,
}: {
   columns: ImportableColumn[];
   config: ImportConfig;
   onClose: () => void;
}) {
   return (
      <Stepper.Provider variant="line">
         {({ methods }) => (
            <ImportWizard
               columns={columns}
               config={config}
               methods={methods}
               onClose={onClose}
            />
         )}
      </Stepper.Provider>
   );
}
