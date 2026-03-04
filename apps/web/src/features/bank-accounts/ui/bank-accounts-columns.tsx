import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import type { ColumnDef } from "@tanstack/react-table";
import { Info, Pencil, Trash2 } from "lucide-react";

export type BankAccountRow = {
   id: string;
   teamId: string;
   name: string;
   type: "checking" | "savings" | "investment" | "cash";
   color: string;
   iconUrl?: string | null;
   initialBalance: string;
   currentBalance: string;
   projectedBalance: string;
   createdAt: Date | string;
   updatedAt: Date | string;
};

const TYPE_LABELS: Record<BankAccountRow["type"], string> = {
   checking: "Conta Corrente",
   savings: "Poupança",
   investment: "Investimento",
   cash: "Carteira",
};

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

export function buildBankAccountColumns(
   onEdit: (account: BankAccountRow) => void,
   onDelete: (account: BankAccountRow) => void,
): ColumnDef<BankAccountRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => (
            <div className="flex items-center gap-2 min-w-0">
               <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: row.original.color }}
               />
               <span className="font-medium truncate">{row.original.name}</span>
            </div>
         ),
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => (
            <Badge variant="secondary">{TYPE_LABELS[row.original.type]}</Badge>
         ),
      },
      {
         accessorKey: "initialBalance",
         header: "Saldo Inicial",
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {formatBRL(row.original.initialBalance)}
            </span>
         ),
      },
      {
         accessorKey: "currentBalance",
         header: "Saldo Atual",
         cell: ({ row }) => {
            const balance = Number(row.original.currentBalance);
            return (
               <span
                  className={`text-sm font-medium ${
                     balance >= 0
                        ? "text-green-600 dark:text-green-500"
                        : "text-destructive"
                  }`}
               >
                  {formatBRL(row.original.currentBalance)}
               </span>
            );
         },
      },
      {
         accessorKey: "projectedBalance",
         header: () => (
            <TooltipProvider>
               <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                     Saldo Previsto{" "}
                     <Info className="size-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                     Saldo atual + contas a receber pendentes - contas a pagar
                     pendentes
                  </TooltipContent>
               </Tooltip>
            </TooltipProvider>
         ),
         cell: ({ row }) => {
            const balance = Number(row.original.projectedBalance);
            return (
               <span
                  className={`text-sm font-medium ${
                     balance >= 0
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-destructive"
                  }`}
               >
                  {formatBRL(row.original.projectedBalance)}
               </span>
            );
         },
      },
      {
         id: "actions",
         header: "",
         cell: ({ row }) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for table row click
            <div
               className="flex items-center justify-end gap-1"
               onClick={(e) => e.stopPropagation()}
               onKeyDown={(e) => e.stopPropagation()}
            >
               <Button
                  onClick={() => onEdit(row.original)}
                  tooltip="Editar"
                  variant="outline"
               >
                  <Pencil className="size-4" />
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original)}
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </div>
         ),
      },
   ];
}

export { formatBRL, TYPE_LABELS };
