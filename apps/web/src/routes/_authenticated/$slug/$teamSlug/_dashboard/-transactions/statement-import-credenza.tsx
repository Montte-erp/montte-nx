import {
   parseBufferOrThrow as parseCsvBuffer,
   generateFromObjects,
} from "@f-o-t/csv";
import {
   of as moneyOf,
   format as moneyFormat,
   toMajorUnitsString,
   add as moneyAdd,
   zero as moneyZero,
} from "@f-o-t/money";
import { parseBufferOrThrow as parseOfx, getTransactions } from "@f-o-t/ofx";
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
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
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
import { Suspense, useCallback, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { read as xlsxRead, utils as xlsxUtils, write as xlsxWrite } from "xlsx";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";

dayjs.extend(customParseFormat);

type FileFormat = "csv" | "xlsx" | "ofx";

type ParsedRow = {
   date: string;
   name: string;
   type: "income" | "expense";
   amount: string;
   description: string;
   categoryId?: string;
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
   const dateOnly = raw
      .trim()
      .replace(/\s*às\s*\d{1,2}:\d{2}(:\d{2})?/i, "")
      .replace(/\s+\d{1,2}:\d{2}(:\d{2})?$/, "")
      .replace(/T\d{2}:\d{2}.*$/, "")
      .trim();
   for (const fmt of [
      "YYYY-MM-DD",
      "DD/MM/YYYY",
      "MM/DD/YYYY",
      "DD-MM-YYYY",
      "YYYYMMDD",
      "DD/MM/YY",
   ]) {
      const d = dayjs(dateOnly, fmt, true);
      if (d.isValid()) return d.format("YYYY-MM-DD");
   }
   return null;
}

function parseAmount(raw: string): string | null {
   const cleaned = raw.replace(/R\$\s*/g, "").trim();
   const hasComma = cleaned.includes(",");
   const hasDot = cleaned.includes(".");
   let normalized: string;
   if (hasComma && hasDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
   } else if (hasComma) {
      normalized = cleaned.replace(",", ".");
   } else {
      normalized = cleaned;
   }
   try {
      return toMajorUnitsString(moneyOf(normalized, "BRL")).replace("-", "");
   } catch {
      return null;
   }
}

const OFX_INCOME_TYPES = new Set(["CREDIT", "INT", "DIV", "DIRECTDEP"]);

function inferTypeFromOfx(
   trnType: string,
   trnAmt: number,
): "income" | "expense" {
   if (trnAmt > 0) return "income";
   if (trnAmt < 0) return "expense";
   if (OFX_INCOME_TYPES.has(trnType)) return "income";
   return "expense";
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
   if (
      t === "despesa" ||
      t === "expense" ||
      t === "débito" ||
      t === "debito" ||
      t === "debit"
   )
      return "expense";
   if (amount < 0) return "expense";
   return "expense";
}

function validateRow(row: ParsedRow, minDate?: string | null): ValidatedRow {
   const errors: string[] = [];
   const parsedDate = parseDate(row.date);
   if (!parsedDate) errors.push("Data inválida");
   if (parsedDate && minDate && parsedDate < minDate)
      errors.push(
         `Anterior à abertura da empresa (${dayjs(minDate).format("DD/MM/YYYY")})`,
      );
   if (!row.amount || parseAmount(row.amount) === null)
      errors.push("Valor inválido");
   return { ...row, isValid: errors.length === 0, errors };
}

function formatMoney(value: string): string {
   const normalized = parseAmount(value) ?? value;
   try {
      return moneyFormat(moneyOf(normalized, "BRL"), "pt-BR");
   } catch {
      return value;
   }
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

function headersFingerprint(headers: string[]): string {
   return [...headers].sort().join(",");
}

function mappingStorageKey(headers: string[]): string {
   return `montte:import:mapping:${headersFingerprint(headers)}`;
}

function getSampleValues(raw: RawData, header: string): string {
   const idx = raw.headers.indexOf(header);
   if (idx === -1) return "";
   return raw.rows
      .slice(0, 3)
      .map((r) => r[idx] ?? "")
      .filter(Boolean)
      .join(", ");
}

const INCOME_NAME_PATTERNS = [
   "recebido",
   "recebimento",
   "depósito",
   "deposito",
   "salário",
   "salario",
   "crédito",
   "credito",
   "pix recebido",
   "transferência recebida",
   "ted recebida",
   "doc recebido",
   "rendimento",
   "reembolso",
   "estorno",
];
const EXPENSE_NAME_PATTERNS = [
   "enviado",
   "pagamento",
   "compra",
   "débito",
   "debito",
   "pix enviado",
   "transferência enviada",
   "ted enviada",
   "doc enviado",
   "saque",
   "tarifa",
   "cobrança",
   "boleto",
];

function inferTypeFromName(name: string): "income" | "expense" | null {
   const n = name.toLowerCase();
   if (INCOME_NAME_PATTERNS.some((p) => n.includes(p))) return "income";
   if (EXPENSE_NAME_PATTERNS.some((p) => n.includes(p))) return "expense";
   return null;
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
   const name = get("name");

   const type =
      rawType.trim() !== ""
         ? inferType(rawType, numericAmount)
         : numericAmount < 0
           ? "expense"
           : (inferTypeFromName(name) ?? "expense");

   return {
      date: get("date"),
      name,
      type,
      amount: rawAmount,
      description: get("description"),
   };
}

const TEMPLATE_ROWS = [
   {
      data: "2024-01-15",
      nome: "Pagamento fornecedor",
      tipo: "despesa",
      valor: "1500.00",
      descricao: "NF 123",
   },
   {
      data: "2024-01-20",
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
   onFileReady: (
      rows: ValidatedRow[],
      format: FileFormat,
      raw: RawData | null,
   ) => void;
   bankAccountId: string;
   minImportDate: string | null;
   onBankAccountChange: (id: string) => void;
}

function UploadStep({
   methods,
   onFileReady,
   bankAccountId,
   minImportDate,
   onBankAccountChange,
}: UploadStepProps) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();
   const { openCredenza, closeCredenza } = useCredenza();
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   function processFile(file: File) {
      if (!bankAccountId) return;
      setSelectedFile(file);
      setIsParsing(true);

      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "ofx") {
         const reader = new FileReader();
         reader.onload = (ev) => {
            try {
               const buffer = ev.target?.result;
               if (!(buffer instanceof ArrayBuffer))
                  throw new Error("read error");
               const ofxDoc = parseOfx(new Uint8Array(buffer));
               const txs = getTransactions(ofxDoc);
               const rows: ValidatedRow[] = txs.map((tx) => {
                  const amount = Math.abs(tx.TRNAMT);
                  const type = inferTypeFromOfx(tx.TRNTYPE, tx.TRNAMT);
                  const dtDate = tx.DTPOSTED.toDate();
                  const date = !Number.isNaN(dtDate.getTime())
                     ? dayjs(dtDate).format("YYYY-MM-DD")
                     : (parseDate(
                          tx.DTPOSTED.raw.replace(/\[.*\]/, "").slice(0, 8),
                       ) ?? tx.DTPOSTED.raw.slice(0, 8));
                  const parsed: ParsedRow = {
                     date,
                     name: tx.NAME ?? tx.MEMO ?? "",
                     type,
                     amount: String(amount),
                     description: tx.MEMO ?? "",
                  };
                  return validateRow(parsed, minImportDate);
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
         reader.readAsArrayBuffer(file);
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
            const buffer = ev.target?.result;
            if (!(buffer instanceof ArrayBuffer)) throw new Error("read error");
            const doc = parseCsvBuffer(new Uint8Array(buffer), {
               hasHeaders: true,
               trimFields: true,
            });
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
      reader.readAsArrayBuffer(file);
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
   minImportDate: string | null;
   onMappingChange: (m: ColumnMapping) => void;
   onApply: (rows: ValidatedRow[]) => void | Promise<void>;
   onDismissSavedMapping: () => void;
}

function MapStep({
   methods,
   raw,
   mapping,
   savedMappingApplied,
   minImportDate,
   onMappingChange,
   onApply,
   onDismissSavedMapping,
}: MapStepProps) {
   const canProceed = REQUIRED_FIELDS.every((f) => mapping[f] !== "");

   async function handleNext() {
      localStorage.setItem(
         mappingStorageKey(raw.headers),
         JSON.stringify(mapping),
      );
      const mapped = raw.rows.map((r) =>
         validateRow(applyMapping(r, raw.headers, mapping), minImportDate),
      );
      await onApply(mapped);
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

               <div className="flex flex-col gap-2">
                  {COLUMN_FIELDS.map((field) => (
                     <div
                        className="grid grid-cols-[7rem_1fr_6rem] items-center gap-4"
                        key={field}
                     >
                        <span className="text-sm font-medium shrink-0">
                           {FIELD_LABELS[field]}
                        </span>
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
                        <p className="text-xs text-muted-foreground truncate max-w-[6rem]">
                           {mapping[field]
                              ? getSampleValues(raw, mapping[field])
                              : ""}
                        </p>
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
   duplicateFlags: boolean[];
   selectedIndices: Set<number>;
   format: FileFormat;
   onSelectionChange: (s: Set<number>) => void;
   onRowsChange: (rows: ValidatedRow[]) => void;
}

function PreviewStep({
   methods,
   rows,
   duplicateFlags,
   selectedIndices,
   format,
   onSelectionChange,
   onRowsChange,
}: PreviewStepProps) {
   const [filterDuplicates, setFilterDuplicates] = useState(false);
   const [editingDescIdx, setEditingDescIdx] = useState<number | null>(null);
   const [editingDescValue, setEditingDescValue] = useState("");
   const [bulkDate, setBulkDate] = useState<Date | undefined>(undefined);
   const [bulkCategoryId, setBulkCategoryId] = useState("");

   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const categoryOptions = categories.map((c) => ({
      value: c.id,
      label: c.name,
   }));

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
         onSelectionChange(new Set());
         return;
      }
      onSelectionChange(new Set(selectableIndices));
   }

   function toggleRow(index: number) {
      const next = new Set(selectedIndices);
      if (next.has(index)) {
         next.delete(index);
      } else {
         next.add(index);
      }
      onSelectionChange(next);
   }

   function ignoreRow(index: number) {
      const next = new Set(selectedIndices);
      next.delete(index);
      onSelectionChange(next);
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

               <SelectionActionBar
                  selectedCount={selectedIndices.size}
                  onClear={() => onSelectionChange(new Set())}
               >
                  <Popover>
                     <PopoverTrigger asChild>
                        <SelectionActionButton>
                           Alterar data
                        </SelectionActionButton>
                     </PopoverTrigger>
                     <PopoverContent
                        className="w-auto p-0"
                        align="center"
                        side="top"
                     >
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
                        <SelectionActionButton>
                           Alterar categoria
                        </SelectionActionButton>
                     </PopoverTrigger>
                     <PopoverContent
                        className="w-56 p-2"
                        align="center"
                        side="top"
                     >
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
               </SelectionActionBar>

               <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-[2rem_6rem_1fr_4rem_5.5rem_2rem] items-center gap-2 border-b bg-muted/50 px-3 py-2">
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
                           return (
                              <div
                                 key={`prev-${originalIndex + 1}`}
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
                                    "grid grid-cols-[2rem_6rem_1fr_4rem_5.5rem_2rem] items-center gap-2 border-b px-3 h-10",
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
                                       <Tooltip>
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
                                          {row.description || row.name ? (
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

interface ConfirmStepProps {
   methods: StepperMethods;
   rows: ValidatedRow[];
   format: FileFormat;
   bankAccountId: string;
   selectedIndices: Set<number>;
   onClose?: () => void;
}

function ConfirmStep({
   methods,
   rows,
   format,
   bankAccountId,
   selectedIndices,
   onClose,
}: ConfirmStepProps) {
   const rowsToImport = rows.filter((_, i) => selectedIndices.has(i));
   const invalidCount = rows.filter((r) => !r.isValid).length;

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
         transactions: rowsToImport.map((r) => ({
            name: r.name || undefined,
            type: r.type,
            amount: parseAmount(r.amount) ?? r.amount,
            date: parseDate(r.date) ?? r.date,
            description: r.description || undefined,
            categoryId: r.categoryId || undefined,
         })),
      });

      toast.success(
         `${rowsToImport.length} transação(ões) importada(s) com sucesso.`,
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
                        rowsToImport.length === 0 ||
                        !bankAccountId
                     }
                     onClick={handleImport}
                     type="button"
                  >
                     <span className="flex items-center gap-2">
                        {importMutation.isPending && (
                           <Loader2 className="size-4 animate-spin" />
                        )}
                        Importar {rowsToImport.length} transação(ões)
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
   const [rawData, setRawData] = useState<RawData | null>(null);
   const [rows, setRows] = useState<ValidatedRow[]>([]);
   const [duplicateFlags, setDuplicateFlags] = useState<boolean[]>([]);
   const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
      new Set(),
   );
   const [format, setFormat] = useState<FileFormat>("csv");
   const [bankAccountId, setBankAccountId] = useState<string>("");
   const [mapping, setMapping] = useState<ColumnMapping>({
      date: "",
      name: "",
      type: "",
      amount: "",
      description: "",
   });
   const [savedMappingApplied, setSavedMappingApplied] = useState(false);

   const checkDuplicatesMutation = useMutation(
      orpc.transactions.checkDuplicates.mutationOptions({}),
   );

   const { data: teamData } = useSuspenseQuery(
      orpc.team.get.queryOptions({ input: { teamId } }),
   );

   const cnpjData = teamData?.cnpjData as
      | { data_inicio_atividade?: string }
      | null
      | undefined;
   const minImportDate: string | null = (() => {
      const raw = cnpjData?.data_inicio_atividade;
      if (!raw) return null;
      const d = dayjs(raw, "DD/MM/YYYY", true);
      if (d.isValid()) return d.format("YYYY-MM-DD");
      return parseDate(raw);
   })();

   function initSelection(mapped: ValidatedRow[], flags: boolean[]) {
      const sel = new Set<number>();
      mapped.forEach((r, i) => {
         if (r.isValid && !flags[i]) sel.add(i);
      });
      setSelectedIndices(sel);
   }

   const handleApplyRows = useCallback(
      async (mapped: ValidatedRow[]) => {
         setRows(mapped);
         const validRows = mapped.filter((r) => r.isValid);
         if (!bankAccountId || validRows.length === 0) {
            setDuplicateFlags([]);
            initSelection(mapped, []);
            return;
         }
         try {
            const flags = await checkDuplicatesMutation.mutateAsync({
               bankAccountId,
               transactions: validRows.map((r) => ({
                  date: parseDate(r.date) ?? r.date,
                  amount: parseAmount(r.amount) ?? r.amount,
                  type: r.type,
               })),
            });
            let fi = 0;
            const fullFlags = mapped.map((r) =>
               r.isValid ? (flags[fi++] ?? false) : false,
            );
            setDuplicateFlags(fullFlags);
            initSelection(mapped, fullFlags);
         } catch {
            setDuplicateFlags([]);
            initSelection(mapped, []);
         }
      },
      [bankAccountId, checkDuplicatesMutation],
   );

   function handleFileReady(
      parsedRows: ValidatedRow[],
      fmt: FileFormat,
      raw: RawData | null,
   ) {
      setFormat(fmt);
      if (raw) {
         setRawData(raw);
         const saved = localStorage.getItem(mappingStorageKey(raw.headers));
         if (saved) {
            try {
               const parsed: ColumnMapping = JSON.parse(saved);
               setMapping((prev) => ({ ...prev, ...parsed }));
               setSavedMappingApplied(true);
            } catch {
               const guessed = guessMapping(raw.headers);
               setMapping((prev) => ({ ...prev, ...guessed }));
            }
         } else {
            const guessed = guessMapping(raw.headers);
            setMapping((prev) => ({ ...prev, ...guessed }));
         }
      }
      if (parsedRows.length > 0) void handleApplyRows(parsedRows);
   }

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
                     minImportDate={minImportDate}
                     onBankAccountChange={setBankAccountId}
                     onFileReady={handleFileReady}
                  />
               </Suspense>
            </ErrorBoundary>
         )}
         {currentId === "map" && rawData && (
            <MapStep
               mapping={mapping}
               methods={methods}
               minImportDate={minImportDate}
               raw={rawData}
               savedMappingApplied={savedMappingApplied}
               onApply={handleApplyRows}
               onMappingChange={setMapping}
               onDismissSavedMapping={() => {
                  setSavedMappingApplied(false);
                  setMapping({
                     date: "",
                     name: "",
                     type: "",
                     amount: "",
                     description: "",
                  });
               }}
            />
         )}
         {currentId === "preview" && (
            <PreviewStep
               duplicateFlags={duplicateFlags}
               format={format}
               methods={methods}
               rows={rows}
               selectedIndices={selectedIndices}
               onSelectionChange={setSelectedIndices}
               onRowsChange={setRows}
            />
         )}
         {currentId === "confirm" && (
            <ConfirmStep
               bankAccountId={bankAccountId}
               format={format}
               methods={methods}
               rows={rows}
               selectedIndices={selectedIndices}
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
