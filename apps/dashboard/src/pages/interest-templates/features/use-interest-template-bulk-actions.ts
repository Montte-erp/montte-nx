import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

interface UseInterestTemplateBulkActionsOptions {
   onSuccess?: () => void;
}

export function useInterestTemplateBulkActions(
   options?: UseInterestTemplateBulkActionsOptions,
) {
   const trpc = useTRPC();

   const deleteMutation = useMutation(
      trpc.interestTemplates.deleteMany.mutationOptions({
         onError: () => {
            toast.error("Falha ao excluir templates de juros");
         },
         onSuccess: () => {
            toast.success("Templates de juros excluídos com sucesso");
            options?.onSuccess?.();
         },
      }),
   );

   const deleteSelected = async (ids: string[]) => {
      await deleteMutation.mutateAsync({ ids });
   };

   return {
      deleteSelected,
      isLoading: deleteMutation.isPending,
   };
}
