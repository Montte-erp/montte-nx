import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";

export type TransactionRow = {
   id: string;
   teamId: string;
   type: "income" | "expense" | "transfer";
   amount: string;
   name: string | null;
   description: string | null;
   date: string;
   bankAccountId: string;
   destinationBankAccountId: string | null;
   categoryId: string | null;
   subcategoryId: string | null;
   attachmentUrl: string | null;
   tagIds?: string[];
   createdAt: Date | string;
   updatedAt: Date | string;
};

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatDate(dateStr: string): string {
   // date is stored as YYYY-MM-DD
   const [year, month, day] = dateStr.split("-");
   return `${day}/${month}/${year}`;
}

export function buildTransactionColumns(
   onEdit: (transaction: TransactionRow) => void,
   onDelete: (transaction: TransactionRow) => void,
): ColumnDef<TransactionRow>[] {
   return [
      {
         accessorKey: "date",
         header: "Data",
         cell: ({ row }) => (
            <span className="text-sm tabular-nums">
               {formatDate(row.original.date)}
            </span>
         ),
      },
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const { name, description } = row.original;
            const label = name || description;
            if (!label)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <span className="text-sm font-medium truncate max-w-[200px] block">
                  {label}
               </span>
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ row }) => {
            const { type } = row.original;
            if (type === "income") {
               return (
                  <Badge
                     className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
                     variant="outline"
                  >
                     Receita
                  </Badge>
               );
            }
            if (type === "expense") {
               return <Badge variant="destructive">Despesa</Badge>;
            }
            return <Badge variant="secondary">Transferência</Badge>;
         },
      },
      {
         accessorKey: "amount",
         header: "Valor",
         cell: ({ row }) => {
            const { type, amount } = row.original;
            if (type === "income") {
               return (
                  <span className="text-sm font-medium text-green-600 dark:text-green-500">
                     {formatBRL(amount)}
                  </span>
               );
            }
            if (type === "expense") {
               return (
                  <span className="text-sm font-medium text-destructive">
                     - {formatBRL(amount)}
                  </span>
               );
            }
            return (
               <span className="text-sm font-medium text-muted-foreground">
                  {formatBRL(amount)}
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
