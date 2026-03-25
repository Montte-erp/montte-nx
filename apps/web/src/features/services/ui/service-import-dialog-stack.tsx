import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
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
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation } from "@tanstack/react-query";
import {
   AlertTriangle,
   CheckCircle2,
   ChevronRight,
   FileSpreadsheet,
   Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "mapping", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type ImportStepperMethods = ReturnType<typeof useStepper>;

type ServiceField = "name" | "description" | "basePrice";

type ColumnMapping = Record<ServiceField, string>;

type RawCsvData = {
   headers: string[];
   rows: string[][];
};

type MappedRow = {
   name: string;
   description: string;
   basePrice: string;
};

type ValidatedRow = MappedRow & {
   isValid: boolean;
   errors: string[];
   priceCents: number | null;
};

const FIELD_LABELS: Record<ServiceField, string> = {
   name: "Nome *",
   description: "Descrição",
   basePrice: "Preço padrão *",
};

const SERVICE_FIELDS: ServiceField[] = ["name", "description", "basePrice"];

const EMPTY_MAPPING: ColumnMapping = {
   name: "",
   description: "",
   basePrice: "",
};

function parsePriceToCents(raw: string): number | null {
   const cleaned = raw
      .replace(/R\$\s*/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();
   const num = Number.parseFloat(cleaned);
   if (Number.isNaN(num)) return null;
   return Math.round(num * 100);
}

function parseCsvContent(content: string): RawCsvData {
   const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
   if (lines.length === 0) return { headers: [], rows: [] };

   const parseRow = (line: string): string[] => {
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
         const char = line[i];
         if (inQuotes) {
            if (char === '"') {
               if (line[i + 1] === '"') {
                  current += '"';
                  i++;
               } else {
                  inQuotes = false;
               }
            } else {
               current += char;
            }
         } else if (char === '"') {
            inQuotes = true;
         } else if (char === "," || char === ";") {
            fields.push(current.trim());
            current = "";
         } else {
            current += char;
         }
      }
      fields.push(current.trim());
      return fields;
   };

   const headers = parseRow(lines[0]);
   const rows = lines.slice(1).map(parseRow);

   return { headers, rows };
}

function guessMapping(headers: string[]): Partial<ColumnMapping> {
   const mapping: Partial<ColumnMapping> = {};
   const lower = headers.map((h) => h.toLowerCase().trim());

   const patterns: Record<ServiceField, string[]> = {
      name: ["nome", "name", "servico", "serviço", "titulo", "título"],
      description: ["descricao", "descrição", "description", "obs", "detalhe"],
      basePrice: ["preco", "preço", "price", "valor", "value", "preco_padrao"],
   };

   for (const [field, candidates] of Object.entries(patterns)) {
      const idx = lower.findIndex((h) => candidates.some((c) => h.includes(c)));
      if (idx !== -1) {
         mapping[field as ServiceField] = headers[idx];
      }
   }

   return mapping;
}

function applyMapping(
   row: string[],
   headers: string[],
   mapping: ColumnMapping,
): MappedRow {
   const get = (field: ServiceField): string => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx !== -1 ? (row[idx] ?? "") : "";
   };

   return {
      name: get("name"),
      description: get("description"),
      basePrice: get("basePrice"),
   };
}

function validateRow(row: MappedRow): ValidatedRow {
   const errors: string[] = [];
   const priceCents = row.basePrice ? parsePriceToCents(row.basePrice) : 0;

   if (!row.name.trim()) errors.push("Nome obrigatório");
   if (row.basePrice && priceCents === null) errors.push("Preço inválido");

   return {
      ...row,
      isValid: errors.length === 0,
      errors,
      priceCents: priceCents ?? null,
   };
}

function StepIndicator({ methods }: { methods: ImportStepperMethods }) {
   const steps = methods.state.all;
   const currentIndex = methods.lookup.getIndex(methods.state.current.data.id);

   return (
      <div className="flex items-center gap-2 mb-1">
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
   methods: ImportStepperMethods;
   onFileReady: (rawCsv: RawCsvData) => void;
}

function UploadStep({ methods, onFileReady }: UploadStepProps) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();

   function handleTemplateDownload() {
      const csv =
         'Nome,Descrição,Preço padrão,Categoria\nConsultoria,Consultoria mensal,"R$ 1.500,00",Serviços';
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo-servicos.csv";
      a.click();
      URL.revokeObjectURL(url);
   }

   function processFile(file: File) {
      setSelectedFile(file);
      setIsParsing(true);

      const reader = new FileReader();
      reader.onload = (ev) => {
         try {
            const content = ev.target?.result as string;
            const rawCsv = parseCsvContent(content);
            if (rawCsv.headers.length === 0) {
               toast.error("Arquivo CSV vazio ou inválido.");
               setSelectedFile(undefined);
               return;
            }
            onFileReady(rawCsv);
            methods.navigation.next();
         } catch {
            toast.error("Erro ao processar o arquivo. Verifique o formato.");
            setSelectedFile(undefined);
         } finally {
            setIsParsing(false);
         }
      };
      reader.readAsText(file, "utf-8");
   }

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Importar Serviços</DialogStackTitle>
            <DialogStackDescription>
               Importe serviços via arquivo CSV
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4 w-full overflow-auto">
               <StepIndicator methods={methods} />

               <Dropzone
                  accept={{ "text/csv": [".csv"] }}
                  disabled={isParsing}
                  maxFiles={1}
                  onDrop={([file]) => {
                     if (file) processFile(file);
                  }}
                  src={selectedFile ? [selectedFile] : undefined}
               >
                  <DropzoneEmptyState>
                     {isParsing ? (
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                     ) : (
                        <FileSpreadsheet className="size-8 text-muted-foreground" />
                     )}
                     <p className="text-sm font-medium mt-2">
                        {isParsing
                           ? "Processando arquivo..."
                           : "Arraste um arquivo CSV ou clique para selecionar"}
                     </p>
                     <p className="text-xs text-muted-foreground mt-1">
                        Formato aceito: .csv
                     </p>
                  </DropzoneEmptyState>
                  <DropzoneContent />
               </Dropzone>

               <Button
                  className="w-full"
                  onClick={handleTemplateDownload}
                  size="sm"
                  type="button"
                  variant="outline"
               >
                  Baixar modelo CSV
               </Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

interface MappingStepProps {
   methods: ImportStepperMethods;
   rawCsv: RawCsvData;
   mapping: ColumnMapping;
   onMappingChange: (mapping: ColumnMapping) => void;
   onApply: (rows: MappedRow[]) => void;
}

function MappingStep({
   methods,
   rawCsv,
   mapping,
   onMappingChange,
   onApply,
}: MappingStepProps) {
   const canProceed = mapping.name !== "" && mapping.basePrice !== "";

   function handleNext() {
      const mapped = rawCsv.rows.map((row) =>
         applyMapping(row, rawCsv.headers, mapping),
      );
      onApply(mapped);
      methods.navigation.next();
   }

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Mapear Colunas</DialogStackTitle>
            <DialogStackDescription>
               Associe cada coluna do CSV a um campo do serviço
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4 w-full overflow-auto">
               <StepIndicator methods={methods} />

               <div className="flex flex-col gap-2">
                  {SERVICE_FIELDS.map((field) => (
                     <div
                        className="flex items-center justify-between gap-2"
                        key={field}
                     >
                        <span className="text-sm font-medium min-w-[120px]">
                           {FIELD_LABELS[field]}
                        </span>
                        <Select
                           onValueChange={(v) =>
                              onMappingChange({
                                 ...mapping,
                                 [field]: v === "__none__" ? "" : v,
                              })
                           }
                           value={mapping[field] || "__none__"}
                        >
                           <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecionar coluna..." />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="__none__">
                                 — Não mapear —
                              </SelectItem>
                              {rawCsv.headers.map((header) => (
                                 <SelectItem key={header} value={header}>
                                    {header}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>
                  ))}
               </div>

               <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                     Colunas detectadas: {rawCsv.headers.join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                     {rawCsv.rows.length} linha(s) de dados
                  </p>
               </div>
            </div>
         </div>

         <div className="border-t px-4 py-4">
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
                  Continuar
                  <ChevronRight className="ml-1 size-4" />
               </Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

interface PreviewStepProps {
   methods: ImportStepperMethods;
   rows: MappedRow[];
}

function PreviewStep({ methods, rows }: PreviewStepProps) {
   const validated = rows.map(validateRow);
   const validCount = validated.filter((r) => r.isValid).length;
   const invalidCount = validated.filter((r) => !r.isValid).length;
   const previewRows = validated.slice(0, 10);

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Prévia dos Serviços</DialogStackTitle>
            <DialogStackDescription>
               {rows.length} serviço(s) encontrado(s) no arquivo
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4 w-full overflow-auto">
               <StepIndicator methods={methods} />

               <div className="flex items-center gap-2">
                  <Badge variant="default">{validCount} válido(s)</Badge>
                  {invalidCount > 0 && (
                     <Badge variant="destructive">
                        {invalidCount} com erro(s)
                     </Badge>
                  )}
               </div>

               <div className="max-h-[300px] overflow-auto rounded-lg border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead className="text-xs">Nome</TableHead>
                           <TableHead className="text-xs">Descrição</TableHead>
                           <TableHead className="text-xs">Preço</TableHead>
                           <TableHead className="text-xs w-[80px]">
                              Status
                           </TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {previewRows.map((row, idx) => (
                           <TableRow
                              className={row.isValid ? "" : "bg-destructive/5"}
                              key={`preview-${idx + 1}`}
                           >
                              <TableCell className="text-xs">
                                 {row.name || (
                                    <span className="text-destructive italic">
                                       vazio
                                    </span>
                                 )}
                              </TableCell>
                              <TableCell className="text-xs max-w-[150px] truncate">
                                 {row.description || "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                 {row.basePrice || "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                 {row.isValid ? (
                                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                                 ) : (
                                    <span className="flex items-center gap-1 text-destructive">
                                       <AlertTriangle className="size-3.5" />
                                       <span className="text-[10px]">
                                          {row.errors[0]}
                                       </span>
                                    </span>
                                 )}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>

               {rows.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                     Mostrando 10 de {rows.length} linhas
                  </p>
               )}
            </div>
         </div>

         <div className="border-t px-4 py-4">
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
                  Continuar
                  <ChevronRight className="ml-1 size-4" />
               </Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

interface ConfirmStepProps {
   methods: ImportStepperMethods;
   rows: MappedRow[];
   onClose?: () => void;
}

function ConfirmStep({ methods, rows, onClose }: ConfirmStepProps) {
   const validated = rows.map(validateRow);
   const validRows = validated.filter((r) => r.isValid);
   const invalidCount = validated.filter((r) => !r.isValid).length;

   const createServiceMutation = useMutation(
      orpc.services.create.mutationOptions({}),
   );

   const [isImporting, setIsImporting] = useState(false);

   async function handleImport() {
      if (validRows.length === 0) return;

      setIsImporting(true);
      try {
         const results = await Promise.allSettled(
            validRows.map((row) =>
               createServiceMutation.mutateAsync({
                  name: row.name.trim(),
                  description: row.description.trim() || null,
                  basePrice:
                     row.priceCents != null
                        ? String(row.priceCents / 100)
                        : "0",
               }),
            ),
         );
         const succeeded = results.filter(
            (r) => r.status === "fulfilled",
         ).length;
         const failed = results.filter((r) => r.status === "rejected").length;
         if (failed === 0) {
            toast.success(`${succeeded} serviço(s) importado(s) com sucesso.`);
         } else {
            toast.warning(
               `${succeeded} importado(s), ${failed} falhou. Tente novamente para os itens com erro.`,
            );
         }
         if (succeeded > 0) onClose?.();
      } finally {
         setIsImporting(false);
      }
   }

   const isLoading = isImporting;

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Confirmar Importação</DialogStackTitle>
            <DialogStackDescription>
               Revise o resumo antes de importar
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4 w-full overflow-auto">
               <StepIndicator methods={methods} />

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

                     {invalidCount > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                           <span className="text-sm text-muted-foreground">
                              Linhas com erro
                           </span>
                           <Badge className="text-xs" variant="destructive">
                              {invalidCount}
                           </Badge>
                        </div>
                     )}

                     <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                        <span className="text-sm font-medium">
                           Serão importados
                        </span>
                        <span className="text-sm font-bold text-primary">
                           {validRows.length}
                        </span>
                     </div>
                  </div>
               </div>

               {validRows.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                     <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                     <p className="text-xs text-amber-700">
                        Não há serviços válidos para importar.
                     </p>
                  </div>
               )}
            </div>
         </div>

         <div className="border-t px-4 py-4">
            <div className="flex gap-2">
               <Button
                  className="flex-none"
                  disabled={isLoading}
                  onClick={() => methods.navigation.prev()}
                  type="button"
                  variant="outline"
               >
                  Voltar
               </Button>
               <Button
                  className="flex-1"
                  disabled={isLoading || validRows.length === 0}
                  onClick={handleImport}
                  type="button"
               >
                  {isLoading ? (
                     <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Importar {validRows.length} serviço(s)
               </Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

export function ServiceImportDialogStack({
   onClose,
}: {
   onClose?: () => void;
}) {
   return (
      <Stepper.Provider variant="line">
         {({ methods }) => <ImportWizard methods={methods} onClose={onClose} />}
      </Stepper.Provider>
   );
}

function ImportWizard({
   methods,
   onClose,
}: {
   methods: ImportStepperMethods;
   onClose?: () => void;
}) {
   const currentId = methods.state.current.data.id;

   const [rawCsv, setRawCsv] = useState<RawCsvData | null>(null);
   const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
   const [columnMapping, setColumnMapping] =
      useState<ColumnMapping>(EMPTY_MAPPING);

   function handleFileReady(csv: RawCsvData) {
      setRawCsv(csv);
      const guessed = guessMapping(csv.headers);
      setColumnMapping((prev) => ({ ...prev, ...guessed }));
   }

   function handleMappingApply(rows: MappedRow[]) {
      setMappedRows(rows);
   }

   return (
      <>
         {currentId === "upload" && (
            <UploadStep methods={methods} onFileReady={handleFileReady} />
         )}

         {currentId === "mapping" && rawCsv && (
            <MappingStep
               mapping={columnMapping}
               methods={methods}
               onApply={handleMappingApply}
               onMappingChange={setColumnMapping}
               rawCsv={rawCsv}
            />
         )}

         {currentId === "preview" && (
            <PreviewStep methods={methods} rows={mappedRows} />
         )}

         {currentId === "confirm" && (
            <ConfirmStep
               methods={methods}
               rows={mappedRows}
               onClose={onClose}
            />
         )}
      </>
   );
}
