import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { useMutation } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

export type TransactionRow = Outputs["transactions"]["getAll"]["data"][number];

export function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatDate(dateStr: string): string {
   // date is stored as YYYY-MM-DD
   const [year, month, day] = dateStr.split("-");
   return `${day}/${month}/${year}`;
}

function SuggestedCategoryCell({
   id,
   categoryName,
}: {
   id: string;
   categoryName: string | null;
}) {
   const accept = useMutation(
      orpc.transactions.acceptSuggestedCategory.mutationOptions(),
   );
   const dismiss = useMutation(
      orpc.transactions.dismissSuggestedCategory.mutationOptions(),
   );

   return (
      <Popover>
         <PopoverTrigger asChild>
            <Badge variant="outline" className="text-xs cursor-pointer">
               sugestão IA
            </Badge>
         </PopoverTrigger>
         <PopoverContent className="w-56 p-3">
            {categoryName && (
               <p className="text-sm font-medium">{categoryName}</p>
            )}
            <p className="text-sm text-muted-foreground">
               Categoria sugerida pela IA. Deseja aceitar?
            </p>
            <div className="flex gap-2">
               <Button
                  size="sm"
                  className="flex-1"
                  disabled={accept.isPending || dismiss.isPending}
                  onClick={() => accept.mutate({ id })}
               >
                  Aceitar
               </Button>
               <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={accept.isPending || dismiss.isPending}
                  onClick={() => dismiss.mutate({ id })}
               >
                  Ignorar
               </Button>
            </div>
         </PopoverContent>
      </Popover>
   );
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
            const hasSuggestion = !name && row.original.suggestedCategoryId;
            if (!name && !hasSuggestion)
               return <span className="text-xs text-muted-foreground">—</span>;
            if (hasSuggestion)
               return (
                  <SuggestedCategoryCell
                     id={row.original.id}
                     categoryName={row.original.suggestedCategoryName ?? null}
                  />
               );
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
         meta: {
            label: "Valor",
            align: "right",
            filterVariant: "range",
            exportable: true,
         },
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
