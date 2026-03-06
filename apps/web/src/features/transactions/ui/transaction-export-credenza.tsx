import { generateFromObjects } from "@f-o-t/csv";
import { generateBankStatement } from "@f-o-t/ofx";
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxIndicator,
   ChoiceboxItem,
   ChoiceboxItemDescription,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
} from "@packages/ui/components/choicebox";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaClose,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Spinner } from "@packages/ui/components/spinner";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Landmark } from "lucide-react";
import { Suspense, useState, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransactionExportCredenzaProps {
   dateFrom?: string; // YYYY-MM-DD
   dateTo?: string; // YYYY-MM-DD
}

type ExportFormat = "csv" | "ofx";

type BankAccountType = "checking" | "savings" | "investment" | "cash";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCurrentMonthRange(): { from: string; to: string } {
   const now = new Date();
   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, "0");
   const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
   return {
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
   };
}

function parseDateString(dateStr: string): Date {
   // YYYY-MM-DD — parse at noon to avoid timezone shift
   const [year, month, day] = dateStr.split("-").map(Number);
   return new Date(year, month - 1, day, 12, 0, 0);
}

function toDateString(date: Date): string {
   const y = date.getFullYear();
   const m = String(date.getMonth() + 1).padStart(2, "0");
   const d = String(date.getDate()).padStart(2, "0");
   return `${y}-${m}-${d}`;
}

function triggerDownload(blob: Blob, filename: string): void {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

function mapAccountTypeToOFX(
   type: BankAccountType,
): "CHECKING" | "SAVINGS" | "MONEYMRKT" {
   if (type === "savings") return "SAVINGS";
   if (type === "investment") return "MONEYMRKT";
   return "CHECKING";
}

// ---------------------------------------------------------------------------
// Inner component (has access to suspense data)
// ---------------------------------------------------------------------------

function ExportForm({ dateFrom, dateTo }: TransactionExportCredenzaProps) {
   const defaultRange = getCurrentMonthRange();

   const [format, setFormat] = useState<ExportFormat>("csv");
   const [periodFrom, setPeriodFrom] = useState<Date>(
      parseDateString(dateFrom ?? defaultRange.from),
   );
   const [periodTo, setPeriodTo] = useState<Date>(
      parseDateString(dateTo ?? defaultRange.to),
   );
   const [selectedAccountId, setSelectedAccountId] = useState<string>("");
   const [isPending, startTransition] = useTransition();
   const queryClient = useQueryClient();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const accountOptions = bankAccounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
   }));

   const selectedAccount = bankAccounts.find(
      (acc) => acc.id === selectedAccountId,
   );

   const canDownload =
      format === "csv" || (format === "ofx" && selectedAccountId !== "");

   async function fetchAllTransactions(
      from: string,
      to: string,
      bankAccountId?: string,
   ) {
      const firstPage = await queryClient.fetchQuery(
         orpc.transactions.getAll.queryOptions({
            input: {
               dateFrom: from,
               dateTo: to,
               pageSize: 100,
               page: 1,
               ...(bankAccountId ? { bankAccountId } : {}),
            },
         }),
      );

      // biome-ignore lint/suspicious/noExplicitAny: listTransactions return type unknown at compile time
      let allTx: any[] = firstPage.data;
      let page = 2;

      while (allTx.length < firstPage.total) {
         const next = await queryClient.fetchQuery(
            orpc.transactions.getAll.queryOptions({
               input: {
                  dateFrom: from,
                  dateTo: to,
                  pageSize: 100,
                  page,
                  ...(bankAccountId ? { bankAccountId } : {}),
               },
            }),
         );
         allTx = [...allTx, ...next.data];
         page++;
      }

      return allTx;
   }

   function handleDownload() {
      startTransition(async () => {
         try {
            const from = toDateString(periodFrom);
            const to = toDateString(periodTo);

            if (format === "csv") {
               const allTx = await fetchAllTransactions(from, to);

               const rows = allTx.map((tx) => ({
                  data: tx.date ?? "",
                  nome: tx.name ?? tx.description ?? "",
                  tipo:
                     tx.type === "income"
                        ? "receita"
                        : tx.type === "expense"
                          ? "despesa"
                          : "transferencia",
                  valor: tx.amount ?? "",
                  descricao: tx.description ?? "",
                  conta: tx.bankAccountName ?? "",
                  conta_destino: tx.destinationBankAccountId ?? "",
                  categoria: "",
                  subcategoria: "",
                  tags: Array.isArray(tx.tagIds) ? tx.tagIds.join(";") : "",
                  forma_pagamento: tx.paymentMethod ?? "",
                  parcelado: tx.isInstallment ? "Sim" : "Não",
                  num_parcelas: tx.installmentCount ?? "",
                  contato: tx.contactName ?? "",
               }));

               const csv = generateFromObjects(rows, {
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
                     "forma_pagamento",
                     "parcelado",
                     "num_parcelas",
                     "contato",
                  ],
               });

               const blob = new Blob([csv], {
                  type: "text/csv;charset=utf-8;",
               });
               triggerDownload(blob, `transacoes_${from}_${to}.csv`);
               toast.success("Exportação CSV concluída.");
            } else {
               // OFX — only export transactions from selected account
               if (!selectedAccount) {
                  toast.error("Selecione uma conta para exportar OFX.");
                  return;
               }

               const allTx = await fetchAllTransactions(
                  from,
                  to,
                  selectedAccountId,
               );

               const txForAccount = allTx.filter(
                  (tx) => tx.bankAccountId === selectedAccountId,
               );

               const ofxTransactions = txForAccount.map((tx) => ({
                  type:
                     tx.type === "income"
                        ? ("CREDIT" as const)
                        : ("DEBIT" as const),
                  datePosted: parseDateString(tx.date),
                  amount:
                     tx.type === "income"
                        ? Math.abs(Number(tx.amount))
                        : -Math.abs(Number(tx.amount)),
                  fitId: tx.id,
                  name: tx.name ?? tx.description ?? undefined,
                  memo: tx.description ?? undefined,
               }));

               const startDate = parseDateString(from);
               const endDate = parseDateString(to);

               let ofxContent: string;

               ofxContent = generateBankStatement({
                  bankId: "BR",
                  accountId: selectedAccount.id,
                  accountType: mapAccountTypeToOFX(
                     selectedAccount.type as BankAccountType,
                  ),
                  currency: "BRL",
                  startDate,
                  endDate,
                  transactions: ofxTransactions,
               });

               const blob = new Blob([ofxContent], {
                  type: "application/x-ofx",
               });
               triggerDownload(blob, `transacoes_${from}_${to}.ofx`);
               toast.success("Exportação OFX concluída.");
            }
         } catch {
            toast.error("Erro ao exportar lançamentos.");
         }
      });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Exportar Lançamentos</CredenzaTitle>
            <CredenzaDescription>
               Selecione o formato e o período para exportar.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <FieldGroup>
               {/* Format selector */}
               <Field>
                  <FieldLabel>Formato</FieldLabel>
                  <Choicebox
                     className="grid grid-cols-2 gap-4"
                     onValueChange={(v) => {
                        if (v) setFormat(v as ExportFormat);
                     }}
                     value={format}
                  >
                     <ChoiceboxItem id="format-csv" value="csv">
                        <FileSpreadsheet className="size-5 text-muted-foreground" />
                        <ChoiceboxItemHeader>
                           <ChoiceboxItemTitle>CSV</ChoiceboxItemTitle>
                           <ChoiceboxItemDescription>
                              Planilha compatível com Excel e Google Sheets
                           </ChoiceboxItemDescription>
                        </ChoiceboxItemHeader>
                        <ChoiceboxIndicator id="format-csv" />
                     </ChoiceboxItem>

                     <ChoiceboxItem id="format-ofx" value="ofx">
                        <Landmark className="size-5 text-muted-foreground" />
                        <ChoiceboxItemHeader>
                           <ChoiceboxItemTitle>OFX</ChoiceboxItemTitle>
                           <ChoiceboxItemDescription>
                              Extrato bancário para importação em outros
                              sistemas
                           </ChoiceboxItemDescription>
                        </ChoiceboxItemHeader>
                        <ChoiceboxIndicator id="format-ofx" />
                     </ChoiceboxItem>
                  </Choicebox>
               </Field>

               {/* Date range */}
               <div className="grid grid-cols-2 gap-4">
                  <Field>
                     <FieldLabel>Data inicial</FieldLabel>
                     <DatePicker
                        className="w-full"
                        date={periodFrom}
                        onSelect={(d) => {
                           if (d) setPeriodFrom(d);
                        }}
                        placeholder="Selecione"
                     />
                  </Field>

                  <Field>
                     <FieldLabel>Data final</FieldLabel>
                     <DatePicker
                        className="w-full"
                        date={periodTo}
                        onSelect={(d) => {
                           if (d) setPeriodTo(d);
                        }}
                        placeholder="Selecione"
                     />
                  </Field>
               </div>

               {/* OFX account selector */}
               {format === "ofx" ? (
                  <Field>
                     <FieldLabel>Conta</FieldLabel>
                     <Combobox
                        className="w-full"
                        emptyMessage="Nenhuma conta encontrada."
                        onValueChange={setSelectedAccountId}
                        options={accountOptions}
                        placeholder="Selecione a conta"
                        searchPlaceholder="Buscar conta..."
                        value={selectedAccountId}
                     />
                  </Field>
               ) : null}

               {/* Export summary */}
               <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                     {format === "csv" ? "CSV" : "OFX"} &middot;{" "}
                     {periodFrom.toLocaleDateString("pt-BR")} até{" "}
                     {periodTo.toLocaleDateString("pt-BR")}
                     {format === "ofx" && selectedAccount
                        ? ` · ${selectedAccount.name}`
                        : null}
                  </p>
               </div>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter className="flex gap-2">
            <CredenzaClose asChild>
               <Button className="flex-1" variant="outline">
                  Cancelar
               </Button>
            </CredenzaClose>
            <Button
               className="flex-1"
               disabled={!canDownload || isPending}
               onClick={handleDownload}
               type="button"
            >
               {isPending ? (
                  <Spinner className="size-4 mr-2" />
               ) : (
                  <Download className="size-4 mr-2" />
               )}
               Baixar
            </Button>
         </CredenzaFooter>
      </>
   );
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function TransactionExportCredenza({
   dateFrom,
   dateTo,
}: TransactionExportCredenzaProps) {
   return (
      <Suspense
         fallback={
            <>
               <CredenzaHeader>
                  <CredenzaTitle>Exportar Lançamentos</CredenzaTitle>
                  <CredenzaDescription>
                     Selecione o formato e o período para exportar.
                  </CredenzaDescription>
               </CredenzaHeader>
               <CredenzaBody className="flex items-center justify-center py-8">
                  <Spinner className="size-6" />
               </CredenzaBody>
            </>
         }
      >
         <ExportForm dateFrom={dateFrom} dateTo={dateTo} />
      </Suspense>
   );
}
