import type { RouterOutput } from "@packages/api/client";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   CheckCircle,
   CircleDot,
   Edit,
   PauseCircle,
   PlayCircle,
   Trash2,
   XCircle,
} from "lucide-react";
import { useSheet } from "@/hooks/use-sheet";
import { ManageGoalForm } from "@/pages/goals/features/manage-goal-form";
import { useDeleteGoal } from "@/pages/goals/features/use-delete-goal";
import { useUpdateGoalStatus } from "./use-update-goal-status";

type Goal = RouterOutput["goals"]["getById"];

type GoalActionButtonsProps = {
   goal: Goal;
   onDeleteSuccess?: () => void;
};

const STATUS_LABELS = {
   active: "Ativa",
   completed: "Concluida",
   paused: "Pausada",
   cancelled: "Cancelada",
};

export function GoalActionButtons({
   goal,
   onDeleteSuccess,
}: GoalActionButtonsProps) {
   const { openSheet } = useSheet();
   const { deleteGoal, deleteGoalWithTag } = useDeleteGoal();
   const { updateStatus, completeGoal, isUpdating } = useUpdateGoalStatus({
      goalId: goal.id,
   });

   const handleDelete = () => {
      deleteGoal(goal.id, goal.name, goal.tag.name);
      onDeleteSuccess?.();
   };

   const handleDeleteWithTag = () => {
      deleteGoalWithTag(goal.id, goal.name, goal.tag.name);
      onDeleteSuccess?.();
   };

   const canPause = goal.status === "active";
   const canResume = goal.status === "paused";
   const canComplete = goal.status === "active";
   const canCancel = goal.status === "active" || goal.status === "paused";

   return (
      <div className="flex flex-wrap items-center gap-2">
         <Button
            onClick={() =>
               openSheet({
                  children: <ManageGoalForm goal={goal} />,
               })
            }
            size="sm"
            variant="outline"
         >
            <Edit className="size-4" />
            Editar
         </Button>

         <Button
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            size="sm"
            variant="outline"
         >
            <Trash2 className="size-4" />
            Excluir
         </Button>

         <Button
            className="text-destructive hover:text-destructive"
            onClick={handleDeleteWithTag}
            size="sm"
            variant="outline"
         >
            <Trash2 className="size-4" />
            Excluir com tag
         </Button>

         <div className="h-4 w-px bg-border" />

         <Badge
            className="gap-1.5"
            variant={goal.status === "active" ? "default" : "secondary"}
         >
            <CircleDot className="size-3" />
            {STATUS_LABELS[goal.status]}
         </Badge>

         {canPause && (
            <Button
               disabled={isUpdating}
               onClick={() => updateStatus("paused")}
               size="sm"
               variant="outline"
            >
               <PauseCircle className="size-4" />
               Pausar
            </Button>
         )}

         {canResume && (
            <Button
               disabled={isUpdating}
               onClick={() => updateStatus("active")}
               size="sm"
               variant="outline"
            >
               <PlayCircle className="size-4" />
               Retomar
            </Button>
         )}

         {canComplete && (
            <Button
               disabled={isUpdating}
               onClick={completeGoal}
               size="sm"
               variant="outline"
            >
               <CheckCircle className="size-4" />
               Concluir
            </Button>
         )}

         {canCancel && (
            <Button
               className="text-destructive hover:text-destructive"
               disabled={isUpdating}
               onClick={() => updateStatus("cancelled")}
               size="sm"
               variant="outline"
            >
               <XCircle className="size-4" />
               Cancelar
            </Button>
         )}
      </div>
   );
}
