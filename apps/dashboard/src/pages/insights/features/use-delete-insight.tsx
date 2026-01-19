import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useDeleteInsight({
   onSuccess,
   onError,
}: {
   onSuccess?: () => void;
   onError?: () => void;
} = {}) {
   const trpc = useTRPC();

   const deleteInsightMutation = useMutation(
      trpc.dashboards.deleteSavedInsight.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao excluir insight");
            onError?.();
         },
         onSuccess: () => {
            toast.success("Insight excluído com sucesso");
            onSuccess?.();
         },
      }),
   );

   return deleteInsightMutation;
}
