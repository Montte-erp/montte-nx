import { formatDecimalCurrency } from "@packages/money";
import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardAction,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import type { Row } from "@tanstack/react-table";
import { Edit, Eye, MoreHorizontal, Tag, Trash2 } from "lucide-react";
import { GoalProgressBar } from "./goal-progress-bar";
import { type Goal, STATUS_CONFIG } from "./goal-table-columns";

type GoalMobileCardProps = {
   row: Row<Goal>;
   isSelected?: boolean;
   toggleSelected?: () => void;
   enableRowSelection?: boolean;
   onView: (goal: Goal) => void;
   onEdit: (goal: Goal) => void;
   onDelete: (goal: Goal) => void;
   onDeleteWithTag: (goal: Goal) => void;
};

export function GoalMobileCard({
   row,
   isSelected,
   toggleSelected,
   enableRowSelection,
   onView,
   onEdit,
   onDelete,
   onDeleteWithTag,
}: GoalMobileCardProps) {
   const goal = row.original;
   const statusConfig = STATUS_CONFIG[goal.status];
   const currentAmount = goal.currentAmount;
   const targetAmount = Number(goal.targetAmount);

   return (
      <Card className="py-4">
         <CardHeader className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
               <CardTitle className="flex items-center gap-1.5 text-sm">
                  <span className="truncate">{goal.name}</span>
                  <div
                     className={`w-2 h-2 rounded-full shrink-0 ${statusConfig.color}`}
                  />
               </CardTitle>
               <CardDescription>
                  {formatDecimalCurrency(currentAmount)} /{" "}
                  {formatDecimalCurrency(targetAmount)}
               </CardDescription>
            </div>
            <CardAction className="flex items-center gap-2">
               {enableRowSelection && (
                  <Checkbox
                     checked={isSelected}
                     onCheckedChange={() => toggleSelected?.()}
                  />
               )}
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button className="h-8 w-8" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     <DropdownMenuItem onClick={() => onView(goal)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalhes
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => onEdit(goal)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDelete(goal)}
                     >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir (manter tag)
                     </DropdownMenuItem>
                     <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteWithTag(goal)}
                     >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir com tag
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </CardAction>
         </CardHeader>
         <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
            <GoalProgressBar
               currentAmount={currentAmount}
               size="sm"
               targetAmount={targetAmount}
            />
         </CardContent>
      </Card>
   );
}
