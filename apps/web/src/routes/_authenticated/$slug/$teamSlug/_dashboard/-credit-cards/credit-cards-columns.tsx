import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { CreditCard } from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";

export type CreditCardRow = Outputs["creditCards"]["getAll"]["data"][number];

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

const BRAND_LABEL: Record<string, string> = {
   visa: "Visa",
   mastercard: "Mastercard",
   elo: "Elo",
   amex: "Amex",
   hipercard: "Hipercard",
   other: "Outra",
};

const STATUS_VARIANT = {
   active: "success",
   blocked: "secondary",
   cancelled: "destructive",
} as const;

const STATUS_LABEL = {
   active: "Ativo",
   blocked: "Bloqueado",
   cancelled: "Cancelado",
} as const;

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
         meta: { label: "Nome" },
      },
      {
         accessorKey: "brand",
         header: "Bandeira",
         cell: ({ row }) => {
            const brand = row.original.brand;
            if (!brand) return <span className="text-muted-foreground">—</span>;
            return (
               <span className="text-sm">{BRAND_LABEL[brand] ?? brand}</span>
            );
         },
         meta: { label: "Bandeira" },
      },
      {
         accessorKey: "creditLimit",
         header: "Limite",
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground tabular-nums">
               {formatBRL(row.original.creditLimit)}
            </span>
         ),
         meta: { label: "Limite", align: "right" },
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
         meta: { label: "Fechamento" },
      },
      {
         accessorKey: "dueDay",
         header: "Vencimento",
         cell: ({ row }) => (
            <Badge variant="outline">Dia {row.original.dueDay}</Badge>
         ),
         meta: { label: "Vencimento" },
      },
      {
         accessorKey: "status",
         header: "Status",
         cell: ({ row }) => {
            const status = row.original.status as keyof typeof STATUS_LABEL;
            return (
               <Badge variant={STATUS_VARIANT[status] ?? "default"}>
                  {STATUS_LABEL[status] ?? status}
               </Badge>
            );
         },
         meta: { label: "Status", filterVariant: "select" },
      },
   ];
}
