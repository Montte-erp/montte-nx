import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import {
   CircleCheckBig,
   CircleDashed,
   Eye,
   Pause,
   Play,
   Trash2,
} from "lucide-react";
import type { Outputs } from "@/integrations/orpc/client";

export type WorkflowRow = Outputs["workflows"]["list"][number];
type WorkflowStatus = WorkflowRow["status"];

type BuildWorkflowsColumnsOptions = {
   templateLabels: Map<string, string>;
   onOpen?: (workflow: WorkflowRow) => void;
   onPause?: (workflow: WorkflowRow) => void;
   onActivate?: (workflow: WorkflowRow) => void;
   onRemove?: (workflow: WorkflowRow) => void;
};

function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
   if (status === "active") {
      return (
         <Badge variant="success">
            <CircleCheckBig className="size-3" />
            Ativo
         </Badge>
      );
   }

   return (
      <Badge variant="outline">
         <CircleDashed className="size-3" />
         Pausado
      </Badge>
   );
}

export function buildWorkflowsColumns({
   templateLabels,
   onOpen,
   onPause,
   onActivate,
   onRemove,
}: BuildWorkflowsColumnsOptions): ColumnDef<WorkflowRow>[] {
   return [
      {
         id: "name",
         accessorKey: "name",
         header: "Nome",
         meta: { label: "Nome", exportable: true },
         cell: ({ row }) => (
            <div className="flex flex-col gap-1">
               <span className="font-medium">{row.original.name}</span>
               <span className="text-muted-foreground text-xs">
                  {row.original.graph.nodes[0]?.data.humanLabel}
               </span>
            </div>
         ),
      },
      {
         id: "templateId",
         accessorKey: "templateId",
         header: "Template",
         meta: { label: "Template", exportable: true },
         cell: ({ row }) => (
            <span className="text-muted-foreground">
               {templateLabels.get(row.original.templateId) ??
                  row.original.templateId}
            </span>
         ),
      },
      {
         id: "status",
         accessorKey: "status",
         header: "Status",
         meta: { label: "Status", filterVariant: "select" },
         cell: ({ row }) => (
            <WorkflowStatusBadge status={row.original.status} />
         ),
      },
      {
         id: "latestRun",
         header: "Última execução",
         enableSorting: false,
         meta: { label: "Última execução" },
         cell: ({ row }) =>
            row.original.latestRun ? (
               <span className="text-muted-foreground">
                  {dayjs(row.original.latestRun.scheduledFor).format(
                     "DD/MM/YYYY HH:mm",
                  )}
               </span>
            ) : (
               <span className="text-muted-foreground">Sem execuções</span>
            ),
      },
      {
         id: "nextRunAt",
         accessorKey: "nextRunAt",
         header: "Próxima execução",
         meta: { label: "Próxima execução" },
         cell: ({ row }) =>
            row.original.nextRunAt ? (
               <span className="text-muted-foreground">
                  {dayjs(row.original.nextRunAt).format("DD/MM/YYYY HH:mm")}
               </span>
            ) : (
               <span className="text-muted-foreground">Pausado</span>
            ),
      },
      {
         id: "__actions",
         size: 144,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right", importIgnore: true },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  onClick={(event) => {
                     event.stopPropagation();
                     onOpen?.(row.original);
                  }}
                  size="icon-sm"
                  tooltip="Abrir"
                  variant="outline"
               >
                  <Eye className="size-4" />
                  <span className="sr-only">Abrir</span>
               </Button>
               {row.original.status === "active" ? (
                  <Button
                     onClick={(event) => {
                        event.stopPropagation();
                        onPause?.(row.original);
                     }}
                     size="icon-sm"
                     tooltip="Pausar"
                     variant="outline"
                  >
                     <Pause className="size-4" />
                     <span className="sr-only">Pausar</span>
                  </Button>
               ) : (
                  <Button
                     onClick={(event) => {
                        event.stopPropagation();
                        onActivate?.(row.original);
                     }}
                     size="icon-sm"
                     tooltip="Ativar"
                     variant="outline"
                  >
                     <Play className="size-4" />
                     <span className="sr-only">Ativar</span>
                  </Button>
               )}
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={(event) => {
                     event.stopPropagation();
                     onRemove?.(row.original);
                  }}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir</span>
               </Button>
            </div>
         ),
      },
   ];
}
