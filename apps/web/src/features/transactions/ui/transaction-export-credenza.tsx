import { generateFromObjects } from "@f-o-t/csv";
import { generateBankStatement, generateCreditCardStatement } from "@f-o-t/ofx";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Spinner } from "@packages/ui/components/spinner";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
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

type BankAccountType =
   | "checking"
   | "savings"
   | "credit_card"
   | "investment"
   | "cash"
   | "other";

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
                  conta: tx.bankAccountId ?? "",
                  conta_destino: tx.destinationBankAccountId ?? "",
                  categoria: "",
                  subcategoria: "",
                  tags: Array.isArray(tx.tagIds) ? tx.tagIds.join(";") : "",
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

               if (selectedAccount.type === "credit_card") {
                  ofxContent = generateCreditCardStatement({
                     accountId: selectedAccount.id,
                     currency: "BRL",
                     startDate,
                     endDate,
                     transactions: ofxTransactions,
                  });
               } else {
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
               }

               const blob = new Blob([ofxContent], {
                  type: "application/x-ofx",
               });
               triggerDownload(blob, `transacoes_${from}_${to}.ofx`);
               toast.success("Exportação OFX concluída.");
            }
         } catch {
            toast.error("Erro ao exportar transações.");
         }
      });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Exportar Transações</CredenzaTitle>
         </CredenzaHeader>

         <CredenzaBody>
            <FieldGroup>
               {/* Format selector */}
               <Field>
                  <FieldLabel>Formato</FieldLabel>
                  <ToggleGroup
                     className="w-full"
                     onValueChange={(v) => {
                        if (v) setFormat(v as ExportFormat);
                     }}
                     type="single"
                     value={format}
                     variant="outline"
                  >
                     <ToggleGroupItem className="flex-1" value="csv">
                        CSV
                     </ToggleGroupItem>
                     <ToggleGroupItem className="flex-1" value="ofx">
                        OFX
                     </ToggleGroupItem>
                  </ToggleGroup>
               </Field>

               {/* Date range */}
               <div className="grid grid-cols-2 gap-3">
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
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <Button
               className="w-full"
               disabled={!canDownload || isPending}
               onClick={handleDownload}
               type="button"
            >
               {isPending ? <Spinner className="size-4 mr-2" /> : null}
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
                  <CredenzaTitle>Exportar Transações</CredenzaTitle>
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
