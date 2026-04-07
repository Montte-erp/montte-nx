import { generateFromObjects } from "@f-o-t/csv";
import { generateBankStatement } from "@f-o-t/ofx";
import { utils as xlsxUtils, write as xlsxWrite } from "xlsx";
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
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Spinner } from "@packages/ui/components/spinner";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Landmark, Table2 } from "lucide-react";
import { Suspense, useState, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface TransactionExportCredenzaProps {
   dateFrom?: string;
   dateTo?: string;
   onClose?: () => void;
}

type ExportFormat = "csv" | "xlsx" | "ofx";

type BankAccountType =
   | "checking"
   | "savings"
   | "investment"
   | "payment"
   | "cash";

import dayjs from "dayjs";

function getCurrentMonthRange(): { from: string; to: string } {
   const now = dayjs();
   return {
      from: now.startOf("month").format("YYYY-MM-DD"),
      to: now.endOf("month").format("YYYY-MM-DD"),
   };
}

function parseDateString(dateStr: string): Date {
   return dayjs(dateStr).hour(12).minute(0).second(0).toDate();
}

function toDateString(date: Date): string {
   return dayjs(date).format("YYYY-MM-DD");
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

function ExportForm({
   dateFrom,
   dateTo,
   onClose,
}: TransactionExportCredenzaProps) {
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
      format === "csv" ||
      format === "xlsx" ||
      (format === "ofx" && selectedAccountId !== "");

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
         if (next.data.length === 0) break;
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

            const HEADERS = [
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
            ] as const;

            if (format === "csv" || format === "xlsx") {
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

               if (format === "csv") {
                  const csv = generateFromObjects(rows, {
                     headers: [...HEADERS],
                  });
                  const blob = new Blob([csv], {
                     type: "text/csv;charset=utf-8;",
                  });
                  triggerDownload(blob, `transacoes_${from}_${to}.csv`);
                  toast.success("Exportação CSV concluída.");
               } else {
                  const ws = xlsxUtils.json_to_sheet(rows, {
                     header: [...HEADERS],
                  });
                  const wb = xlsxUtils.book_new();
                  xlsxUtils.book_append_sheet(wb, ws, "Transações");
                  const data = xlsxWrite(wb, {
                     type: "array",
                     bookType: "xlsx",
                  });
                  const blob = new Blob([data], {
                     type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  });
                  triggerDownload(blob, `transacoes_${from}_${to}.xlsx`);
                  toast.success("Exportação XLSX concluída.");
               }
            } else {
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
                  accountType: mapAccountTypeToOFX(selectedAccount.type),
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
               <Field>
                  <FieldLabel>Formato</FieldLabel>
                  <Choicebox
                     className="grid grid-cols-3 gap-2"
                     onValueChange={(v) => {
                        if (v === "csv" || v === "xlsx" || v === "ofx")
                           setFormat(v);
                     }}
                     value={format}
                  >
                     <ChoiceboxItem id="format-csv" value="csv">
                        <FileSpreadsheet className="size-5 text-muted-foreground" />
                        <ChoiceboxItemHeader>
                           <ChoiceboxItemTitle>CSV</ChoiceboxItemTitle>
                           <ChoiceboxItemDescription>
                              Texto separado por vírgulas
                           </ChoiceboxItemDescription>
                        </ChoiceboxItemHeader>
                        <ChoiceboxIndicator id="format-csv" />
                     </ChoiceboxItem>

                     <ChoiceboxItem id="format-xlsx" value="xlsx">
                        <Table2 className="size-5 text-muted-foreground" />
                        <ChoiceboxItemHeader>
                           <ChoiceboxItemTitle>XLSX</ChoiceboxItemTitle>
                           <ChoiceboxItemDescription>
                              Excel e Google Sheets
                           </ChoiceboxItemDescription>
                        </ChoiceboxItemHeader>
                        <ChoiceboxIndicator id="format-xlsx" />
                     </ChoiceboxItem>

                     <ChoiceboxItem id="format-ofx" value="ofx">
                        <Landmark className="size-5 text-muted-foreground" />
                        <ChoiceboxItemHeader>
                           <ChoiceboxItemTitle>OFX</ChoiceboxItemTitle>
                           <ChoiceboxItemDescription>
                              Extrato para outros sistemas
                           </ChoiceboxItemDescription>
                        </ChoiceboxItemHeader>
                        <ChoiceboxIndicator id="format-ofx" />
                     </ChoiceboxItem>
                  </Choicebox>
               </Field>

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

               <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                     {format.toUpperCase()} &middot;{" "}
                     {dayjs(periodFrom).format("DD/MM/YYYY")} até{" "}
                     {dayjs(periodTo).format("DD/MM/YYYY")}
                     {format === "ofx" && selectedAccount
                        ? ` · ${selectedAccount.name}`
                        : null}
                  </p>
               </div>

               <div className="flex gap-2">
                  <Button
                     className="flex-1"
                     onClick={onClose}
                     type="button"
                     variant="outline"
                  >
                     Cancelar
                  </Button>
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
               </div>
            </FieldGroup>
         </CredenzaBody>
      </>
   );
}

export function TransactionExportCredenza({
   dateFrom,
   dateTo,
   onClose,
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
               <CredenzaBody>
                  <div className="flex items-center justify-center py-8">
                     <Spinner className="size-6" />
                  </div>
               </CredenzaBody>
            </>
         }
      >
         <ExportForm dateFrom={dateFrom} dateTo={dateTo} onClose={onClose} />
      </Suspense>
   );
}
