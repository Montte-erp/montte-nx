import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard } from "lucide-react";

export type CreditCardRow = {
   id: string;
   teamId: string;
   name: string;
   color: string;
   iconUrl?: string | null;
   creditLimit: string;
   closingDay: number;
   dueDay: number;
   bankAccountId?: string | null;
   createdAt: Date | string;
   updatedAt: Date | string;
};

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

export function buildCreditCardColumns(): ColumnDef<CreditCardRow>[] {
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
         accessorKey: "creditLimit",
         header: "Limite",
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {formatBRL(row.original.creditLimit)}
            </span>
         ),
      },
      {
         accessorKey: "closingDay",
         header: "Fechamento",
         cell: ({ row }) => (
            <Badge variant="secondary">
               <CreditCard className="size-3 mr-1" />
               Dia {row.original.closingDay}
            </Badge>
         ),
      },
      {
         accessorKey: "dueDay",
         header: "Vencimento",
         cell: ({ row }) => (
            <Badge variant="outline">Dia {row.original.dueDay}</Badge>
         ),
      },
   ];
}
