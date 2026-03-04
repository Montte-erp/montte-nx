import { Badge } from "@packages/ui/components/badge";
import { DataTable } from "@packages/ui/components/data-table";
import { cn } from "@packages/ui/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

interface WebhookDelivery {
   id: string;
   status: string;
   eventName: string;
   httpStatusCode?: number | null;
   deliveredAt?: Date | string | null;
   errorMessage?: string | null;
   responseBody?: string | null;
}

interface WebhookDeliveriesTableProps {
   deliveries: WebhookDelivery[];
}

function formatTimestamp(value?: Date | string | null) {
   if (!value) return "-";
   const date = typeof value === "string" ? new Date(value) : value;
   return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
   });
}

function getStatusBadgeVariant(status: string) {
   const normalized = status.toLowerCase();
   if (normalized.includes("success")) return "default" as const;
   if (normalized.includes("fail") || normalized.includes("error")) {
      return "destructive" as const;
   }
   if (normalized.includes("pending") || normalized.includes("retry")) {
      return "secondary" as const;
   }
   return "outline" as const;
}

function getErrorSnippet(delivery: WebhookDelivery) {
   const message = delivery.errorMessage || delivery.responseBody;
   if (!message) return "-";
   if (message.length <= 120) return message;
   return `${message.slice(0, 117)}...`;
}

export function WebhookDeliveriesTable({
   deliveries,
}: WebhookDeliveriesTableProps) {
   const columns = useMemo<ColumnDef<WebhookDelivery>[]>(
      () => [
         {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
               <Badge
                  className={cn(
                     "capitalize",
                     row.original.status.toLowerCase().includes("success") &&
                        "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                  )}
                  variant={getStatusBadgeVariant(row.original.status)}
               >
                  {row.original.status}
               </Badge>
            ),
         },
         {
            accessorKey: "eventName",
            header: "Evento",
            cell: ({ row }) => (
               <span className="font-mono text-xs">
                  {row.original.eventName}
               </span>
            ),
         },
         {
            accessorKey: "httpStatusCode",
            header: "HTTP",
            cell: ({ row }) => (
               <span className="text-sm">
                  {row.original.httpStatusCode ?? "-"}
               </span>
            ),
         },
         {
            accessorKey: "deliveredAt",
            header: "Entregue em",
            cell: ({ row }) => (
               <span className="text-sm">
                  {formatTimestamp(row.original.deliveredAt)}
               </span>
            ),
         },
         {
            id: "error",
            header: "Erro",
            cell: ({ row }) => (
               <span className="text-xs text-muted-foreground max-w-[240px] truncate">
                  {getErrorSnippet(row.original)}
               </span>
            ),
         },
      ],
      [],
   );

   return (
      <div className="p-4">
         <DataTable
            columns={columns}
            data={deliveries}
            getRowId={(row) => row.id}
         />
      </div>
   );
}
