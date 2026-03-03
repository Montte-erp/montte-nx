import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { ColumnDef } from "@tanstack/react-table";
import {
   CalendarDays,
   MoreHorizontal,
   Pencil,
   Repeat,
   Trash2,
} from "lucide-react";

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
   contactId: string | null;
   contactName?: string | null;
   billId?: string | null;
   creditCardId: string | null;
   categoryName?: string | null;
   creditCardName?: string | null;
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
   onInstallment?: (transaction: TransactionRow) => void,
   onRecurring?: (transaction: TransactionRow) => void,
   onUnpay?: (transaction: TransactionRow) => void,
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
         accessorKey: "categoryName",
         header: "Categoria",
         cell: ({ row }) => {
            const name = row.original.categoryName;
            if (!name)
               return <span className="text-xs text-muted-foreground">—</span>;
            return <span className="text-sm">{name}</span>;
         },
      },
      {
         accessorKey: "creditCardName",
         header: "Cartão",
         cell: ({ row }) => {
            const name = row.original.creditCardName;
            if (!name)
               return <span className="text-xs text-muted-foreground">—</span>;
            return <span className="text-sm">{name}</span>;
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
         cell: ({ row }) => {
            const tx = row.original;
            const isTransfer = tx.type === "transfer";
            return (
               // biome-ignore lint/a11y/noStaticElementInteractions: stopPropagation wrapper for table row click
               <div
                  className="flex items-center justify-end gap-1"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
               >
                  <Button
                     onClick={() => onEdit(tx)}
                     tooltip="Editar"
                     variant="outline"
                  >
                     <Pencil className="size-4" />
                  </Button>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() => onDelete(tx)}
                     tooltip="Excluir"
                     variant="outline"
                  >
                     <Trash2 className="size-4" />
                  </Button>
                  {!isTransfer &&
                     (onInstallment ||
                        onRecurring ||
                        (onUnpay && tx.billId)) && (
                        <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                              <Button variant="outline">
                                 <MoreHorizontal className="size-4" />
                                 <span className="sr-only">Mais ações</span>
                              </Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                              <DropdownMenuSeparator />
                              {onInstallment && (
                                 <DropdownMenuItem
                                    onClick={() => onInstallment(tx)}
                                 >
                                    <CalendarDays className="size-4 mr-2" />
                                    Parcelar Transação
                                 </DropdownMenuItem>
                              )}
                              {onRecurring && (
                                 <DropdownMenuItem
                                    onClick={() => onRecurring(tx)}
                                 >
                                    <Repeat className="size-4 mr-2" />
                                    Criar Transação Recorrente
                                 </DropdownMenuItem>
                              )}
                              {onUnpay && tx.billId && (
                                 <DropdownMenuItem onClick={() => onUnpay(tx)}>
                                    Marcar como Não Pago
                                 </DropdownMenuItem>
                              )}
                           </DropdownMenuContent>
                        </DropdownMenu>
                     )}
               </div>
            );
         },
      },
   ];
}
