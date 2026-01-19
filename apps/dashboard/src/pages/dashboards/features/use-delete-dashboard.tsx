import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useDeleteDashboard({
   onSuccess,
   onError,
}: {
   onSuccess?: () => void;
   onError?: () => void;
}) {
   const trpc = useTRPC();

   const deleteDashboardMutation = useMutation(
      trpc.dashboards.delete.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao excluir dashboard");
            onError?.();
         },
         onSuccess: () => {
            toast.success("Dashboard excluído com sucesso");
            onSuccess?.();
         },
      }),
   );

   return deleteDashboardMutation;
}
