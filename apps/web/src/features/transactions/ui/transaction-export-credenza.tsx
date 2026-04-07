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
import dayjs from "dayjs";
import { Download, FileSpreadsheet, Landmark, Table2 } from "lucide-react";
import { Suspense, useCallback, useMemo, useState, useTransition } from "react";
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

const TX_HEADERS = [
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

type TxRow = Record<(typeof TX_HEADERS)[number], string | number | boolean>;

const FORMAT_OPTIONS: {
   value: ExportFormat;
   label: string;
   description: string;
   icon: React.ElementType;
}[] = [
   {
      value: "csv",
      label: "CSV",
      description: "Texto separado por vírgulas",
      icon: FileSpreadsheet,
   },
   {
      value: "xlsx",
      label: "XLSX",
      description: "Excel e Google Sheets",
      icon: Table2,
   },
   {
      value: "ofx",
      label: "OFX",
      description: "Extrato para outros sistemas",
      icon: Landmark,
   },
];

const OFX_ACCOUNT_TYPE_MAP: Record<
   BankAccountType,
   "CHECKING" | "SAVINGS" | "MONEYMRKT"
> = {
   savings: "SAVINGS",
   investment: "MONEYMRKT",
   checking: "CHECKING",
   payment: "CHECKING",
   cash: "CHECKING",
};

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

// biome-ignore lint/suspicious/noExplicitAny: transaction shape is runtime-typed
function mapTxToRow(tx: any): TxRow {
   return {
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
   };
}

// biome-ignore lint/suspicious/noExplicitAny: transaction shape is runtime-typed
function mapTxToOFX(tx: any) {
   return {
      type: tx.type === "income" ? ("CREDIT" as const) : ("DEBIT" as const),
      datePosted: parseDateString(tx.date),
      amount:
         tx.type === "income"
            ? Math.abs(Number(tx.amount))
            : -Math.abs(Number(tx.amount)),
      fitId: tx.id,
      name: tx.name ?? tx.description ?? undefined,
      memo: tx.description ?? undefined,
   };
}

function ExportCredenzaHeader() {
   return (
      <CredenzaHeader>
         <CredenzaTitle>Exportar Lançamentos</CredenzaTitle>
         <CredenzaDescription>
            Selecione o formato e o período para exportar.
         </CredenzaDescription>
      </CredenzaHeader>
   );
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

   const accountOptions = useMemo(
      () => bankAccounts.map((acc) => ({ value: acc.id, label: acc.name })),
      [bankAccounts],
   );

   const selectedAccount = useMemo(
      () => bankAccounts.find((acc) => acc.id === selectedAccountId),
      [bankAccounts, selectedAccountId],
   );

   const canDownload =
      format === "csv" || format === "xlsx" || selectedAccountId !== "";

   const fetchAllTransactions = useCallback(
      async (from: string, to: string, bankAccountId?: string) => {
         const baseInput = {
            dateFrom: from,
            dateTo: to,
            pageSize: 100,
            ...(bankAccountId ? { bankAccountId } : {}),
         };

         const firstPage = await queryClient.fetchQuery(
            orpc.transactions.getAll.queryOptions({
               input: { ...baseInput, page: 1 },
            }),
         );

         // biome-ignore lint/suspicious/noExplicitAny: transaction shape is runtime-typed
         let allTx: any[] = firstPage.data;
         let page = 2;

         while (allTx.length < firstPage.total) {
            const next = await queryClient.fetchQuery(
               orpc.transactions.getAll.queryOptions({
                  input: { ...baseInput, page },
               }),
            );
            if (next.data.length === 0) break;
            allTx = [...allTx, ...next.data];
            page++;
         }

         return allTx;
      },
      [queryClient],
   );

   const handleFormatChange = useCallback((v: string) => {
      if (v === "csv" || v === "xlsx" || v === "ofx") setFormat(v);
   }, []);

   const handleFromSelect = useCallback((d: Date | undefined) => {
      if (d) setPeriodFrom(d);
   }, []);

   const handleToSelect = useCallback((d: Date | undefined) => {
      if (d) setPeriodTo(d);
   }, []);

   const handleDownload = useCallback(() => {
      startTransition(async () => {
         try {
            const from = toDateString(periodFrom);
            const to = toDateString(periodTo);
            const filename = `transacoes_${from}_${to}`;

            if (format === "csv" || format === "xlsx") {
               const allTx = await fetchAllTransactions(from, to);
               const rows = allTx.map(mapTxToRow);

               if (format === "csv") {
                  const csv = generateFromObjects(rows, {
                     headers: [...TX_HEADERS],
                  });
                  triggerDownload(
                     new Blob([csv], { type: "text/csv;charset=utf-8;" }),
                     `${filename}.csv`,
                  );
                  toast.success("Exportação CSV concluída.");
                  return;
               }

               const ws = xlsxUtils.json_to_sheet(rows, {
                  header: [...TX_HEADERS],
               });
               const wb = xlsxUtils.book_new();
               xlsxUtils.book_append_sheet(wb, ws, "Transações");
               const data = xlsxWrite(wb, { type: "array", bookType: "xlsx" });
               triggerDownload(
                  new Blob([data], {
                     type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }),
                  `${filename}.xlsx`,
               );
               toast.success("Exportação XLSX concluída.");
               return;
            }

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

            const ofxContent = generateBankStatement({
               bankId: "BR",
               accountId: selectedAccount.id,
               accountType: OFX_ACCOUNT_TYPE_MAP[selectedAccount.type],
               currency: "BRL",
               startDate: parseDateString(from),
               endDate: parseDateString(to),
               transactions: txForAccount.map(mapTxToOFX),
            });

            triggerDownload(
               new Blob([ofxContent], { type: "application/x-ofx" }),
               `${filename}.ofx`,
            );
            toast.success("Exportação OFX concluída.");
         } catch {
            toast.error("Erro ao exportar lançamentos.");
         }
      });
   }, [
      format,
      periodFrom,
      periodTo,
      selectedAccount,
      selectedAccountId,
      fetchAllTransactions,
   ]);

   return (
      <>
         <ExportCredenzaHeader />

         <CredenzaBody>
            <FieldGroup>
               <Field>
                  <FieldLabel>Formato</FieldLabel>
                  <Choicebox
                     className="grid grid-cols-3 gap-2"
                     onValueChange={handleFormatChange}
                     value={format}
                  >
                     {FORMAT_OPTIONS.map(
                        ({ value, label, description, icon: Icon }) => (
                           <ChoiceboxItem
                              key={value}
                              id={`format-${value}`}
                              value={value}
                           >
                              <Icon className="size-5 text-muted-foreground" />
                              <ChoiceboxItemHeader>
                                 <ChoiceboxItemTitle>
                                    {label}
                                 </ChoiceboxItemTitle>
                                 <ChoiceboxItemDescription>
                                    {description}
                                 </ChoiceboxItemDescription>
                              </ChoiceboxItemHeader>
                              <ChoiceboxIndicator id={`format-${value}`} />
                           </ChoiceboxItem>
                        ),
                     )}
                  </Choicebox>
               </Field>

               <div className="grid grid-cols-2 gap-4">
                  <Field>
                     <FieldLabel>Data inicial</FieldLabel>
                     <DatePicker
                        className="w-full"
                        date={periodFrom}
                        onSelect={handleFromSelect}
                        placeholder="Selecione"
                     />
                  </Field>

                  <Field>
                     <FieldLabel>Data final</FieldLabel>
                     <DatePicker
                        className="w-full"
                        date={periodTo}
                        onSelect={handleToSelect}
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
               <ExportCredenzaHeader />
               <CredenzaBody>
                  <div className="flex items-center justify-center py-4">
                     <Spinner className="size-4" />
                  </div>
               </CredenzaBody>
            </>
         }
      >
         <ExportForm dateFrom={dateFrom} dateTo={dateTo} onClose={onClose} />
      </Suspense>
   );
}
