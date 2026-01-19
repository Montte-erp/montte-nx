import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useUpdateDashboard({
   onSuccess,
   onError,
}: {
   onSuccess?: () => void;
   onError?: () => void;
}) {
   const trpc = useTRPC();

   const updateDashboardMutation = useMutation(
      trpc.dashboards.update.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao atualizar dashboard");
            onError?.();
         },
         onSuccess: () => {
            toast.success("Dashboard atualizado com sucesso");
            onSuccess?.();
         },
      }),
   );

   return updateDashboardMutation;
}
