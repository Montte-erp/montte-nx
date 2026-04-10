import type { Outputs } from "@/integrations/orpc/client";
import { generateFromObjects } from "@f-o-t/csv";
import { format, of } from "@f-o-t/money";
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
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Table2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { TYPE_LABELS } from "./bank-accounts-columns";

type ExportFormat = "csv" | "xlsx";
type BankAccount = Outputs["bankAccounts"]["getAll"][number];

const FORMAT_OPTIONS = [
   {
      value: "csv" as const,
      label: "CSV",
      description: "Compatível com qualquer planilha ou editor de texto",
      icon: FileSpreadsheet,
      iconClass: "text-emerald-600",
   },
   {
      value: "xlsx" as const,
      label: "XLSX",
      description: "Excel e Google Sheets — com formatação de colunas",
      icon: Table2,
      iconClass: "text-green-600",
   },
] as const;

const EXPORT_HEADERS = [
   "nome",
   "tipo",
   "saldo_inicial",
   "saldo_atual",
   "saldo_projetado",
   "cor",
] as const;

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function triggerDownload(blob: Blob, filename: string): void {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

function buildRows(accounts: BankAccount[]) {
   return accounts.map((a) => ({
      nome: a.name,
      tipo: TYPE_LABELS[a.type],
      saldo_inicial: formatBRL(a.initialBalance),
      saldo_atual: formatBRL(a.currentBalance),
      saldo_projetado: formatBRL(a.projectedBalance),
      cor: a.color,
   }));
}

export function BankAccountExportCredenza({
   onClose,
}: {
   onClose?: () => void;
}) {
   const { data: accounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
   const [isPending, startTransition] = useTransition();

   function handleExport() {
      startTransition(() => {
         try {
            const rows = buildRows(accounts);

            if (exportFormat === "csv") {
               const csv = generateFromObjects(rows, {
                  headers: [...EXPORT_HEADERS],
               });
               triggerDownload(
                  new Blob([csv], { type: "text/csv;charset=utf-8;" }),
                  "contas-bancarias.csv",
               );
            } else {
               const ws = xlsxUtils.json_to_sheet(rows, {
                  header: [...EXPORT_HEADERS],
               });
               const wb = xlsxUtils.book_new();
               xlsxUtils.book_append_sheet(wb, ws, "Contas");
               const buf = xlsxWrite(wb, { type: "array", bookType: "xlsx" });
               triggerDownload(
                  new Blob([buf], {
                     type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }),
                  "contas-bancarias.xlsx",
               );
            }
            onClose?.();
         } catch {
            toast.error("Erro ao exportar contas bancárias.");
         }
      });
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Exportar contas bancárias</CredenzaTitle>
            <CredenzaDescription>
               {accounts.length} conta(s) serão exportadas
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <Choicebox className="grid grid-cols-2 gap-2">
               {FORMAT_OPTIONS.map(
                  ({ value, label, description, icon: Icon, iconClass }) => (
                     <ChoiceboxItem
                        key={value}
                        value={value}
                        id={`export-${value}`}
                     >
                        <ChoiceboxIndicator
                           id={`export-${value}`}
                           className="sr-only"
                        />
                        <button
                           type="button"
                           className="flex flex-col gap-2 w-full cursor-pointer"
                           onClick={() => setExportFormat(value)}
                        >
                           <Icon className={`size-5 shrink-0 ${iconClass}`} />
                           <ChoiceboxItemHeader>
                              <ChoiceboxItemTitle>{label}</ChoiceboxItemTitle>
                              <ChoiceboxItemDescription>
                                 {description}
                              </ChoiceboxItemDescription>
                           </ChoiceboxItemHeader>
                        </button>
                     </ChoiceboxItem>
                  ),
               )}
            </Choicebox>
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               className="w-full"
               disabled={isPending || accounts.length === 0}
               onClick={handleExport}
               type="button"
            >
               <Download className="size-4" />
               Exportar {accounts.length} conta(s)
            </Button>
         </CredenzaFooter>
      </>
   );
}
