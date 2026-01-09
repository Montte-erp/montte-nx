import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

interface UseBankAccountBulkActionsOptions {
   onSuccess?: () => void;
}

export function useBankAccountBulkActions(
   options?: UseBankAccountBulkActionsOptions,
) {
   const trpc = useTRPC();

   const { data: allBankAccounts = [] } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   const updateStatusMutation = useMutation(
      trpc.bankAccounts.updateStatus.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const deleteMutation = useMutation(
      trpc.bankAccounts.deleteMany.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const markAsActive = async (ids: string[]) => {
      if (ids.length === 0) return;

      try {
         await updateStatusMutation.mutateAsync({
            ids,
            status: "active",
         });
         toast.success(
            `${ids.length} conta(s) ativada(s) com sucesso`,
         );
      } catch {
         toast.error("Erro ao ativar contas");
      }
   };

   const markAsInactive = async (ids: string[]) => {
      if (ids.length === 0) return;

      try {
         await updateStatusMutation.mutateAsync({
            ids,
            status: "inactive",
         });
         toast.success(
            `${ids.length} conta(s) desativada(s) com sucesso`,
         );
      } catch {
         toast.error("Erro ao desativar contas");
      }
   };

   const canDelete = allBankAccounts.length >= 2;

   const deleteSelected = async (ids: string[]) => {
      if (ids.length === 0) return;

      // Check if trying to delete all bank accounts
      if (allBankAccounts.length <= ids.length) {
         toast.error(
            "Cannot delete all bank accounts. You must have at least one bank account.",
         );
         return;
      }

      try {
         await deleteMutation.mutateAsync({ ids });
         toast.success(
            `${ids.length} conta(s) excluída(s) com sucesso`,
         );
      } catch (error) {
         toast.error(
            error instanceof Error
               ? error.message
               : "Erro ao excluir contas",
         );
      }
   };

   return {
      allBankAccounts,
      canDelete,
      deleteSelected,
      isLoading: updateStatusMutation.isPending || deleteMutation.isPending,
      markAsActive,
      markAsInactive,
   };
}
