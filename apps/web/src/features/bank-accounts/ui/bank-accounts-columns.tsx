import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

export type BankAccountRow = {
   id: string;
   teamId: string;
   name: string;
   type:
      | "checking"
      | "savings"
      | "credit_card"
      | "investment"
      | "cash"
      | "other";
   color: string;
   iconUrl?: string | null;
   initialBalance: string;
   currentBalance: string;
   createdAt: Date | string;
   updatedAt: Date | string;
};

const TYPE_LABELS: Record<BankAccountRow["type"], string> = {
   checking: "Conta Corrente",
   savings: "Poupança",
   credit_card: "Cartão de Crédito",
   investment: "Investimento",
   cash: "Dinheiro",
   other: "Outro",
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
                  size="icon"
                  variant="ghost"
               >
                  <Pencil className="size-4" />
                  <span className="sr-only">Editar</span>
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(row.original)}
                  size="icon"
                  variant="ghost"
               >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir</span>
               </Button>
            </div>
         ),
      },
   ];
}

export { formatBRL, TYPE_LABELS };
