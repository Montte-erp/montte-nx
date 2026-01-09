import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

interface UseCounterpartyBulkActionsOptions {
   onSuccess?: () => void;
}

export function useCounterpartyBulkActions(
   options?: UseCounterpartyBulkActionsOptions,
) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const invalidateQueries = () => {
      queryClient.invalidateQueries({
         queryKey: trpc.counterparties.getAllPaginated.queryKey(),
      });
      queryClient.invalidateQueries({
         queryKey: trpc.counterparties.getStats.queryKey(),
      });
   };

   const deleteMutation = useMutation(
      trpc.counterparties.deleteMany.mutationOptions({
         onError: () => {
            toast.error("Erro ao excluir cadastros selecionados");
         },
         onSuccess: () => {
            toast.success("Cadastros excluídos com sucesso");
            invalidateQueries();
            options?.onSuccess?.();
         },
      }),
   );

   const toggleActiveMutation = useMutation(
      trpc.counterparties.bulkToggleActive.mutationOptions({
         onError: () => {
            toast.error("Erro ao atualizar status");
         },
         onSuccess: (_, variables) => {
            toast.success(
               variables.isActive
                  ? "Parceiros ativados com sucesso"
                  : "Parceiros inativados com sucesso",
            );
            invalidateQueries();
            options?.onSuccess?.();
         },
      }),
   );

   const updateTypeMutation = useMutation(
      trpc.counterparties.bulkUpdateType.mutationOptions({
         onError: () => {
            toast.error("Erro ao atualizar tipo");
         },
         onSuccess: () => {
            toast.success("Tipo atualizado com sucesso");
            invalidateQueries();
            options?.onSuccess?.();
         },
      }),
   );

   const deleteSelected = async (ids: string[]) => {
      await deleteMutation.mutateAsync({ ids });
   };

   const toggleActiveSelected = async (ids: string[], isActive: boolean) => {
      await toggleActiveMutation.mutateAsync({ ids, isActive });
   };

   const updateTypeSelected = async (
      ids: string[],
      type: "client" | "supplier" | "both",
   ) => {
      await updateTypeMutation.mutateAsync({ ids, type });
   };

   return {
      deleteSelected,
      toggleActiveSelected,
      updateTypeSelected,
      isLoading:
         deleteMutation.isPending ||
         toggleActiveMutation.isPending ||
         updateTypeMutation.isPending,
   };
}
