import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit } from "lucide-react";
import { useMemo } from "react";

export type WebhookEndpoint = {
   id: string;
   url: string;
   description: string | null;
   eventPatterns: string[];
   signingSecret: string;
   isActive: boolean;
   failureCount: number;
   lastSuccessAt?: Date | string | null;
   lastFailureAt?: Date | string | null;
   organizationId: string;
   teamId: string;
   apiKeyId?: string | null;
   createdAt: Date | string;
   updatedAt: Date | string;
};

interface WebhooksTableProps {
   webhooks: WebhookEndpoint[];
   isLoading?: boolean;
   onEdit: (webhook: WebhookEndpoint) => void;
   onDelete?: (webhook: WebhookEndpoint) => void;
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

function buildEventSummary(events: string[]) {
   if (events.length === 0) return "Nenhum";
   if (events.length === 1) return "1 evento";
   return `${events.length} eventos`;
}

export function WebhooksTable({
   webhooks,
   isLoading,
   onEdit,
   onDelete,
}: WebhooksTableProps) {
   const columns = useMemo<ColumnDef<WebhookEndpoint>[]>(
      () => [
         {
            accessorKey: "url",
            header: "URL",
            cell: ({ row }) => (
               <div className="min-w-0">
                  <p className="font-medium truncate max-w-[320px]">
                     {row.original.url}
                  </p>
                  {row.original.description && (
                     <p className="text-xs text-muted-foreground truncate max-w-[320px]">
                        {row.original.description}
                     </p>
                  )}
               </div>
            ),
            maxSize: 340,
         },
         {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
               <Badge variant={row.original.isActive ? "default" : "secondary"}>
                  {row.original.isActive ? "Ativo" : "Inativo"}
               </Badge>
            ),
         },
         {
            accessorKey: "eventPatterns",
            header: "Eventos",
            cell: ({ row }) => (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <span className="text-sm text-muted-foreground cursor-help">
                        {buildEventSummary(row.original.eventPatterns)}
                     </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[320px]">
                     <div className="space-y-1">
                        {row.original.eventPatterns.map((event) => (
                           <div className="font-mono text-xs" key={event}>
                              {event}
                           </div>
                        ))}
                     </div>
                  </TooltipContent>
               </Tooltip>
            ),
         },
         {
            accessorKey: "lastSuccessAt",
            header: "Último sucesso",
            cell: ({ row }) => (
               <span className="text-sm text-muted-foreground">
                  {formatTimestamp(row.original.lastSuccessAt)}
               </span>
            ),
         },
         {
            accessorKey: "lastFailureAt",
            header: "Última falha",
            cell: ({ row }) => (
               <span
                  className={cn(
                     "text-sm",
                     !row.original.lastFailureAt && "text-muted-foreground",
                  )}
               >
                  {formatTimestamp(row.original.lastFailureAt)}
               </span>
            ),
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
                     tooltip="Editar"
                     variant="outline"
                  >
                     <Edit className="size-4" />
                  </Button>
               </div>
            ),
         },
      ],
      [onEdit],
   );

   if (isLoading) {
      return (
         <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
               <Skeleton
                  className="h-12 w-full"
                  key={`webhook-skeleton-${index + 1}`}
               />
            ))}
         </div>
      );
   }

   return (
      <DataTable columns={columns} data={webhooks} getRowId={(row) => row.id} />
   );
}
