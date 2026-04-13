import { generateFromObjects } from "@f-o-t/csv";
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
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Spinner } from "@packages/ui/components/spinner";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Download, FileSpreadsheet, Table2 } from "lucide-react";
import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

type ExportFormat = "csv" | "xlsx";

const CSV_HEADERS = [
   "nome",
   "limite_credito",
   "dia_fechamento",
   "dia_vencimento",
   "status",
   "bandeira",
   "conta_bancaria_id",
   "criado_em",
] as const;

type CreditCardRow = Record<(typeof CSV_HEADERS)[number], string | number>;

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
      label: "Excel",
      description: "Excel e Google Sheets",
      icon: Table2,
   },
];

function triggerDownload(blob: Blob, filename: string): void {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

interface CreditCardsExportCredenzaProps {
   format: ExportFormat;
   onFormatChange: (f: ExportFormat) => void;
   onClose: () => void;
}

export function CreditCardsExportCredenza({
   format,
   onFormatChange,
   onClose,
}: CreditCardsExportCredenzaProps) {
   const [isPending, startTransition] = useTransition();

   const { data: result } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({ input: { pageSize: 500 } }),
   );

   const handleFormatChange = useCallback(
      (v: string) => {
         if (v === "csv" || v === "xlsx") onFormatChange(v);
      },
      [onFormatChange],
   );

   const handleDownload = useCallback(() => {
      startTransition(async () => {
         try {
            const rows: CreditCardRow[] = result.data.map((c) => ({
               nome: c.name,
               limite_credito: c.creditLimit,
               dia_fechamento: c.closingDay,
               dia_vencimento: c.dueDay,
               status: c.status,
               bandeira: c.brand ?? "",
               conta_bancaria_id: c.bankAccountId ?? "",
               criado_em: dayjs(c.createdAt).format("YYYY-MM-DD"),
            }));

            const filename = `cartoes-${dayjs().format("YYYY-MM-DD")}`;

            if (format === "csv") {
               const csv = generateFromObjects(rows, {
                  headers: [...CSV_HEADERS],
               });
               triggerDownload(
                  new Blob([csv], { type: "text/csv;charset=utf-8;" }),
                  `${filename}.csv`,
               );
               toast.success("Exportação CSV concluída.");
            } else {
               const ws = xlsxUtils.json_to_sheet(rows, {
                  header: [...CSV_HEADERS],
               });
               const wb = xlsxUtils.book_new();
               xlsxUtils.book_append_sheet(wb, ws, "Cartões");
               const data = xlsxWrite(wb, { type: "array", bookType: "xlsx" });
               triggerDownload(
                  new Blob([data], {
                     type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }),
                  `${filename}.xlsx`,
               );
               toast.success("Exportação XLSX concluída.");
            }

            onClose();
         } catch {
            toast.error("Erro ao exportar cartões de crédito.");
         }
      });
   }, [format, result.data, onClose]);

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Exportar cartões de crédito</CredenzaTitle>
            <CredenzaDescription>
               {result.data.length}{" "}
               {result.data.length === 1
                  ? "cartão será exportado"
                  : "cartões serão exportados"}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <FieldGroup>
               <Field>
                  <FieldLabel>Formato</FieldLabel>
                  <Choicebox
                     className="grid grid-cols-2 gap-2"
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

               <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                     {format.toUpperCase()} &middot; {result.data.length}{" "}
                     {result.data.length === 1 ? "cartão" : "cartões"}
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
                     className="flex-1 gap-2"
                     disabled={isPending || result.data.length === 0}
                     onClick={handleDownload}
                     type="button"
                  >
                     {isPending ? (
                        <Spinner className="size-4" />
                     ) : (
                        <Download className="size-4" />
                     )}
                     Baixar
                  </Button>
               </div>
            </FieldGroup>
         </CredenzaBody>
      </>
   );
}
