import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import type { Outputs } from "@/integrations/orpc/client";

export type TransactionRow = Outputs["transactions"]["getAll"]["data"][number];

export function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatDate(dateStr: string): string {
   // date is stored as YYYY-MM-DD
   const [year, month, day] = dateStr.split("-");
   return `${day}/${month}/${year}`;
}

export function buildTransactionColumns(): ColumnDef<TransactionRow>[] {
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
            const {
               name,
               recurringTransactionId,
               isInstallment,
               installmentNumber,
               installmentCount,
               status,
            } = row.original;
            if (!name)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate max-w-[200px]">
                     {name}
                  </span>
                  {recurringTransactionId && (
                     <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
                        Recorrente
                     </span>
                  )}
                  {isInstallment && installmentNumber && (
                     <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-300">
                        {installmentNumber}/{installmentCount}
                     </span>
                  )}
                  {status === "pending" && (
                     <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                        Pendente
                     </span>
                  )}
               </div>
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
         accessorKey: "contactName",
         header: "Fornecedor/Cliente",
         cell: ({ row }) => {
            const name = row.original.contactName;
            if (!name)
               return <span className="text-xs text-muted-foreground">—</span>;
            return <span className="text-sm">{name}</span>;
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
         accessorKey: "bankAccountName",
         header: "Conta",
         cell: ({ row }) => {
            const name = row.original.bankAccountName;
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
   ];
}
