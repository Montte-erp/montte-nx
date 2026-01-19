import type { RouterOutput } from "@packages/api/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

type Automation = RouterOutput["automations"]["getAllPaginated"]["rules"][0];

export function useAutomationActions(automation: Automation) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();

   const deleteMutation = useMutation(
      trpc.automations.delete.mutationOptions({
         onError: () => {
            toast.error("Erro ao excluir automação");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
            toast.success("Automação excluída com sucesso");
         },
      }),
   );

   const duplicateMutation = useMutation(
      trpc.automations.duplicate.mutationOptions({
         onError: () => {
            toast.error("Erro ao duplicar automação");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
            toast.success("Automação duplicada com sucesso");
         },
      }),
   );

   const toggleMutation = useMutation(
      trpc.automations.toggle.mutationOptions({
         onError: () => {
            toast.error("Erro ao alterar status da automação");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
         },
      }),
   );

   const testRunMutation = useMutation(
      trpc.automations.triggerManually.mutationOptions({
         onError: (error) => {
            toast.error(`Erro ao testar automação: ${error.message}`);
         },
         onSuccess: (data) => {
            toast.success(`Automação executada! Job ID: ${data.jobId}`);
         },
      }),
   );

   const handleDelete = () => {
      openAlertDialog({
         actionLabel: "Excluir",
         description:
            "Tem certeza que deseja excluir esta automação? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: automation.id });
         },
         title: "Excluir automação",
         variant: "destructive",
      });
   };

   const handleDuplicate = () => {
      duplicateMutation.mutate({
         id: automation.id,
         newName: `${automation.name} (cópia)`,
      });
   };

   const handleToggle = (enabled: boolean) => {
      toggleMutation.mutate({
         id: automation.id,
         enabled,
      });
   };

   const handleTestRun = (dryRun = false) => {
      if (!automation.enabled) {
         toast.error("Automação desativada. Ative-a primeiro para testar.");
         return;
      }
      testRunMutation.mutate({
         dryRun,
         ruleId: automation.id,
      });
   };

   const handleTrigger = () => {
      if (!automation.enabled) {
         toast.error("Não é possível executar uma automação inativa");
         return;
      }
      testRunMutation.mutate({ ruleId: automation.id });
   };

   return {
      handleDelete,
      handleDuplicate,
      handleToggle,
      handleTestRun,
      handleTrigger,
      isDeleting: deleteMutation.isPending,
      isDuplicating: duplicateMutation.isPending,
      isToggling: toggleMutation.isPending,
      isTesting: testRunMutation.isPending,
   };
}
