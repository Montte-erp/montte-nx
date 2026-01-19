"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteGoal() {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();

   const deleteMutation = useMutation(
      trpc.goals.delete.mutationOptions({
         onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: [["goals"]] });
            if (result.tagDeleted) {
               queryClient.invalidateQueries({ queryKey: [["tags"]] });
               toast.success("Meta e tag excluidas com sucesso");
            } else {
               toast.success("Meta excluida com sucesso");
            }
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir meta");
         },
      }),
   );

   const deleteGoalOnly = (goalId: string) => {
      deleteMutation.mutate({ id: goalId, deleteTag: false });
   };

   const deleteGoalAndTag = (goalId: string) => {
      deleteMutation.mutate({ id: goalId, deleteTag: true });
   };

   const deleteGoal = (goalId: string, goalName: string, tagName: string) => {
      openAlertDialog({
         title: "Excluir Meta",
         description: `Tem certeza que deseja excluir a meta "${goalName}"? A tag "${tagName}" sera mantida e podera ser usada em outras transacoes.`,
         actionLabel: "Excluir meta",
         variant: "destructive",
         onAction: async () => {
            deleteGoalOnly(goalId);
         },
      });
   };

   const deleteGoalWithTag = (
      goalId: string,
      goalName: string,
      tagName: string,
   ) => {
      openAlertDialog({
         title: "Excluir Meta e Tag",
         description: `Tem certeza que deseja excluir a meta "${goalName}" E a tag "${tagName}"? Ambos serao removidos permanentemente.`,
         actionLabel: "Excluir ambos",
         variant: "destructive",
         onAction: async () => {
            deleteGoalAndTag(goalId);
         },
      });
   };

   return {
      deleteGoal,
      deleteGoalWithTag,
      isDeleting: deleteMutation.isPending,
   };
}
