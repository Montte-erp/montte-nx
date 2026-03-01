import { parseOrThrow } from "@f-o-t/csv";
import { generateFromObjects } from "@f-o-t/csv";
import { evaluateConditionGroup } from "@f-o-t/condition-evaluator";
import { parseOrThrow as parseOfx, getTransactions } from "@f-o-t/ofx";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Spinner } from "@packages/ui/components/spinner";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useRef, useState, Suspense, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTipo(tipo: string): "income" | "expense" | "transfer" {
   const t = tipo.toLowerCase().trim();
   if (t === "receita" || t === "income") return "income";
   if (t === "transferencia" || t === "transferência" || t === "transfer") return "transfer";
   return "expense";
}

function normalizeDate(d: string): string {
   // DD/MM/YYYY → YYYY-MM-DD
   if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
      const [day, month, year] = d.split("/");
      return `${year}-${month}-${day}`;
   }
   return d; // assume already YYYY-MM-DD
}

function triggerDownload(blob: Blob, filename: string): void {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Inner component (has access to suspense data)
// ---------------------------------------------------------------------------

function ImportForm() {
   const queryClient = useQueryClient();
   const fileInputRef = useRef<HTMLInputElement>(null);

   const [step, setStep] = useState<"upload" | "preview">("upload");
   const [rows, setRows] = useState<ImportRow[]>([]);
   const [duplicateCheckDone, setDuplicateCheckDone] = useState(false);
   const [ignoreDuplicates, setIgnoreDuplicates] = useState(false);
   const [defaults, setDefaults] = useState<Defaults>({
      bankAccountId: "",
      categoryId: "",
      subcategoryId: "",
      tagIds: [],
      description: "",
   });

   const [isPending, startTransition] = useTransition();
   const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const bankAccountOptions = bankAccounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
   }));

   const categoryOptions = categories.map((cat) => ({
      value: cat.id,
      label: cat.name,
   }));

   const selectedCategory = categories.find((c) => c.id === defaults.categoryId);
   const subcategoryOptions = (selectedCategory?.subcategories ?? []).map((sub) => ({
      value: sub.id,
      label: sub.name,
   }));

   const duplicateCount = rows.filter((r) => r.isDuplicate).length;

   const visibleRows = ignoreDuplicates
      ? rows.filter((r) => !r.isDuplicate)
      : rows;

   // -------------------------------------------------------------------------
   // File parsing
   // -------------------------------------------------------------------------

   function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
         try {
            const content = ev.target?.result as string;
            const ext = file.name.split(".").pop()?.toLowerCase();

            let parsed: ImportRow[] = [];

            if (ext === "ofx") {
               const ofxDoc = parseOfx(content);
               const txs = getTransactions(ofxDoc);
               parsed = txs.map((tx) => {
                  const amount = Math.abs(tx.TRNAMT);
                  const tipo = tx.TRNAMT >= 0 ? "receita" : "despesa";
                  // DTPOSTED is an OFXDate object with isoString property
                  // biome-ignore lint/suspicious/noExplicitAny: OFXDate shape access
                  const dtPosted = tx.DTPOSTED as any;
                  const rawDate: string =
                     typeof dtPosted?.isoString === "string"
                        ? dtPosted.isoString.slice(0, 10)
                        : typeof dtPosted?.raw === "string"
                          ? dtPosted.raw.slice(0, 8)
                          : "";
                  // Normalize date to YYYY-MM-DD
                  const data = normalizeDate(rawDate);
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
                     isDuplicate: false,
                  };
               });
            } else {
               // CSV
               const doc = parseOrThrow(content);
               // Skip header row (index 0), map remaining rows
               parsed = doc.rows.slice(1).map((row) => {
                  const f = row.fields;
                  return {
                     data: f[0] ?? "",
                     nome: f[1] ?? "",
                     tipo: f[2] ?? "despesa",
                     valor: f[3] ?? "0",
                     descricao: f[4] ?? "",
                     conta: f[5] ?? "",
                     conta_destino: f[6] ?? "",
                     categoria: f[7] ?? "",
                     subcategoria: f[8] ?? "",
                     tags: f[9] ?? "",
                     isDuplicate: false,
                  };
               });
            }

            setRows(parsed);
            setDuplicateCheckDone(false);
            setIgnoreDuplicates(false);
            setStep("preview");
         } catch {
            toast.error("Erro ao processar o arquivo. Verifique o formato.");
         }
      };
      reader.readAsText(file, "utf-8");

      // Reset input so same file can be re-selected
      e.target.value = "";
   }

   // -------------------------------------------------------------------------
   // Template download
   // -------------------------------------------------------------------------

   function handleTemplateDownload() {
      const exampleRow = {
         data: "01/03/2026",
         nome: "Exemplo",
         tipo: "despesa",
         valor: "150.00",
         descricao: "Descrição opcional",
         conta: "Conta Corrente",
         conta_destino: "",
         categoria: "Alimentação",
         subcategoria: "Mercado",
         tags: "tag1,tag2",
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

   // -------------------------------------------------------------------------
   // Duplicate detection
   // -------------------------------------------------------------------------

   async function handleCheckDuplicates() {
      if (rows.length === 0) return;

      setIsCheckingDuplicates(true);
      try {
         // Get date range from imported rows
         const dates = rows
            .map((r) => normalizeDate(r.data))
            .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort();

         const dateFrom = dates[0];
         const dateTo = dates[dates.length - 1];

         if (!dateFrom || !dateTo) {
            toast.error("Não foi possível determinar o intervalo de datas.");
            setIsCheckingDuplicates(false);
            return;
         }

         const result = await queryClient.fetchQuery(
            orpc.transactions.getAll.queryOptions({
               input: { dateFrom, dateTo, pageSize: 500 },
            }),
         );

         // biome-ignore lint/suspicious/noExplicitAny: dynamic transaction shape
         const existingTxs: any[] = result.data ?? [];

         const updatedRows = rows.map((row) => {
            const resolvedBankAccountId =
               defaults.bankAccountId ||
               bankAccounts.find(
                  (acc) =>
                     acc.name.toLowerCase() === row.conta.toLowerCase(),
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
                           options: { weight: 0.20 },
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

         setRows(updatedRows);
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

   // -------------------------------------------------------------------------
   // Import
   // -------------------------------------------------------------------------

   const importMutation = useMutation(
      orpc.transactions.importBulk.mutationOptions({
         onSuccess: (data) => {
            toast.success(
               `${data.imported} transação(ões) importada(s) com sucesso.`,
            );
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao importar transações.");
         },
      }),
   );

   function handleImport() {
      if (visibleRows.length === 0 || !defaults.bankAccountId) return;

      startTransition(async () => {
         const payload = visibleRows.map((row) => {
            const resolvedBankAccountId =
               bankAccounts.find(
                  (acc) =>
                     acc.name.toLowerCase() === row.conta.toLowerCase(),
               )?.id || defaults.bankAccountId;

            const resolvedCategoryId =
               categories.find(
                  (cat) =>
                     cat.name.toLowerCase() === row.categoria.toLowerCase(),
               )?.id ||
               defaults.categoryId ||
               null;

            return {
               date: normalizeDate(row.data),
               name: row.nome || null,
               type: parseTipo(row.tipo),
               amount: row.valor,
               description: row.descricao || defaults.description || null,
               bankAccountId: resolvedBankAccountId,
               destinationBankAccountId: null as string | null,
               categoryId: resolvedCategoryId,
               subcategoryId: null as string | null,
               tagIds: [] as string[],
               attachmentUrl: null as string | null,
            };
         });

         importMutation.mutate({ transactions: payload });
      });
   }

   // -------------------------------------------------------------------------
   // Render — Step 1: Upload
   // -------------------------------------------------------------------------

   if (step === "upload") {
      return (
         <>
            <CredenzaHeader>
               <CredenzaTitle>Importar Transações</CredenzaTitle>
            </CredenzaHeader>

            <CredenzaBody>
               <FieldGroup>
                  {/* File picker */}
                  <Field>
                     <FieldLabel>Arquivo (.csv ou .ofx)</FieldLabel>
                     <input
                        ref={fileInputRef}
                        accept=".csv,.ofx"
                        className="hidden"
                        onChange={handleFileChange}
                        type="file"
                     />
                     <Button
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                        variant="outline"
                     >
                        Selecionar arquivo
                     </Button>
                  </Field>

                  {/* Global defaults */}
                  <Field>
                     <FieldLabel>Conta padrão</FieldLabel>
                     <Combobox
                        className="w-full"
                        emptyMessage="Nenhuma conta encontrada."
                        onValueChange={(v) =>
                           setDefaults((d) => ({
                              ...d,
                              bankAccountId: v,
                              subcategoryId: "",
                           }))
                        }
                        options={bankAccountOptions}
                        placeholder="Selecione a conta"
                        searchPlaceholder="Buscar conta..."
                        value={defaults.bankAccountId}
                     />
                  </Field>

                  <Field>
                     <FieldLabel>Categoria padrão</FieldLabel>
                     <Combobox
                        className="w-full"
                        emptyMessage="Nenhuma categoria encontrada."
                        onValueChange={(v) =>
                           setDefaults((d) => ({
                              ...d,
                              categoryId: v,
                              subcategoryId: "",
                           }))
                        }
                        options={categoryOptions}
                        placeholder="Selecione a categoria"
                        searchPlaceholder="Buscar categoria..."
                        value={defaults.categoryId}
                     />
                  </Field>

                  {subcategoryOptions.length > 0 ? (
                     <Field>
                        <FieldLabel>Subcategoria padrão</FieldLabel>
                        <Combobox
                           className="w-full"
                           emptyMessage="Nenhuma subcategoria encontrada."
                           onValueChange={(v) =>
                              setDefaults((d) => ({ ...d, subcategoryId: v }))
                           }
                           options={subcategoryOptions}
                           placeholder="Selecione a subcategoria"
                           searchPlaceholder="Buscar subcategoria..."
                           value={defaults.subcategoryId}
                        />
                     </Field>
                  ) : null}

                  <Field>
                     <FieldLabel>Observação padrão</FieldLabel>
                     <input
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        onChange={(e) =>
                           setDefaults((d) => ({
                              ...d,
                              description: e.target.value,
                           }))
                        }
                        placeholder="Observação opcional"
                        type="text"
                        value={defaults.description}
                     />
                  </Field>
               </FieldGroup>
            </CredenzaBody>

            <CredenzaFooter>
               <Button
                  className="w-full"
                  onClick={handleTemplateDownload}
                  type="button"
                  variant="outline"
               >
                  Baixar modelo CSV
               </Button>
            </CredenzaFooter>
         </>
      );
   }

   // -------------------------------------------------------------------------
   // Render — Step 2: Preview
   // -------------------------------------------------------------------------

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               Pré-visualização — {rows.length} linha(s)
            </CredenzaTitle>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="flex flex-col gap-4">
               {/* Preview table */}
               <div className="overflow-auto max-h-64 rounded-md border">
                  <Table>
                     <TableHeader>
                        <TableRow>
                           <TableHead className="w-6" />
                           <TableHead>Data</TableHead>
                           <TableHead>Nome</TableHead>
                           <TableHead>Tipo</TableHead>
                           <TableHead>Valor</TableHead>
                        </TableRow>
                     </TableHeader>
                     <TableBody>
                        {rows.map((row, index) => (
                           <TableRow key={`row-${index + 1}`}>
                              <TableCell className="w-6">
                                 {row.isDuplicate ? (
                                    <AlertTriangle className="size-4 text-amber-500" />
                                 ) : null}
                              </TableCell>
                              <TableCell className="text-sm">
                                 {row.data}
                              </TableCell>
                              <TableCell className="text-sm max-w-40 truncate">
                                 {row.nome}
                              </TableCell>
                              <TableCell className="text-sm">
                                 {row.tipo}
                              </TableCell>
                              <TableCell className="text-sm">
                                 {row.valor}
                              </TableCell>
                           </TableRow>
                        ))}
                     </TableBody>
                  </Table>
               </div>

               {/* Ignore duplicates checkbox — only after check has been run and duplicates found */}
               {duplicateCheckDone && duplicateCount > 0 ? (
                  // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a Radix button, not a native input
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                     <Checkbox
                        checked={ignoreDuplicates}
                        onCheckedChange={(checked) =>
                           setIgnoreDuplicates(checked === true)
                        }
                     />
                     <span className="text-sm">
                        Ignorar {duplicateCount} duplicata(s)
                     </span>
                  </label>
               ) : null}

               {/* Back button */}
               <Button
                  className="w-full"
                  onClick={() => setStep("upload")}
                  type="button"
                  variant="outline"
               >
                  Voltar
               </Button>
            </div>
         </CredenzaBody>

         <CredenzaFooter className="flex flex-col gap-2">
            <Button
               className="w-full"
               disabled={isCheckingDuplicates}
               onClick={handleCheckDuplicates}
               type="button"
               variant="outline"
            >
               {isCheckingDuplicates ? (
                  <Spinner className="size-4 mr-2" />
               ) : null}
               Verificar duplicados
            </Button>

            <Button
               className="w-full"
               disabled={
                  isPending ||
                  importMutation.isPending ||
                  visibleRows.length === 0 ||
                  !defaults.bankAccountId
               }
               onClick={handleImport}
               type="button"
            >
               {isPending || importMutation.isPending ? (
                  <Spinner className="size-4 mr-2" />
               ) : null}
               Importar {visibleRows.length} transação(ões)
            </Button>
         </CredenzaFooter>
      </>
   );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function TransactionImportCredenza() {
   return (
      <Suspense
         fallback={
            <>
               <CredenzaHeader>
                  <CredenzaTitle>Importar Transações</CredenzaTitle>
               </CredenzaHeader>
               <CredenzaBody className="flex items-center justify-center py-8">
                  <Spinner className="size-6" />
               </CredenzaBody>
            </>
         }
      >
         <ImportForm />
      </Suspense>
   );
}
