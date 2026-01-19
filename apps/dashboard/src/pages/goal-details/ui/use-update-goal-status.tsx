"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

type GoalStatus = "active" | "paused" | "cancelled";

type UseUpdateGoalStatusOptions = {
   goalId: string;
};

export function useUpdateGoalStatus({ goalId }: UseUpdateGoalStatusOptions) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const updateMutation = useMutation(
      trpc.goals.update.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [["goals"]] });
            toast.success("Status da meta atualizado");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar status");
         },
      }),
   );

   const completeMutation = useMutation(
      trpc.goals.complete.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [["goals"]] });
            toast.success("Meta concluida com sucesso!");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao concluir meta");
         },
      }),
   );

   const updateStatus = (status: GoalStatus) => {
      updateMutation.mutate({ id: goalId, status });
   };

   const completeGoal = () => {
      completeMutation.mutate({ id: goalId });
   };

   return {
      updateStatus,
      completeGoal,
      isUpdating: updateMutation.isPending || completeMutation.isPending,
   };
}
