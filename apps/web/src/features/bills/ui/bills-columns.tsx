import dayjs from "dayjs";
import { format, of } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertCircle, Check, Clock, XCircle } from "lucide-react";

export type BillRow = {
   id: string;
   teamId: string;
   name: string;
   type: "payable" | "receivable";
   status: "pending" | "paid" | "cancelled";
   amount: string;
   dueDate: string;
   paidAt: Date | string | null;
   installmentIndex: number | null;
   installmentTotal: number | null;
   bankAccount?: { id: string; name: string } | null;
   category?: { id: string; name: string; color: string | null } | null;
};

function computeDisplayStatus(
   row: BillRow,
): "pending" | "paid" | "overdue" | "cancelled" {
   if (row.status === "paid") return "paid";
   if (row.status === "cancelled") return "cancelled";
   const today = dayjs().format("YYYY-MM-DD");
   if (row.dueDate < today) return "overdue";
   return "pending";
}

function formatBRL(value: string | number): string {
   return format(of(String(value), "BRL"), "pt-BR");
}

function formatDate(dateStr: string): string {
   const [year, month, day] = dateStr.split("-");
   return `${day}/${month}/${year}`;
}

const STATUS_CONFIG = {
   pending: { label: "Pendente", variant: "outline" as const, icon: Clock },
   overdue: {
      label: "Vencida",
      variant: "destructive" as const,
      icon: AlertCircle,
   },
   paid: { label: "Paga", variant: "secondary" as const, icon: Check },
   cancelled: {
      label: "Cancelada",
      variant: "outline" as const,
      icon: XCircle,
   },
};

export function buildBillsColumns(): ColumnDef<BillRow>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const { installmentIndex, installmentTotal } = row.original;
            const suffix =
               installmentIndex && installmentTotal
                  ? ` (${installmentIndex}/${installmentTotal})`
                  : "";
            return (
               <span className="font-medium">
                  {row.original.name}
                  {suffix && (
                     <span className="text-muted-foreground text-xs ml-1">
                        {suffix}
                     </span>
                  )}
               </span>
            );
         },
      },
      {
         id: "status",
         header: "Status",
         cell: ({ row }) => {
            const displayStatus = computeDisplayStatus(row.original);
            const config = STATUS_CONFIG[displayStatus];
            const Icon = config.icon;
            return (
               <Badge
                  className="flex items-center gap-1 w-fit"
                  variant={config.variant}
               >
                  <Icon className="size-3" />
                  {config.label}
               </Badge>
            );
         },
      },
      {
         accessorKey: "dueDate",
         header: "Vencimento",
         cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
               {formatDate(row.original.dueDate)}
            </span>
         ),
      },
      {
         accessorKey: "amount",
         header: "Valor",
         cell: ({ row }) => (
            <span className="font-medium tabular-nums">
               {formatBRL(row.original.amount)}
            </span>
         ),
      },
      {
         accessorKey: "category",
         header: "Categoria",
         cell: ({ row }) => {
            const cat = row.original.category;
            if (!cat)
               return <span className="text-muted-foreground text-sm">—</span>;
            return (
               <div className="flex items-center gap-1.5">
                  {cat.color && (
                     <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                     />
                  )}
                  <span className="text-sm">{cat.name}</span>
               </div>
            );
         },
      },
   ];
}

export { formatBRL, formatDate, computeDisplayStatus, STATUS_CONFIG };
