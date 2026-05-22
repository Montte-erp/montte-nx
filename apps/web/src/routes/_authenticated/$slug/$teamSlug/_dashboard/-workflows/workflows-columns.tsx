import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@/components/blocks/announcement";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import {
   CalendarClock,
   CircleCheckBig,
   CircleDashed,
   Clock,
   Eye,
   Pause,
   Play,
   Trash2,
} from "lucide-react";
import type {
   WorkflowRow,
   WorkflowStatus,
} from "@/integrations/tanstack-db/workflows";
import { getWorkflowScheduleNode } from "./workflow-model";

type BuildWorkflowsColumnsOptions = {
   onOpen?: (workflow: WorkflowRow) => void;
   onPause?: (workflow: WorkflowRow) => void;
   onActivate?: (workflow: WorkflowRow) => void;
   isActivationBlocked?: (workflow: WorkflowRow) => boolean;
   onRemove?: (workflow: WorkflowRow) => void;
   onRename?: (workflow: WorkflowRow, name: string) => Promise<unknown>;
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
   onOpen,
   onPause,
   onActivate,
   isActivationBlocked,
   onRemove,
   onRename,
}: BuildWorkflowsColumnsOptions): ColumnDef<WorkflowRow>[] {
   return [
      {
         id: "name",
         accessorKey: "name",
         header: "Nome",
         meta: {
            label: "Nome",
            exportable: true,
            cellComponent: "text",
            isEditable: Boolean(onRename),
            editMode: "inline",
            required: true,
         },
         cell: ({ row }) => {
            const workflow = row.original;
            if (onRename) {
               return (
                  <InlineEditText
                     ariaLabel="Nome do workflow"
                     onSave={(value) => onRename(workflow, value)}
                     placeholder="Nome do workflow"
                     value={workflow.name}
                  />
               );
            }
            return <span className="font-medium">{workflow.name}</span>;
         },
      },
      {
         id: "schedule",
         header: "Agenda",
         accessorFn: (workflow) =>
            getWorkflowScheduleNode(workflow.graph)?.data.humanLabel,
         meta: { label: "Agenda", exportable: true },
         cell: ({ row }) => {
            const scheduleNode = getWorkflowScheduleNode(row.original.graph);
            return (
               <span className="text-muted-foreground">
                  {scheduleNode?.data.humanLabel ?? "Sem agenda"}
               </span>
            );
         },
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
               <Announcement className="cursor-default shadow-none hover:shadow-none">
                  <AnnouncementTag className="flex items-center text-muted-foreground">
                     <Clock className="size-3" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-muted-foreground">
                     {dayjs(row.original.latestRun.scheduledFor).format(
                        "DD/MM/YYYY HH:mm",
                     )}
                  </AnnouncementTitle>
               </Announcement>
            ) : (
               <Announcement className="cursor-default shadow-none hover:shadow-none">
                  <AnnouncementTitle className="text-muted-foreground">
                     Sem execuções
                  </AnnouncementTitle>
               </Announcement>
            ),
      },
      {
         id: "nextRunAt",
         accessorKey: "nextRunAt",
         header: "Próxima execução",
         meta: { label: "Próxima execução" },
         cell: ({ row }) =>
            row.original.nextRunAt ? (
               <Announcement className="cursor-default shadow-none hover:shadow-none">
                  <AnnouncementTag className="flex items-center text-muted-foreground">
                     <CalendarClock className="size-3" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-muted-foreground">
                     {dayjs(row.original.nextRunAt).format("DD/MM/YYYY HH:mm")}
                  </AnnouncementTitle>
               </Announcement>
            ) : (
               <Announcement className="cursor-default shadow-none hover:shadow-none">
                  <AnnouncementTitle className="text-muted-foreground">
                     Pausado
                  </AnnouncementTitle>
               </Announcement>
            ),
      },
      {
         id: "__actions",
         size: 144,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right", importIgnore: true },
         cell: ({ row }) => {
            const activationBlocked = isActivationBlocked?.(row.original);

            return (
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
                        disabled={activationBlocked}
                        onClick={(event) => {
                           event.stopPropagation();
                           onActivate?.(row.original);
                        }}
                        size="icon-sm"
                        tooltip={
                           activationBlocked
                              ? "Configure antes de ativar"
                              : "Ativar"
                        }
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
            );
         },
      },
   ];
}
