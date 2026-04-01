import { parseOrThrow as parseOfxOrThrow, getTransactions } from "@f-o-t/ofx";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
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
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
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
import { Suspense, useState, useTransition } from "react";
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

function parseXlsx(buffer: ArrayBuffer): RawData {
   const wb = xlsxRead(buffer, { type: "array" });
   const ws = wb.Sheets[wb.SheetNames[0]];
   if (!ws) throw new Error("Planilha vazia");
   const data = xlsxUtils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: "",
   }) as string[][];
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
   for (const [field, candidates] of Object.entries(patterns)) {
      const idx = lower.findIndex((h) => candidates.some((c) => h.includes(c)));
      if (idx !== -1) mapping[field as ColumnField] = headers[idx];
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

function formatCurrency(value: string): string {
   const num = Number(value);
   if (Number.isNaN(num)) return value;
   return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
   }).format(num);
}

function StepBar({ methods }: { methods: StepperMethods }) {
   const steps = methods.state.all;
   const current = methods.lookup.getIndex(methods.state.current.data.id);
   return (
      <div className="flex items-center gap-2 mb-1">
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

function StepLoadingFallback({ title }: { title: string }) {
   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>{title}</DialogStackTitle>
            <DialogStackDescription>
               Aguarde enquanto processamos...
            </DialogStackDescription>
         </DialogStackHeader>
         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex items-center justify-center py-12">
               <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
         </div>
      </DialogStackContent>
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
               const ofxDoc = parseOfxOrThrow(content);
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
               const raw = parseXlsx(buffer);
               onFileReady([], "xlsx", raw);
               methods.navigation.next();
            } catch {
               toast.error("Erro ao processar planilha.");
               setSelectedFile(undefined);
            } finally {
               setIsParsing(false);
            }
         };
         reader.readAsArrayBuffer(file);
         return;
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
         try {
            const content = ev.target?.result;
            if (typeof content !== "string") throw new Error("read error");
            const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
            if (lines.length < 2) throw new Error("Arquivo sem dados");
            const detectDelimiter = (line: string): string => {
               const counts = {
                  ";": (line.match(/;/g) ?? []).length,
                  ",": (line.match(/,/g) ?? []).length,
                  "\t": (line.match(/\t/g) ?? []).length,
               };
               return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
            };
            const delimiter = detectDelimiter(lines[0]);
            const splitLine = (line: string): string[] =>
               line.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
            const headers = splitLine(lines[0]);
            const rows = lines.slice(1).map(splitLine);
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
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Importar Extrato</DialogStackTitle>
            <DialogStackDescription>
               Importe seu extrato bancário via arquivo CSV, XLSX ou OFX
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4 w-full overflow-auto">
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
                  <div className="rounded-lg border bg-muted/30 p-3">
                     <p className="text-xs font-medium mb-0.5">CSV / XLSX</p>
                     <p className="text-xs text-muted-foreground">
                        Mapeie as colunas no próximo passo
                     </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                     <p className="text-xs font-medium mb-0.5">OFX</p>
                     <p className="text-xs text-muted-foreground">
                        Mapeamento automático — vai direto à prévia
                     </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                     <p className="text-xs font-medium mb-0.5">Dados</p>
                     <p className="text-xs text-muted-foreground">
                        Data, valor, tipo e descrição
                     </p>
                  </div>
               </div>
            </div>
         </div>
      </DialogStackContent>
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
   const { headers, rows } = raw;

   const headerOptions = [
      { value: "__none__", label: "— Ignorar —" },
      ...headers.map((h) => ({ value: h, label: h })),
   ];

   const previewRows = rows.slice(0, 3);

   function canProceed(): boolean {
      return REQUIRED_FIELDS.every(
         (f) => mapping[f] && mapping[f] !== "__none__",
      );
   }

   function handleApply() {
      const parsed = rows.map((row) =>
         validateRow(applyMapping(row, headers, mapping)),
      );
      onApply(parsed);
      methods.navigation.next();
   }

   const allFields = Object.keys(FIELD_LABELS) as ColumnField[];
   const requiredFields = REQUIRED_FIELDS;
   const optionalFields = allFields.filter((f) => !requiredFields.includes(f));

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Mapear Colunas</DialogStackTitle>
            <DialogStackDescription>
               Relacione as colunas do arquivo com os campos do sistema
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="rounded-lg border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 border-b">
                     <p className="text-xs font-medium text-muted-foreground">
                        Prévia ({rows.length} linhas)
                     </p>
                  </div>
                  <div className="overflow-auto max-h-24">
                     <Table>
                        <TableHeader>
                           <TableRow>
                              {headers.map((h) => (
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
                           {previewRows.map((row, i) => (
                              <TableRow key={`prev-${i + 1}`}>
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

               <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                     {requiredFields.map((field) => (
                        <div className="flex flex-col gap-2" key={field}>
                           <label className="text-xs font-medium text-muted-foreground">
                              {FIELD_LABELS[field].replace(" *", "")}
                              <span className="text-destructive ml-0.5">*</span>
                           </label>
                           <Combobox
                              className="w-full h-8 text-xs"
                              emptyMessage="Nenhuma coluna"
                              onValueChange={(v) =>
                                 onMappingChange({
                                    ...mapping,
                                    [field]: v === "__none__" ? "" : v,
                                 })
                              }
                              options={headerOptions}
                              placeholder="Selecionar coluna..."
                              searchPlaceholder="Buscar coluna..."
                              value={mapping[field] || "__none__"}
                           />
                        </div>
                     ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                     {optionalFields.map((field) => (
                        <div className="flex flex-col gap-2" key={field}>
                           <label className="text-xs font-medium text-muted-foreground">
                              {FIELD_LABELS[field].replace(" *", "")}
                           </label>
                           <Combobox
                              className="w-full h-8 text-xs"
                              emptyMessage="Nenhuma coluna"
                              onValueChange={(v) =>
                                 onMappingChange({
                                    ...mapping,
                                    [field]: v === "__none__" ? "" : v,
                                 })
                              }
                              options={headerOptions}
                              placeholder="— Ignorar —"
                              searchPlaceholder="Buscar coluna..."
                              value={mapping[field] || "__none__"}
                           />
                        </div>
                     ))}
                  </div>
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
                  disabled={!canProceed()}
                  onClick={handleApply}
                  type="button"
               >
                  Aplicar mapeamento
                  <ChevronRight className="size-4 ml-1" />
               </Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

interface PreviewStepProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
}

function PreviewStep({ methods, rows }: PreviewStepProps) {
   const previewRows = rows.slice(0, 15);
   const invalidCount = rows.filter((r) => !r.isValid).length;

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Prévia do Extrato</DialogStackTitle>
            <DialogStackDescription>
               {rows.length} transação(ões) encontrada(s)
               {invalidCount > 0 ? ` — ${invalidCount} com erros` : ""}
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               {invalidCount > 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                     <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                     <p className="text-xs text-amber-700">
                        {invalidCount} linha(s) com dados inválidos serão
                        ignoradas na importação.
                     </p>
                  </div>
               )}

               <div className="overflow-auto max-h-64 rounded-lg border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead className="w-6 p-2" />
                           <TableHead className="text-xs p-2">Data</TableHead>
                           <TableHead className="text-xs p-2">Nome</TableHead>
                           <TableHead className="text-xs p-2">Tipo</TableHead>
                           <TableHead className="p-2 text-right text-xs">
                              Valor
                           </TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {previewRows.map((row, index) => (
                           <TableRow
                              className={row.isValid ? "" : "opacity-50"}
                              key={`row-${index + 1}`}
                           >
                              <TableCell className="w-6 p-2">
                                 {row.isValid ? (
                                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                                 ) : (
                                    <AlertTriangle className="size-3.5 text-amber-500" />
                                 )}
                              </TableCell>
                              <TableCell className="p-2 text-xs whitespace-nowrap">
                                 {row.date}
                              </TableCell>
                              <TableCell className="max-w-32 truncate p-2 text-xs">
                                 {row.name || (
                                    <span className="text-muted-foreground">
                                       —
                                    </span>
                                 )}
                              </TableCell>
                              <TableCell className="p-2 text-xs">
                                 <span
                                    className={
                                       row.type === "income"
                                          ? "text-emerald-600"
                                          : "text-red-500"
                                    }
                                 >
                                    {row.type === "income"
                                       ? "Receita"
                                       : "Despesa"}
                                 </span>
                              </TableCell>
                              <TableCell className="p-2 text-right font-mono text-xs">
                                 {parseAmount(row.amount) !== null
                                    ? formatCurrency(
                                         parseAmount(row.amount) ?? "0",
                                      )
                                    : row.amount}
                              </TableCell>
                           </TableRow>
                        ))}
                        {rows.length > 15 && (
                           <TableRow>
                              <TableCell
                                 className="py-2 text-center text-xs text-muted-foreground"
                                 colSpan={5}
                              >
                                 +{rows.length - 15} mais transações não
                                 exibidas
                              </TableCell>
                           </TableRow>
                        )}
                        {rows.length === 0 && (
                           <TableRow>
                              <TableCell
                                 className="py-6 text-center text-xs text-muted-foreground"
                                 colSpan={5}
                              >
                                 Nenhuma transação encontrada
                              </TableCell>
                           </TableRow>
                        )}
                     </TableBody>
                  </Table>
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
                  disabled={rows.filter((r) => r.isValid).length === 0}
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

interface ConfirmStepInnerProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
   format: FileFormat;
   onSuccess: () => void;
}

function ConfirmStepInner({
   methods,
   rows,
   format,
   onSuccess,
}: ConfirmStepInnerProps) {
   const [bankAccountId, setBankAccountId] = useState("");
   const [isPending, startTransition] = useTransition();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const bankAccountOptions = bankAccounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
   }));

   const validRows = rows.filter((r) => r.isValid);
   const selectedAccount = bankAccounts.find((acc) => acc.id === bankAccountId);

   const importMutation = useMutation(
      orpc.transactions.importStatement.mutationOptions({
         onSuccess: (data) => {
            toast.success(
               `${data.imported} transação(ões) importada(s) com sucesso.`,
            );
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao importar extrato.");
         },
      }),
   );

   function handleImport() {
      if (validRows.length === 0 || !bankAccountId) return;

      startTransition(async () => {
         importMutation.mutate({
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
      });
   }

   const isLoading = isPending || importMutation.isPending;

   return (
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>Confirmar Importação</DialogStackTitle>
            <DialogStackDescription>
               Selecione a conta e confirme a importação
            </DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-4">
               <StepBar methods={methods} />

               <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium text-muted-foreground">
                     Conta bancária *
                  </label>
                  <Combobox
                     emptyMessage="Nenhuma conta encontrada."
                     onValueChange={setBankAccountId}
                     options={bankAccountOptions}
                     placeholder="Selecionar conta..."
                     searchPlaceholder="Buscar conta..."
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
                           Formato
                        </span>
                        <Badge className="uppercase text-xs" variant="outline">
                           {format}
                        </Badge>
                     </div>

                     <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">
                           Total no arquivo
                        </span>
                        <span className="text-sm font-medium">
                           {rows.length}
                        </span>
                     </div>

                     {rows.filter((r) => !r.isValid).length > 0 && (
                        <div className="flex items-center justify-between px-4 py-2.5">
                           <span className="text-sm text-muted-foreground">
                              Inválidas (ignoradas)
                           </span>
                           <Badge className="text-xs" variant="destructive">
                              {rows.filter((r) => !r.isValid).length}
                           </Badge>
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

                     <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">
                           Conta
                        </span>
                        <span className="text-sm font-medium">
                           {selectedAccount?.name ?? (
                              <span className="text-destructive">
                                 Não selecionada
                              </span>
                           )}
                        </span>
                     </div>
                  </div>
               </div>

               {validRows.length === 0 && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                     <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                     <p className="text-xs text-amber-700">
                        Não há transações válidas para importar.
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
                  disabled={
                     isLoading || validRows.length === 0 || !bankAccountId
                  }
                  onClick={handleImport}
                  type="button"
               >
                  {isLoading ? (
                     <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  Importar {validRows.length} transação(ões)
               </Button>
            </div>
         </div>
      </DialogStackContent>
   );
}

interface ConfirmStepProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
   format: FileFormat;
   onSuccess: () => void;
}

function ConfirmStep(props: ConfirmStepProps) {
   return (
      <Suspense fallback={<StepLoadingFallback title="Confirmar Importação" />}>
         <ConfirmStepInner {...props} />
      </Suspense>
   );
}

function StatementImportWizard({
   methods,
   onClose,
}: {
   methods: StepperMethods;
   onClose?: () => void;
}) {
   const currentId = methods.state.current.data.id;

   const [rows, setRows] = useState<ValidatedRow[]>([]);
   const [format, setFormat] = useState<FileFormat>("csv");
   const [raw, setRaw] = useState<RawData | null>(null);
   const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
      date: "",
      name: "",
      type: "",
      amount: "",
      description: "",
   });

   function handleFileReady(
      parsedRows: ValidatedRow[],
      fileFormat: FileFormat,
      rawData: RawData | null,
   ) {
      setFormat(fileFormat);
      if (fileFormat === "ofx") {
         setRows(parsedRows);
         setRaw(null);
         return;
      }
      setRaw(rawData);
      if (rawData) {
         const guessed = guessMapping(rawData.headers);
         setColumnMapping((prev) => ({ ...prev, ...guessed }));
      }
   }

   return (
      <>
         {currentId === "upload" && (
            <UploadStep methods={methods} onFileReady={handleFileReady} />
         )}

         {currentId === "map" && raw && (
            <MapStep
               mapping={columnMapping}
               methods={methods}
               onApply={setRows}
               onMappingChange={setColumnMapping}
               raw={raw}
            />
         )}

         {currentId === "preview" && (
            <PreviewStep methods={methods} rows={rows} />
         )}

         {currentId === "confirm" && (
            <ConfirmStep
               format={format}
               methods={methods}
               onSuccess={() => onClose?.()}
               rows={rows}
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
         {({ methods }) => (
            <StatementImportWizard methods={methods} onClose={onClose} />
         )}
      </Stepper.Provider>
   );
}
