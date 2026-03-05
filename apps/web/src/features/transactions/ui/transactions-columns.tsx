import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";

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

export function buildTransactionColumns(): ColumnDef<TransactionRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const { name } = row.original;
            if (!name)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <span className="text-sm font-medium truncate max-w-[200px] block">
                  {name}
               </span>
            );
         },
      },
      {
         accessorKey: "description",
         header: "Descrição",
         cell: ({ row }) => {
            const { description } = row.original;
            if (!description)
               return <span className="text-sm text-muted-foreground">—</span>;
            return (
               <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                  {description}
               </span>
            );
         },
      },
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
   ];
}
