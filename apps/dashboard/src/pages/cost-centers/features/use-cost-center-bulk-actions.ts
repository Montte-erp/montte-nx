import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

interface UseCostCenterBulkActionsOptions {
   onSuccess?: () => void;
}

export function useCostCenterBulkActions(
   options?: UseCostCenterBulkActionsOptions,
) {
   const trpc = useTRPC();

   const deleteMutation = useMutation(
      trpc.costCenters.deleteMany.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const deleteSelected = async (ids: string[]) => {
      if (ids.length === 0) return;

      try {
         await deleteMutation.mutateAsync({ ids });
         toast.success(
            ids.length === 1
               ? "1 centro de custo excluído com sucesso"
               : `${ids.length} centros de custo excluídos com sucesso`,
         );
      } catch {
         toast.error("Falha ao excluir centros de custo");
      }
   };

   return {
      deleteSelected,
      isLoading: deleteMutation.isPending,
   };
}
