import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

interface UseBudgetBulkActionsOptions {
   onSuccess?: () => void;
}

export function useBudgetBulkActions(options?: UseBudgetBulkActionsOptions) {
   const trpc = useTRPC();

   const activateMutation = useMutation(
      trpc.budgets.bulkActivate.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const deactivateMutation = useMutation(
      trpc.budgets.bulkDeactivate.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const deleteMutation = useMutation(
      trpc.budgets.bulkDelete.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const markAsActive = async (ids: string[]) => {
      if (ids.length === 0) return;

      try {
         await activateMutation.mutateAsync({ ids });
         toast.success(
            ids.length === 1
               ? "1 orçamento ativado"
               : `${ids.length} orçamentos ativados`,
         );
      } catch {
         toast.error("Erro ao ativar orçamentos");
      }
   };

   const markAsInactive = async (ids: string[]) => {
      if (ids.length === 0) return;

      try {
         await deactivateMutation.mutateAsync({ ids });
         toast.success(
            ids.length === 1
               ? "1 orçamento desativado"
               : `${ids.length} orçamentos desativados`,
         );
      } catch {
         toast.error("Erro ao desativar orçamentos");
      }
   };

   const deleteSelected = async (ids: string[]) => {
      if (ids.length === 0) return;

      try {
         await deleteMutation.mutateAsync({ ids });
         toast.success(
            ids.length === 1
               ? "1 orçamento excluído"
               : `${ids.length} orçamentos excluídos`,
         );
      } catch {
         toast.error("Erro ao excluir orçamentos");
      }
   };

   return {
      deleteSelected,
      isLoading:
         activateMutation.isPending ||
         deactivateMutation.isPending ||
         deleteMutation.isPending,
      markAsActive,
      markAsInactive,
   };
}
