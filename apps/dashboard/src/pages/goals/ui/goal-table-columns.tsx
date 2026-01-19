import type { RouterOutput } from "@packages/api/client";
import { formatDecimalCurrency } from "@packages/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { formatDate } from "@packages/utils/date";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit, Eye, Info, MoreHorizontal, Tag, Trash2 } from "lucide-react";
import { GoalProgressBar } from "./goal-progress-bar";

export type Goal = RouterOutput["goals"]["getAll"][0];

export const STATUS_CONFIG = {
   active: { label: "Ativa", color: "bg-green-500" },
   completed: { label: "Concluida", color: "bg-blue-500" },
   paused: { label: "Pausada", color: "bg-yellow-500" },
   cancelled: { label: "Cancelada", color: "bg-gray-500" },
};

export const CALCULATION_TYPE_LABELS = {
   income: "Receitas",
   expense: "Despesas",
   net: "Saldo Liquido",
};

type GoalActionsProps = {
   onView: () => void;
   onEdit: () => void;
   onDelete: () => void;
   onDeleteWithTag: () => void;
};

function GoalActionsCell({
   onView,
   onEdit,
   onDelete,
   onDeleteWithTag,
}: GoalActionsProps) {
   return (
      <div className="flex justify-end gap-1">
         <Tooltip>
            <TooltipTrigger asChild>
               <Button
                  className="h-8 w-8"
                  onClick={(e) => {
                     e.stopPropagation();
                     onView();
                  }}
                  size="icon"
                  variant="outline"
               >
                  <Eye className="h-4 w-4" />
               </Button>
            </TooltipTrigger>
            <TooltipContent>Ver detalhes</TooltipContent>
         </Tooltip>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button
                  className="h-8 w-8"
                  onClick={(e) => e.stopPropagation()}
                  size="icon"
                  variant="ghost"
               >
                  <MoreHorizontal className="h-4 w-4" />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
               <DropdownMenuItem
                  onClick={(e) => {
                     e.stopPropagation();
                     onView();
                  }}
               >
                  <Eye className="mr-2 h-4 w-4" />
                  Ver detalhes
               </DropdownMenuItem>
               <DropdownMenuItem
                  onClick={(e) => {
                     e.stopPropagation();
                     onEdit();
                  }}
               >
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
               </DropdownMenuItem>
               <DropdownMenuSeparator />
               <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                     e.stopPropagation();
                     onDelete();
                  }}
               >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir (manter tag)
               </DropdownMenuItem>
               <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={(e) => {
                     e.stopPropagation();
                     onDeleteWithTag();
                  }}
               >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir com tag
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </div>
   );
}

type CreateGoalColumnsOptions = {
   onView: (goal: Goal) => void;
   onEdit: (goal: Goal) => void;
   onDelete: (goal: Goal) => void;
   onDeleteWithTag: (goal: Goal) => void;
};

export function createGoalColumns({
   onView,
   onEdit,
   onDelete,
   onDeleteWithTag,
}: CreateGoalColumnsOptions): ColumnDef<Goal>[] {
   return [
      {
         accessorKey: "name",
         cell: ({ row }) => {
            const goal = row.original;
            return (
               <Tooltip>
                  <TooltipTrigger asChild>
                     <span className="font-medium flex items-center gap-1 max-w-[180px]">
                        <span className="truncate">{goal.name}</span>
                        <Info className="size-3 text-muted-foreground shrink-0" />
                     </span>
                  </TooltipTrigger>
                  <TooltipContent>{goal.name}</TooltipContent>
               </Tooltip>
            );
         },
         enableSorting: false,
         header: "Nome",
         maxSize: 180,
      },
      {
         cell: ({ row }) => {
            const goal = row.original;
            return (
               <Announcement>
                  <AnnouncementTag
                     style={{
                        backgroundColor: `${goal.tag.color}20`,
                        color: goal.tag.color,
                     }}
                  >
                     <Tag className="size-3.5" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="max-w-[100px] truncate">
                     {goal.tag.name}
                  </AnnouncementTitle>
               </Announcement>
            );
         },
         enableSorting: false,
         header: "Tag",
         id: "tag",
      },
      {
         cell: ({ row }) => {
            const goal = row.original;
            const currentAmount = goal.currentAmount;
            const targetAmount = Number(goal.targetAmount);
            const percentage =
               targetAmount > 0
                  ? Math.min(
                       100,
                       Math.round((currentAmount / targetAmount) * 100),
                    )
                  : 0;

            return (
               <div className="flex items-center gap-2 min-w-[120px]">
                  <GoalProgressBar
                     className="flex-1"
                     currentAmount={currentAmount}
                     showPercentage={false}
                     size="sm"
                     targetAmount={targetAmount}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                     {percentage}%
                  </span>
               </div>
            );
         },
         enableSorting: false,
         header: "Progresso",
         id: "progress",
      },
      {
         accessorKey: "targetAmount",
         cell: ({ row }) => {
            const targetAmount = Number(row.getValue("targetAmount"));
            return (
               <span className="font-medium">
                  {formatDecimalCurrency(targetAmount)}
               </span>
            );
         },
         enableSorting: false,
         header: "Meta",
      },
      {
         cell: ({ row }) => {
            const goal = row.original;
            const statusConfig = STATUS_CONFIG[goal.status];
            return (
               <div className="flex items-center gap-1.5">
                  <div
                     className={`w-2 h-2 rounded-full ${statusConfig.color}`}
                  />
                  <span className="text-sm">{statusConfig.label}</span>
               </div>
            );
         },
         enableSorting: false,
         header: "Status",
         id: "status",
      },
      {
         accessorKey: "targetDate",
         cell: ({ row }) => {
            const goal = row.original;
            if (!goal.targetDate) {
               return <span className="text-muted-foreground">-</span>;
            }

            const daysRemaining = Math.ceil(
               (new Date(goal.targetDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
            );

            const dateFormatted = formatDate(
               new Date(goal.targetDate),
               "DD MMM YYYY",
            );

            const getDaysLabel = () => {
               if (goal.status !== "active") return null;
               if (daysRemaining > 0) return `(${daysRemaining}d)`;
               if (daysRemaining === 0) return "(hoje)";
               return `(-${Math.abs(daysRemaining)}d)`;
            };

            const daysLabel = getDaysLabel();

            return (
               <div className="flex items-center gap-1.5">
                  <span>{dateFormatted}</span>
                  {daysLabel && (
                     <span className="text-xs text-muted-foreground">
                        {daysLabel}
                     </span>
                  )}
               </div>
            );
         },
         enableSorting: false,
         header: "Data Limite",
      },
      {
         cell: ({ row }) => (
            <GoalActionsCell
               onDelete={() => onDelete(row.original)}
               onDeleteWithTag={() => onDeleteWithTag(row.original)}
               onEdit={() => onEdit(row.original)}
               onView={() => onView(row.original)}
            />
         ),
         header: "",
         id: "actions",
      },
   ];
}
