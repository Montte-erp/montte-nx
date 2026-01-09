import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

interface UseCategoryBulkActionsOptions {
   onSuccess?: () => void;
}

export function useCategoryBulkActions(
   options?: UseCategoryBulkActionsOptions,
) {
   const trpc = useTRPC();

   const deleteMutation = useMutation(
      trpc.categories.deleteMany.mutationOptions({
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
            `${ids.length} ${ids.length === 1 ? "categoria excluída" : "categorias excluídas"} com sucesso`,
         );
      } catch {
         toast.error("Falha ao excluir categorias");
      }
   };

   return {
      deleteSelected,
      isLoading: deleteMutation.isPending,
   };
}
