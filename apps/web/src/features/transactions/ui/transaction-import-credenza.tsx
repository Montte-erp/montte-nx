import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
import { generateFromObjects, parseOrThrow } from "@f-o-t/csv";
import { getTransactions, parseOrThrow as parseOfx } from "@f-o-t/ofx";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
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
import { defineStepper } from "@packages/ui/components/stepper";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import {
   AlertTriangle,
   CheckCircle2,
   ChevronRight,
   Copy,
   FileSpreadsheet,
   FileText,
   HelpCircle,
   Loader2,
} from "lucide-react";
import { Suspense, useState, useTransition } from "react";
import { toast } from "sonner";
import { closeCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

// ---------------------------------------------------------------------------
// Stepper definition
// ---------------------------------------------------------------------------

const { Stepper, useStepper } = defineStepper(
   { id: "upload", title: "Arquivo" },
   { id: "map", title: "Colunas" },
   { id: "preview", title: "Prévia" },
   { id: "confirm", title: "Importar" },
);

type ImportStepperMethods = ReturnType<typeof useStepper>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParsedRow = {
   data: string;
   nome: string;
   tipo: string;
   valor: string;
   descricao: string;
   conta: string;
   conta_destino: string;
   categoria: string;
   subcategoria: string;
   tags: string;
   forma_pagamento: string;
   parcelado: string;
   num_parcelas: string;
};

type ImportRow = ParsedRow & {
   isDuplicate: boolean;
};

type Defaults = {
   bankAccountId: string;
   categoryId: string;
   subcategoryId: string;
   tagIds: string[];
   description: string;
};

type FileType = "csv" | "ofx";

type ColumnMapping = {
   data: string;
   nome: string;
   tipo: string;
   valor: string;
   descricao: string;
   conta: string;
   conta_destino: string;
   categoria: string;
   subcategoria: string;
   tags: string;
   forma_pagamento: string;
   parcelado: string;
   num_parcelas: string;
};

type RawCsvData = {
   headers: string[];
   rows: string[][];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof ColumnMapping)[] = [
   "data",
   "nome",
   "tipo",
   "valor",
];

const FIELD_LABELS: Record<keyof ColumnMapping, string> = {
   data: "Data *",
   nome: "Nome",
   tipo: "Tipo",
   valor: "Valor *",
   descricao: "Descrição",
   conta: "Conta",
   conta_destino: "Conta destino",
   categoria: "Categoria",
   subcategoria: "Subcategoria",
   tags: "Tags",
   forma_pagamento: "Forma de pagamento",
   parcelado: "Parcelado",
   num_parcelas: "Nº de parcelas",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTipo(tipo: string): "income" | "expense" | "transfer" {
   const t = tipo.toLowerCase().trim();
   if (t === "receita" || t === "income") return "income";
   if (t === "transferencia" || t === "transferência" || t === "transfer")
      return "transfer";
   return "expense";
}

function normalizeDate(d: string): string {
   if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
      const [day, month, year] = d.split("/");
      return `${year}-${month}-${day}`;
   }
   return d;
}

function normalizeOfxDate(raw: string): string {
   if (/^\d{8}$/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
   }
   return raw;
}

function triggerDownload(blob: Blob, filename: string): void {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

function formatCurrency(value: string): string {
   const num = Number(value);
   if (Number.isNaN(num)) return value;
   return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
   }).format(num);
}

function guessColumnMapping(headers: string[]): Partial<ColumnMapping> {
   const mapping: Partial<ColumnMapping> = {};
   const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

   const patterns: Record<keyof ColumnMapping, string[]> = {
      data: ["data", "date", "dt", "data_lancamento", "data lancamento"],
      nome: ["nome", "name", "descricao", "description", "historico", "memo"],
      tipo: ["tipo", "type", "natureza", "operacao"],
      valor: [
         "valor",
         "value",
         "amount",
         "montante",
         "vlr",
         "vl",
         "valor_lancamento",
      ],
      descricao: [
         "descricao",
         "description",
         "obs",
         "observacao",
         "memo",
         "complemento",
      ],
      conta: ["conta", "account", "banco", "bank", "conta_debito"],
      conta_destino: [
         "conta_destino",
         "destination",
         "destino",
         "conta_credito",
      ],
      categoria: ["categoria", "category", "cat", "grupo"],
      subcategoria: ["subcategoria", "subcategory", "subcat", "subgrupo"],
      tags: ["tags", "tag", "labels", "etiquetas"],
      forma_pagamento: [
         "forma_pagamento",
         "payment_method",
         "metodo",
         "forma",
         "meio_pagamento",
      ],
      parcelado: ["parcelado", "installment", "parcela", "is_installment"],
      num_parcelas: [
         "num_parcelas",
         "parcelas",
         "installments",
         "qtd_parcelas",
         "installment_count",
      ],
   };

   for (const [field, candidates] of Object.entries(patterns)) {
      const idx = lowerHeaders.findIndex((h) =>
         candidates.some((c) => h.includes(c)),
      );
      if (idx !== -1) {
         mapping[field as keyof ColumnMapping] = headers[idx];
      }
   }

   return mapping;
}

function applyMapping(
   row: string[],
   headers: string[],
   mapping: ColumnMapping,
): ParsedRow {
   const get = (field: keyof ColumnMapping): string => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx !== -1 ? (row[idx] ?? "") : "";
   };

   return {
      data: get("data"),
      nome: get("nome"),
      tipo: get("tipo") || "despesa",
      valor: get("valor"),
      descricao: get("descricao"),
      conta: get("conta"),
      conta_destino: get("conta_destino"),
      categoria: get("categoria"),
      subcategoria: get("subcategoria"),
      tags: get("tags"),
      forma_pagamento: get("forma_pagamento"),
      parcelado: get("parcelado"),
      num_parcelas: get("num_parcelas"),
   };
}

// ---------------------------------------------------------------------------
// Step progress indicator (line variant)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Step 1: Upload
// ---------------------------------------------------------------------------

interface UploadStepProps {
   methods: ImportStepperMethods;
   onFileReady: (
      rows: ImportRow[],
      fileType: FileType,
      rawCsv: RawCsvData | null,
   ) => void;
}

function UploadStep({ methods, onFileReady }: UploadStepProps) {
   const [isParsing, setIsParsing] = useState(false);
   const [selectedFile, setSelectedFile] = useState<File | undefined>();

   function handleTemplateDownload() {
      const exampleRow = {
         data: "01/03/2026",
         nome: "Supermercado XYZ",
         tipo: "despesa",
         valor: "150.00",
         descricao: "Compras mensais",
         conta: "Conta Corrente",
         conta_destino: "",
         categoria: "Alimentação",
         subcategoria: "Mercado",
         tags: "mercado,mensal",
      };

      const csv = generateFromObjects([exampleRow], {
         headers: [
            "data",
            "nome",
            "tipo",
            "valor",
            "descricao",
            "conta",
            "conta_destino",
            "categoria",
            "subcategoria",
            "tags",
         ],
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      triggerDownload(blob, "modelo-transacoes.csv");
   }

   function processFile(file: File) {
      setSelectedFile(file);
      setIsParsing(true);

      const reader = new FileReader();
      reader.onload = async (ev) => {
         try {
            const content = ev.target?.result as string;
            const ext = file.name.split(".").pop()?.toLowerCase();

            if (ext === "ofx") {
               const ofxDoc = parseOfx(content);
               const txs = getTransactions(ofxDoc);
               const parsed: ImportRow[] = txs.map((tx) => {
                  const amount = Math.abs(tx.TRNAMT);
                  const tipo = tx.TRNAMT >= 0 ? "receita" : "despesa";
                  // biome-ignore lint/suspicious/noExplicitAny: OFXDate shape access
                  const dtPosted = tx.DTPOSTED as any;
                  const rawDate: string =
                     typeof dtPosted?.raw === "string"
                        ? dtPosted.raw.slice(0, 8)
                        : "";
                  const data = normalizeOfxDate(rawDate);
                  return {
                     data,
                     nome: tx.NAME ?? tx.MEMO ?? "",
                     tipo,
                     valor: String(amount),
                     descricao: tx.MEMO ?? "",
                     conta: "",
                     conta_destino: "",
                     categoria: "",
                     subcategoria: "",
                     tags: "",
                     forma_pagamento: "",
                     parcelado: "",
                     num_parcelas: "",
                     isDuplicate: false,
                  };
               });
               onFileReady(parsed, "ofx", null);
               // OFX skips column mapping step — jump to preview
               methods.navigation.goTo("preview");
            } else {
               // CSV — go to column mapping
               const doc = parseOrThrow(content);
               const headers = doc.rows[0]?.fields ?? [];
               const rawRows = doc.rows.slice(1).map((r) => r.fields);
               onFileReady([], "csv", { headers, rows: rawRows });
               methods.navigation.next();
            }
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
      <>
         <CredenzaHeader>
            <CredenzaTitle>Importar Lançamentos</CredenzaTitle>
            <CredenzaDescription>
               Importe seus lançamentos via arquivo CSV ou OFX
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="flex flex-col gap-4 w-full overflow-auto">
            <StepIndicator methods={methods} />

            {/* Drop zone */}
            <Dropzone
               accept={{
                  "text/csv": [".csv"],
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
                        <p className="font-medium text-sm mt-2">
                           Arraste e solte ou clique para selecionar
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                           Suporta arquivos <strong>.CSV</strong> e{" "}
                           <strong>.OFX</strong>
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                           <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                              <FileSpreadsheet className="size-3.5 text-emerald-600" />
                              <span className="text-xs font-medium">CSV</span>
                           </div>
                           <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
                              <FileText className="size-3.5 text-blue-600" />
                              <span className="text-xs font-medium">OFX</span>
                           </div>
                        </div>
                     </>
                  )}
               </DropzoneEmptyState>
               <DropzoneContent />
            </Dropzone>

            {/* Info cards */}
            <div className="grid grid-cols-2 gap-2">
               <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium mb-0.5">Arquivo CSV</p>
                  <p className="text-xs text-muted-foreground">
                     Você poderá mapear as colunas no próximo passo
                  </p>
               </div>
               <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium mb-0.5">Arquivo OFX</p>
                  <p className="text-xs text-muted-foreground">
                     Mapeamento automático — pula direto para a prévia
                  </p>
               </div>
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
               <FileSpreadsheet className="size-4 mr-2" />
               Baixar modelo CSV
            </Button>
         </CredenzaFooter>
      </>
   );
}

// ---------------------------------------------------------------------------
// Step 2: Column Mapping (CSV only)
// ---------------------------------------------------------------------------

interface ColumnMappingStepProps {
   methods: ImportStepperMethods;
   rawCsv: RawCsvData;
   mapping: ColumnMapping;
   onMappingChange: (mapping: ColumnMapping) => void;
   onApply: (rows: ImportRow[]) => void;
}

function ColumnMappingStep({
   methods,
   rawCsv,
   mapping,
   onMappingChange,
   onApply,
}: ColumnMappingStepProps) {
   const { headers, rows } = rawCsv;

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
      const parsed: ImportRow[] = rows.map((row) => ({
         ...applyMapping(row, headers, mapping),
         isDuplicate: false,
      }));
      onApply(parsed);
      methods.navigation.next();
   }

   const otherFields = (
      Object.keys(FIELD_LABELS) as (keyof ColumnMapping)[]
   ).filter((f) => !REQUIRED_FIELDS.includes(f));

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Mapear Colunas</CredenzaTitle>
            <CredenzaDescription>
               Relacione as colunas do seu arquivo com os campos do sistema
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="flex flex-col gap-4">
            <StepIndicator methods={methods} />

            {/* Preview of raw data */}
            <div className="rounded-lg border overflow-hidden">
               <div className="bg-muted/50 px-3 py-2 border-b">
                  <p className="text-xs font-medium text-muted-foreground">
                     Prévia do arquivo ({rows.length} linhas encontradas)
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

            {/* Column mapping */}
            <div className="flex flex-col gap-4">
               {/* Required fields row */}
               <div className="grid gap-4 grid-cols-4">
                  {REQUIRED_FIELDS.map((field) => (
                     <div className="flex flex-col gap-2" key={field}>
                        <label className="text-xs font-medium text-muted-foreground">
                           {FIELD_LABELS[field]?.replace(" *", "")}
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

               {/* Optional fields — 3 per row */}
               <div className="grid grid-cols-3 gap-4">
                  {otherFields.map((field) => (
                     <div className="flex flex-col gap-2" key={field}>
                        <label className="text-xs font-medium text-muted-foreground">
                           {FIELD_LABELS[field]?.replace(" *", "")}
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
         </CredenzaBody>

         <CredenzaFooter className="flex gap-2">
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
         </CredenzaFooter>
      </>
   );
}

// ---------------------------------------------------------------------------
// Step 3: Preview
// ---------------------------------------------------------------------------

interface PreviewStepProps {
   methods: ImportStepperMethods;
   rows: ImportRow[];
   defaults: Defaults;
   onDefaultsChange: (d: Defaults) => void;
   onRowsChange: (rows: ImportRow[]) => void;
   ignoreDuplicates: boolean;
   onIgnoreDuplicatesChange: (v: boolean) => void;
}

function PreviewStep({
   methods,
   rows,
   defaults,
   onDefaultsChange,
   onRowsChange,
   ignoreDuplicates,
   onIgnoreDuplicatesChange,
}: PreviewStepProps) {
   const queryClient = useQueryClient();
   const [duplicateCheckDone, setDuplicateCheckDone] = useState(false);
   const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const categories = categoriesResult;

   const bankAccountOptions = bankAccounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
   }));

   const categoryOptions = categories.map((cat) => ({
      value: cat.id,
      label: cat.name,
   }));

   const duplicateCount = rows.filter((r) => r.isDuplicate).length;
   const visibleRows = ignoreDuplicates
      ? rows.filter((r) => !r.isDuplicate)
      : rows;

   async function handleCheckDuplicates() {
      if (rows.length === 0) return;
      setIsCheckingDuplicates(true);

      try {
         const dates = rows
            .map((r) => normalizeDate(r.data))
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort();

         const dateFrom = dates[0];
         const dateTo = dates[dates.length - 1];

         if (!dateFrom || !dateTo) {
            toast.error("Não foi possível determinar o intervalo de datas.");
            return;
         }

         const result = await queryClient.fetchQuery(
            orpc.transactions.getAll.queryOptions({
               input: {
                  dateFrom,
                  dateTo,
                  ...(defaults.bankAccountId
                     ? { bankAccountId: defaults.bankAccountId }
                     : {}),
                  pageSize: 500,
               },
            }),
         );

         // biome-ignore lint/suspicious/noExplicitAny: dynamic transaction shape
         const existingTxs: any[] = result.data ?? [];

         const updatedRows = rows.map((row) => {
            const resolvedBankAccountId =
               defaults.bankAccountId ||
               bankAccounts.find(
                  (acc) => acc.name.toLowerCase() === row.conta.toLowerCase(),
               )?.id ||
               "";

            const isDuplicate = existingTxs.some((ex) => {
               const groupResult = evaluateConditionGroup(
                  {
                     id: "duplicate-check",
                     operator: "OR",
                     scoringMode: "weighted",
                     threshold: 0.8,
                     conditions: [
                        {
                           id: "amount",
                           type: "number",
                           field: "amount",
                           operator: "eq",
                           value: Number(row.valor),
                           options: { weight: 0.45 },
                        },
                        {
                           id: "date",
                           type: "string",
                           field: "date",
                           operator: "eq",
                           value: normalizeDate(row.data),
                           options: { weight: 0.35 },
                        },
                        {
                           id: "account",
                           type: "string",
                           field: "bankAccountId",
                           operator: "eq",
                           value: resolvedBankAccountId,
                           options: { weight: 0.2 },
                        },
                     ],
                  },
                  {
                     data: {
                        amount: Number(ex.amount),
                        date: ex.date as string,
                        bankAccountId: ex.bankAccountId as string,
                     },
                  },
               );
               return groupResult.passed;
            });

            return { ...row, isDuplicate };
         });

         onRowsChange(updatedRows);
         setDuplicateCheckDone(true);

         const foundCount = updatedRows.filter((r) => r.isDuplicate).length;
         if (foundCount > 0) {
            toast.warning(
               `${foundCount} provável(is) duplicata(s) encontrada(s).`,
            );
         } else {
            toast.success("Nenhuma duplicata encontrada.");
         }
      } catch {
         toast.error("Erro ao verificar duplicatas.");
      } finally {
         setIsCheckingDuplicates(false);
      }
   }

   const typeColorMap: Record<string, string> = {
      receita: "text-emerald-600",
      income: "text-emerald-600",
      despesa: "text-red-500",
      expense: "text-red-500",
      transferencia: "text-blue-500",
      transferência: "text-blue-500",
      transfer: "text-blue-500",
   };

   return (
      <TooltipProvider>
         <CredenzaHeader>
            <CredenzaTitle>Prévia dos Lançamentos</CredenzaTitle>
            <CredenzaDescription>
               {rows.length} lançamento(s) encontrada(s) no arquivo
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="flex flex-col gap-2 w-full">
            <StepIndicator methods={methods} />

            {/* Defaults */}
            <div className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Valores padrão
               </p>

               <div className="grid grid-cols-2 gap-2">
                  <div>
                     <p className="text-xs text-muted-foreground mb-1">
                        Conta padrão *
                     </p>
                     <Combobox
                        className="w-full h-8 text-xs"
                        emptyMessage="Nenhuma conta."
                        onValueChange={(v) =>
                           onDefaultsChange({
                              ...defaults,
                              bankAccountId: v,
                              subcategoryId: "",
                           })
                        }
                        options={bankAccountOptions}
                        placeholder="Selecionar..."
                        searchPlaceholder="Buscar conta..."
                        value={defaults.bankAccountId}
                     />
                  </div>

                  <div>
                     <p className="text-xs text-muted-foreground mb-1">
                        Categoria padrão
                     </p>
                     <Combobox
                        className="w-full h-8 text-xs"
                        emptyMessage="Nenhuma categoria."
                        onValueChange={(v) =>
                           onDefaultsChange({
                              ...defaults,
                              categoryId: v,
                              subcategoryId: "",
                           })
                        }
                        options={categoryOptions}
                        placeholder="Selecionar..."
                        searchPlaceholder="Buscar categoria..."
                        value={defaults.categoryId}
                     />
                  </div>

                  {defaults.categoryId &&
                     categories.filter(
                        (c: { parentId: string | null }) =>
                           c.parentId === defaults.categoryId,
                     ).length > 0 && (
                        <div className="col-span-2">
                           <p className="text-xs text-muted-foreground mb-1">
                              Subcategoria padrão
                           </p>
                           <Combobox
                              className="w-full h-8 text-xs"
                              emptyMessage="Nenhuma subcategoria."
                              onValueChange={(v) =>
                                 onDefaultsChange({
                                    ...defaults,
                                    subcategoryId: v,
                                 })
                              }
                              options={categories
                                 .filter(
                                    (c: { parentId: string | null }) =>
                                       c.parentId === defaults.categoryId,
                                 )
                                 .map((c: { id: string; name: string }) => ({
                                    value: c.id,
                                    label: c.name,
                                 }))}
                              placeholder="Selecionar..."
                              searchPlaceholder="Buscar subcategoria..."
                              value={defaults.subcategoryId}
                           />
                        </div>
                     )}
               </div>
            </div>

            {/* Duplicate check controls */}
            <div className="flex items-center gap-2 flex-wrap">
               <Button
                  className="h-8 text-xs gap-2"
                  disabled={isCheckingDuplicates || rows.length === 0}
                  onClick={handleCheckDuplicates}
                  size="sm"
                  type="button"
                  variant="outline"
               >
                  {isCheckingDuplicates ? (
                     <Loader2 className="size-3 animate-spin" />
                  ) : (
                     <Copy className="size-3" />
                  )}
                  Verificar duplicadas
               </Button>

               {duplicateCheckDone && (
                  <div className="flex items-center gap-2 ml-auto">
                     {duplicateCount > 0 ? (
                        <>
                           <Badge className="text-xs" variant="destructive">
                              {duplicateCount} duplicata(s)
                           </Badge>
                           {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a Radix button */}
                           <label className="flex items-center gap-2 cursor-pointer select-none">
                              <Checkbox
                                 checked={ignoreDuplicates}
                                 className="size-3.5"
                                 onCheckedChange={(c) =>
                                    onIgnoreDuplicatesChange(c === true)
                                 }
                              />
                              <span className="text-xs text-muted-foreground">
                                 Ignorar duplicadas
                              </span>
                           </label>
                        </>
                     ) : (
                        <div className="flex items-center gap-1 text-emerald-600">
                           <CheckCircle2 className="size-3.5" />
                           <span className="text-xs">Sem duplicatas</span>
                        </div>
                     )}
                  </div>
               )}

               {!duplicateCheckDone && (
                  <Tooltip>
                     <TooltipTrigger asChild>
                        <button
                           className="ml-auto text-muted-foreground cursor-pointer"
                           type="button"
                        >
                           <HelpCircle className="size-3.5" />
                        </button>
                     </TooltipTrigger>
                     <TooltipContent className="max-w-52 text-xs" side="left">
                        Verifica se os lançamentos importados já existem no
                        sistema com base em valor (45%), data (35%) e conta
                        (20%).
                     </TooltipContent>
                  </Tooltip>
               )}
            </div>

            {/* Transactions table */}
            <div className="overflow-auto max-h-52 rounded-lg border">
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead className="w-5 p-2" />
                        <TableHead className="text-xs p-2">Data</TableHead>
                        <TableHead className="text-xs p-2">Nome</TableHead>
                        <TableHead className="text-xs p-2">Tipo</TableHead>
                        <TableHead className="p-2 text-right text-xs">
                           Valor
                        </TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {visibleRows.map((row, index) => (
                        <TableRow
                           className={
                              row.isDuplicate ? "opacity-50 bg-amber-50/50" : ""
                           }
                           key={`row-${index + 1}`}
                        >
                           <TableCell className="w-5 p-2">
                              {row.isDuplicate ? (
                                 <Tooltip>
                                    <TooltipTrigger>
                                       <AlertTriangle className="size-3.5 text-amber-500" />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                       Possível duplicata
                                    </TooltipContent>
                                 </Tooltip>
                              ) : null}
                           </TableCell>
                           <TableCell className="p-2 text-xs whitespace-nowrap">
                              {row.data}
                           </TableCell>
                           <TableCell className="max-w-32 truncate p-2 text-xs">
                              {row.nome || (
                                 <span className="text-muted-foreground">
                                    —
                                 </span>
                              )}
                           </TableCell>
                           <TableCell className="p-2 text-xs">
                              <span
                                 className={
                                    typeColorMap[row.tipo.toLowerCase()] ??
                                    "text-muted-foreground"
                                 }
                              >
                                 {row.tipo}
                              </span>
                           </TableCell>
                           <TableCell className="p-2 text-right font-mono text-xs">
                              {formatCurrency(row.valor)}
                           </TableCell>
                        </TableRow>
                     ))}
                     {visibleRows.length === 0 && (
                        <TableRow>
                           <TableCell
                              className="py-6 text-center text-xs text-muted-foreground"
                              colSpan={5}
                           >
                              Nenhum lançamento para importar
                           </TableCell>
                        </TableRow>
                     )}
                  </TableBody>
               </Table>
            </div>

            {ignoreDuplicates && duplicateCount > 0 && (
               <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700">
                     {duplicateCount} lançamento(s) marcada(s) como duplicata
                     serão ignoradas.
                  </p>
               </div>
            )}
         </CredenzaBody>

         <CredenzaFooter className="flex gap-2">
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
               disabled={visibleRows.length === 0 || !defaults.bankAccountId}
               onClick={() => methods.navigation.next()}
               type="button"
            >
               Continuar
               <ChevronRight className="ml-1 size-4" />
            </Button>
         </CredenzaFooter>
      </TooltipProvider>
   );
}

// ---------------------------------------------------------------------------
// Step 4: Confirm & Import
// ---------------------------------------------------------------------------

interface ConfirmStepProps {
   methods: ImportStepperMethods;
   rows: ImportRow[];
   defaults: Defaults;
   ignoreDuplicates: boolean;
   fileType: FileType;
   onSuccess: () => void;
}

function ConfirmStep({
   methods,
   rows,
   defaults,
   ignoreDuplicates,
   fileType,
   onSuccess,
}: ConfirmStepProps) {
   const [isPending, startTransition] = useTransition();
   const [ignoreOnServer, setIgnoreOnServer] = useState(true);

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const categories = categoriesResult;

   const visibleRows = ignoreDuplicates
      ? rows.filter((r) => !r.isDuplicate)
      : rows;

   const duplicateCount = rows.filter((r) => r.isDuplicate).length;
   const selectedAccount = bankAccounts.find(
      (acc) => acc.id === defaults.bankAccountId,
   );
   const selectedCategory = categories.find(
      (cat: { id: string }) => cat.id === defaults.categoryId,
   );

   const importMutation = useMutation(
      orpc.transactions.importBulk.mutationOptions({
         onSuccess: (data) => {
            toast.success(
               `${data.imported} lançamento(s) importada(s) com sucesso.`,
            );
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao importar lançamentos.");
         },
      }),
   );

   function handleImport() {
      if (visibleRows.length === 0 || !defaults.bankAccountId) return;

      startTransition(async () => {
         const payload = visibleRows.map((row) => {
            const resolvedBankAccountId =
               bankAccounts.find(
                  (acc) => acc.name.toLowerCase() === row.conta.toLowerCase(),
               )?.id || defaults.bankAccountId;

            const resolvedCategoryId =
               categories.find(
                  (cat: { name: string }) =>
                     cat.name.toLowerCase() === row.categoria.toLowerCase(),
               )?.id ||
               defaults.categoryId ||
               null;

            const numericAmount = Number(row.valor.replace(",", "."));
            const inferredType =
               numericAmount < 0 ? "expense" : parseTipo(row.tipo);

            return {
               date: normalizeDate(row.data),
               name: row.nome || null,
               type: inferredType,
               amount: String(Math.abs(numericAmount)),
               description: row.descricao || defaults.description || null,
               bankAccountId: resolvedBankAccountId,
               destinationBankAccountId: null as string | null,
               categoryId: resolvedCategoryId,
               subcategoryId: null as string | null,
               tagIds: [] as string[],
               attachmentUrl: null as string | null,
               paymentMethod: (row.forma_pagamento || null) as
                  | "pix"
                  | "credit_card"
                  | "debit_card"
                  | "boleto"
                  | "cash"
                  | "transfer"
                  | "other"
                  | "cheque"
                  | "automatic_debit"
                  | null,
               isInstallment: row.parcelado
                  ? ["sim", "yes", "true", "1"].includes(
                       row.parcelado.toLowerCase().trim(),
                    )
                  : false,
               installmentCount: row.num_parcelas
                  ? Number.parseInt(row.num_parcelas, 10) || null
                  : null,
            };
         });

         importMutation.mutate({ transactions: payload });
      });
   }

   const isLoading = isPending || importMutation.isPending;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Confirmar Importação</CredenzaTitle>
            <CredenzaDescription>
               Revise o resumo antes de importar
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="flex flex-col gap-4">
            <StepIndicator methods={methods} />

            {/* Summary card */}
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
                        {fileType}
                     </Badge>
                  </div>

                  <div className="flex items-center justify-between px-4 py-2.5">
                     <span className="text-sm text-muted-foreground">
                        Total no arquivo
                     </span>
                     <span className="text-sm font-medium">{rows.length}</span>
                  </div>

                  {duplicateCount > 0 && (
                     <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">
                           Duplicatas detectadas
                        </span>
                        <Badge className="text-xs" variant="destructive">
                           {duplicateCount}
                        </Badge>
                     </div>
                  )}

                  <div className="flex items-center justify-between bg-primary/5 px-4 py-2.5">
                     <span className="text-sm font-medium">
                        Serão importadas
                     </span>
                     <span className="text-sm font-bold text-primary">
                        {visibleRows.length}
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

                  {selectedCategory && (
                     <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">
                           Categoria padrão
                        </span>
                        <span className="text-sm font-medium">
                           {selectedCategory.name}
                        </span>
                     </div>
                  )}
               </div>
            </div>

            {/* Server-side duplicate options */}
            <div className="rounded-lg border p-3 flex flex-col gap-2">
               <p className="text-xs font-medium">Opções de importação</p>

               {/* biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a Radix button */}
               <label className="flex cursor-pointer select-none items-start gap-2">
                  <Checkbox
                     checked={ignoreOnServer}
                     className="mt-0.5"
                     onCheckedChange={(c) => setIgnoreOnServer(c === true)}
                  />
                  <div>
                     <p className="text-xs font-medium">
                        Ignorar duplicados no servidor
                     </p>
                     <p className="text-xs text-muted-foreground">
                        Lançamentos exatamente iguais já existentes serão
                        ignoradas automaticamente.
                     </p>
                  </div>
               </label>
            </div>

            {visibleRows.length === 0 && (
               <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-700">
                     Não há lançamentos para importar após aplicar os filtros.
                  </p>
               </div>
            )}
         </CredenzaBody>

         <CredenzaFooter className="flex gap-2">
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
                  isLoading ||
                  visibleRows.length === 0 ||
                  !defaults.bankAccountId
               }
               onClick={handleImport}
               type="button"
            >
               {isLoading ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
               ) : null}
               Importar {visibleRows.length} lançamento(s)
            </Button>
         </CredenzaFooter>
      </>
   );
}

// ---------------------------------------------------------------------------
// Loading fallback
// ---------------------------------------------------------------------------

function StepLoadingFallback({ title }: { title: string }) {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{title}</CredenzaTitle>
            <CredenzaDescription>
               Aguarde enquanto processamos...
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
         </CredenzaBody>
      </>
   );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function TransactionImportCredenza() {
   return (
      <Stepper.Provider variant="line">
         {({ methods }) => <ImportWizard methods={methods} />}
      </Stepper.Provider>
   );
}

function ImportWizard({ methods }: { methods: ImportStepperMethods }) {
   const currentId = methods.state.current.data.id;

   const [rows, setRows] = useState<ImportRow[]>([]);
   const [fileType, setFileType] = useState<FileType>("csv");
   const [rawCsv, setRawCsv] = useState<RawCsvData | null>(null);
   const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);
   const [defaults, setDefaults] = useState<Defaults>({
      bankAccountId: "",
      categoryId: "",
      subcategoryId: "",
      tagIds: [],
      description: "",
   });
   const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
      data: "",
      nome: "",
      tipo: "",
      valor: "",
      descricao: "",
      conta: "",
      conta_destino: "",
      categoria: "",
      subcategoria: "",
      tags: "",
      forma_pagamento: "",
      parcelado: "",
      num_parcelas: "",
   });

   function handleFileReady(
      parsedRows: ImportRow[],
      type: FileType,
      csv: RawCsvData | null,
   ) {
      setFileType(type);
      if (type === "ofx") {
         setRows(parsedRows);
         setRawCsv(null);
      } else {
         setRawCsv(csv);
         if (csv) {
            const guessed = guessColumnMapping(csv.headers);
            setColumnMapping((prev) => ({ ...prev, ...guessed }));
         }
      }
   }

   function handleMappingApply(parsedRows: ImportRow[]) {
      setRows(parsedRows);
   }

   function handleRowsChange(updated: ImportRow[]) {
      setRows(updated);
      if (!updated.some((r) => r.isDuplicate)) {
         setIgnoreDuplicates(false);
      }
   }

   return (
      <>
         {currentId === "upload" && (
            <UploadStep methods={methods} onFileReady={handleFileReady} />
         )}

         {currentId === "map" && rawCsv && (
            <ColumnMappingStep
               mapping={columnMapping}
               methods={methods}
               onApply={handleMappingApply}
               onMappingChange={setColumnMapping}
               rawCsv={rawCsv}
            />
         )}

         {currentId === "preview" && (
            <Suspense
               fallback={<StepLoadingFallback title="Prévia dos Lançamentos" />}
            >
               <PreviewStep
                  defaults={defaults}
                  ignoreDuplicates={ignoreDuplicates}
                  methods={methods}
                  onDefaultsChange={setDefaults}
                  onIgnoreDuplicatesChange={setIgnoreDuplicates}
                  onRowsChange={handleRowsChange}
                  rows={rows}
               />
            </Suspense>
         )}

         {currentId === "confirm" && (
            <Suspense
               fallback={<StepLoadingFallback title="Confirmar Importação" />}
            >
               <ConfirmStep
                  defaults={defaults}
                  fileType={fileType}
                  ignoreDuplicates={ignoreDuplicates}
                  methods={methods}
                  onSuccess={closeCredenza}
                  rows={rows}
               />
            </Suspense>
         )}
      </>
   );
}
