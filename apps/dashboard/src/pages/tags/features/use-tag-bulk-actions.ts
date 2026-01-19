import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

interface UseTagBulkActionsOptions {
   onSuccess?: () => void;
}

export function useTagBulkActions(options?: UseTagBulkActionsOptions) {
   const trpc = useTRPC();

   const deleteMutation = useMutation(
      trpc.tags.deleteMany.mutationOptions({
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
               ? "1 tag excluída com sucesso"
               : `${ids.length} tags excluídas com sucesso`,
         );
      } catch {
         toast.error("Falha ao excluir tags");
      }
   };

   return {
      deleteSelected,
      isLoading: deleteMutation.isPending,
   };
}
