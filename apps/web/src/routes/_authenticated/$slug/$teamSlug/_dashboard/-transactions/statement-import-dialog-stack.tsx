import { parseOrThrow as parseCsv } from "@f-o-t/csv";
import { of as moneyOf, format as moneyFormat } from "@f-o-t/money";
import { parseOrThrow as parseOfx, getTransactions } from "@f-o-t/ofx";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
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
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { defineStepper } from "@packages/ui/components/stepper";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import {
   AlertTriangle,
   CheckCircle2,
   ChevronRight,
   FileSpreadsheet,
   FileText,
   Loader2,
} from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";
import { Suspense, useState } from "react";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

dayjs.extend(customParseFormat);

type FileFormat = "csv" | "xlsx" | "ofx";

type ParsedRow = {
   date: string;
   name: string;
   type: "income" | "expense";
   amount: string;
   description: string;
};

type ValidatedRow = ParsedRow & { isValid: boolean; errors: string[] };

type RawData = {
   headers: string[];
   rows: string[][];
};

type ColumnField = "date" | "name" | "type" | "amount" | "description";

type ColumnMapping = Record<ColumnField, string>;

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type StepperMethods = ReturnType<typeof useStepper>;

const FIELD_LABELS: Record<ColumnField, string> = {
   date: "Data *",
   name: "Nome",
   type: "Tipo",
   amount: "Valor *",
   description: "Descrição",
};

const REQUIRED_FIELDS: ColumnField[] = ["date", "amount"];
const COLUMN_FIELDS: ColumnField[] = [
   "date",
   "name",
   "type",
   "amount",
   "description",
];

function parseDate(raw: string): string | null {
   for (const fmt of [
      "YYYY-MM-DD",
      "DD/MM/YYYY",
      "MM/DD/YYYY",
      "DD-MM-YYYY",
      "YYYYMMDD",
   ]) {
      const d = dayjs(raw.trim(), fmt, true);
      if (d.isValid()) return d.format("YYYY-MM-DD");
   }
   return null;
}

function parseAmount(raw: string): string | null {
   const n = Number.parseFloat(
      raw
         .replace(/R\$\s*/g, "")
         .replace(/\./g, "")
         .replace(",", ".")
         .trim(),
   );
   if (Number.isNaN(n)) return null;
   return String(Math.abs(n));
}

function inferType(raw: string, amount: number): "income" | "expense" {
   const t = raw.toLowerCase().trim();
   if (
      t === "receita" ||
      t === "income" ||
      t === "crédito" ||
      t === "credito" ||
      t === "credit"
   )
      return "income";
   if (amount < 0) return "income";
   return "expense";
}

function validateRow(row: ParsedRow): ValidatedRow {
   const errors: string[] = [];
   if (!parseDate(row.date)) errors.push("Data inválida");
   if (!row.amount || parseAmount(row.amount) === null)
      errors.push("Valor inválido");
   return { ...row, isValid: errors.length === 0, errors };
}

function formatMoney(value: string): string {
   const n = Number.parseFloat(value);
   if (Number.isNaN(n)) return value;
   return moneyFormat(moneyOf(n, "BRL"), "pt-BR");
}

function parseXlsxToRaw(buffer: ArrayBuffer): RawData {
   const wb = xlsxRead(buffer, { type: "array" });
   const ws = wb.Sheets[wb.SheetNames[0]];
   if (!ws) throw new Error("Planilha vazia");
   const data = xlsxUtils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: "",
   });
   if (data.length < 2) throw new Error("Planilha sem dados");
   return {
      headers: data[0].map(String),
      rows: data
         .slice(1)
         .filter((r) => r.some((c) => String(c).trim() !== ""))
         .map((r) => r.map(String)),
   };
}

function guessMapping(headers: string[]): Partial<ColumnMapping> {
   const lower = headers.map((h) => h.toLowerCase().trim());
   const patterns: Record<ColumnField, string[]> = {
      date: ["data", "date", "dt", "data_lancamento"],
      name: ["nome", "name", "historico", "memo", "descricao"],
      type: ["tipo", "type", "natureza", "operacao"],
      amount: ["valor", "value", "amount", "montante", "vlr"],
      description: ["descricao", "description", "obs", "complemento"],
   };
   const mapping: Partial<ColumnMapping> = {};
   for (const field of COLUMN_FIELDS) {
      const candidates = patterns[field];
      const idx = lower.findIndex((h) => candidates.some((c) => h.includes(c)));
      if (idx !== -1) mapping[field] = headers[idx];
   }
   return mapping;
}

function applyMapping(
   row: string[],
   headers: string[],
   mapping: ColumnMapping,
): ParsedRow {
   const get = (field: ColumnField): string => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx !== -1 ? (row[idx] ?? "") : "";
   };

   const rawAmount = get("amount");
   const numericAmount = Number.parseFloat(
      rawAmount.replace(/[^\d.,-]/g, "").replace(",", "."),
   );
   const rawType = get("type");

   return {
      date: get("date"),
      name: get("name"),
      type: inferType(rawType, numericAmount),
      amount: rawAmount,
      description: get("description"),
   };
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
                       ? "bg-primary/50"
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
   onFileReady: (
      rows: ValidatedRow[],
      format: FileFormat,
      raw: RawData | null,
   ) => void;
}

function UploadStep({ methods, onFileReady }: UploadStepProps) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();

   function processFile(file: File) {
      setSelectedFile(file);
      setIsParsing(true);

      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "ofx") {
         const reader = new FileReader();
         reader.onload = (ev) => {
            try {
               const content = ev.target?.result;
               if (typeof content !== "string") throw new Error("read error");
               const ofxDoc = parseOfx(content);
               const txs = getTransactions(ofxDoc);
               const rows: ValidatedRow[] = txs.map((tx) => {
                  const amount = Math.abs(tx.TRNAMT);
                  const type: "income" | "expense" =
                     tx.TRNAMT >= 0 ? "income" : "expense";
                  const rawDate = tx.DTPOSTED.raw.slice(0, 8);
                  const date = parseDate(rawDate) ?? rawDate;
                  const parsed: ParsedRow = {
                     date,
                     name: tx.NAME ?? tx.MEMO ?? "",
                     type,
                     amount: String(amount),
                     description: tx.MEMO ?? "",
                  };
                  return validateRow(parsed);
               });
               onFileReady(rows, "ofx", null);
               methods.navigation.goTo("preview");
            } catch {
               toast.error("Erro ao processar arquivo OFX.");
               setSelectedFile(undefined);
            } finally {
               setIsParsing(false);
            }
         };
         reader.readAsText(file, "utf-8");
         return;
      }

      if (ext === "xlsx" || ext === "xls") {
         const reader = new FileReader();
         reader.onload = (ev) => {
            try {
               const buffer = ev.target?.result;
               if (!(buffer instanceof ArrayBuffer))
                  throw new Error("read error");
               const raw = parseXlsxToRaw(buffer);
               onFileReady([], "xlsx", raw);
               methods.navigation.next();
            } catch {
               toast.error("Erro ao processar planilha XLSX.");
               setSelectedFile(undefined);
            } finally {
               setIsParsing(false);
            }
         };
         reader.readAsArrayBuffer(file);
         return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
         try {
            const content = ev.target?.result;
            if (typeof content !== "string") throw new Error("read error");
            const doc = parseCsv(content);
            const headers = doc.headers ?? [];
            const rows = doc.rows.map((r) => r.fields);
            onFileReady([], "csv", { headers, rows });
            methods.navigation.next();
         } catch {
            toast.error("Erro ao processar arquivo CSV.");
            setSelectedFile(undefined);
         } finally {
            setIsParsing(false);
         }
      };
      reader.readAsText(file, "utf-8");
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar Extrato</CredenzaTitle>
            <CredenzaDescription>
               Importe seu extrato bancário via CSV, XLSX ou OFX
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
                     "application/x-ofx": [".ofx"],
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
                        <>
                           <FileSpreadsheet className="size-8 text-muted-foreground" />
                           <p className="font-medium text-sm">
                              Arraste e solte ou clique para selecionar
                           </p>
                           <p className="text-xs text-muted-foreground">
                              Suporta <strong>.CSV</strong>,{" "}
                              <strong>.XLSX</strong> e <strong>.OFX</strong>
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

               <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
                     <p className="text-xs font-medium">CSV / XLSX</p>
                     <p className="text-xs text-muted-foreground">
                        Mapeie as colunas no próximo passo
                     </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
                     <p className="text-xs font-medium">OFX</p>
                     <p className="text-xs text-muted-foreground">
                        Mapeamento automático — vai direto à prévia
                     </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
                     <p className="text-xs font-medium">Dados</p>
                     <p className="text-xs text-muted-foreground">
                        Data, valor, tipo e descrição
                     </p>
                  </div>
               </div>
            </div>
         </CredenzaBody>
      </>
   );
}

interface MapStepProps {
   methods: StepperMethods;
   raw: RawData;
   mapping: ColumnMapping;
   onMappingChange: (m: ColumnMapping) => void;
   onApply: (rows: ValidatedRow[]) => void;
}

function MapStep({
   methods,
   raw,
   mapping,
   onMappingChange,
   onApply,
}: MapStepProps) {
   const canProceed = REQUIRED_FIELDS.every((f) => mapping[f] !== "");

   function handleNext() {
      const mapped = raw.rows.map((r) =>
         validateRow(applyMapping(r, raw.headers, mapping)),
      );
      onApply(mapped);
      methods.navigation.next();
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Mapear Colunas</CredenzaTitle>
            <CredenzaDescription>
               Associe as colunas do arquivo aos campos
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex flex-col gap-2">
                  {COLUMN_FIELDS.map((field) => (
                     <div className="flex items-center gap-4" key={field}>
                        <span className="text-sm font-medium w-28 shrink-0">
                           {FIELD_LABELS[field]}
                        </span>
                        <div className="flex-1">
                           <Combobox
                              options={[
                                 { value: "__none__", label: "— Não mapear —" },
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
                        </div>
                     </div>
                  ))}
               </div>

               <p className="text-xs text-muted-foreground">
                  {raw.rows.length} linha(s) · Colunas: {raw.headers.join(", ")}
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
}

function PreviewStep({ methods, rows }: PreviewStepProps) {
   const validCount = rows.filter((r) => r.isValid).length;
   const invalidCount = rows.filter((r) => !r.isValid).length;
   const previewRows = rows.slice(0, 15);

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Prévia do Extrato</CredenzaTitle>
            <CredenzaDescription>
               {rows.length} transação(ões) encontrada(s)
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex items-center gap-2">
                  <Badge variant="default">{validCount} válida(s)</Badge>
                  {invalidCount > 0 && (
                     <Badge variant="destructive">
                        {invalidCount} com erro(s)
                     </Badge>
                  )}
               </div>

               <div className="max-h-72 overflow-auto rounded-lg border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead className="text-xs">Data</TableHead>
                           <TableHead className="text-xs">Nome</TableHead>
                           <TableHead className="text-xs">Tipo</TableHead>
                           <TableHead className="text-xs">Valor</TableHead>
                           <TableHead className="text-xs w-10" />
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {previewRows.map((row, i) => (
                           <TableRow
                              className={row.isValid ? "" : "bg-destructive/5"}
                              key={`prev-${i + 1}`}
                           >
                              <TableCell className="text-xs">
                                 {row.date}
                              </TableCell>
                              <TableCell className="text-xs max-w-32 truncate">
                                 {row.name || "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                 {row.type === "income" ? "Entrada" : "Saída"}
                              </TableCell>
                              <TableCell className="text-xs">
                                 {formatMoney(row.amount)}
                              </TableCell>
                              <TableCell className="text-xs">
                                 {row.isValid ? (
                                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                                 ) : (
                                    <AlertTriangle className="size-3.5 text-destructive" />
                                 )}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>

               {rows.length > 15 && (
                  <p className="text-xs text-muted-foreground text-center">
                     Mostrando 15 de {rows.length}
                  </p>
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

interface ConfirmStepInnerProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
   format: FileFormat;
   onClose?: () => void;
}

function ConfirmStepInner({
   methods,
   rows,
   format,
   onClose,
}: ConfirmStepInnerProps) {
   const validRows = rows.filter((r) => r.isValid);
   const invalidCount = rows.filter((r) => !r.isValid).length;

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const [bankAccountId, setBankAccountId] = useState<string>("");

   const importMutation = useMutation(
      orpc.transactions.importStatement.mutationOptions({}),
   );

   async function handleImport() {
      if (!bankAccountId) {
         toast.error("Selecione uma conta bancária.");
         return;
      }

      await importMutation.mutateAsync({
         bankAccountId,
         format,
         transactions: validRows.map((r) => ({
            name: r.name || undefined,
            type: r.type,
            amount: parseAmount(r.amount) ?? r.amount,
            date: parseDate(r.date) ?? r.date,
            description: r.description || undefined,
         })),
      });

      toast.success(
         `${validRows.length} transação(ões) importada(s) com sucesso.`,
      );
      onClose?.();
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Confirmar Importação</CredenzaTitle>
            <CredenzaDescription>
               Selecione a conta e confirme
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                     Conta bancária <span className="text-destructive">*</span>
                  </label>
                  <Combobox
                     options={(bankAccounts ?? []).map(
                        (a: { id: string; name: string }) => ({
                           value: a.id,
                           label: a.name,
                        }),
                     )}
                     onValueChange={setBankAccountId}
                     placeholder="Selecionar conta..."
                     value={bankAccountId}
                  />
               </div>

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
                              Com erro
                           </span>
                           <Badge variant="destructive">{invalidCount}</Badge>
                        </div>
                     )}
                     <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                        <span className="text-sm font-medium">
                           Serão importadas
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
                        validRows.length === 0 ||
                        !bankAccountId
                     }
                     onClick={handleImport}
                     type="button"
                  >
                     <span className="flex items-center gap-2">
                        {importMutation.isPending && (
                           <Loader2 className="size-4 animate-spin" />
                        )}
                        Importar {validRows.length} transação(ões)
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
   rows,
   format,
   onClose,
}: ConfirmStepInnerProps) {
   return (
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
            <ConfirmStepInner
               format={format}
               methods={methods}
               rows={rows}
               onClose={onClose}
            />
         </Suspense>
      </ErrorBoundary>
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
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [rows, setRows] = useState<ValidatedRow[]>([]);
   const [format, setFormat] = useState<FileFormat>("csv");
   const [mapping, setMapping] = useState<ColumnMapping>({
      date: "",
      name: "",
      type: "",
      amount: "",
      description: "",
   });

   function handleFileReady(
      parsedRows: ValidatedRow[],
      fmt: FileFormat,
      raw: RawData | null,
   ) {
      setFormat(fmt);
      if (raw) {
         setRawData(raw);
         const guessed = guessMapping(raw.headers);
         setMapping((prev) => ({ ...prev, ...guessed }));
      }
      if (parsedRows.length > 0) setRows(parsedRows);
   }

   return (
      <>
         {currentId === "upload" && (
            <UploadStep methods={methods} onFileReady={handleFileReady} />
         )}
         {currentId === "map" && rawData && (
            <MapStep
               mapping={mapping}
               methods={methods}
               raw={rawData}
               onApply={setRows}
               onMappingChange={setMapping}
            />
         )}
         {currentId === "preview" && (
            <PreviewStep methods={methods} rows={rows} />
         )}
         {currentId === "confirm" && (
            <ConfirmStep
               format={format}
               methods={methods}
               rows={rows}
               onClose={onClose}
            />
         )}
      </>
   );
}

export function StatementImportDialogStack({
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
