import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useUpdateWidget({
   dashboardId,
   onSuccess,
   onError,
}: {
   dashboardId: string;
   onSuccess?: () => void;
   onError?: () => void;
}) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const updateWidgetMutation = useMutation(
      trpc.dashboards.updateWidget.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao atualizar widget");
            onError?.();
         },
         onSuccess: () => {
            // Invalidate the dashboard query to refresh widget data
            queryClient.invalidateQueries({
               queryKey: trpc.dashboards.getById.queryKey({ id: dashboardId }),
            });
            toast.success("Widget atualizado com sucesso");
            onSuccess?.();
         },
      }),
   );

   return updateWidgetMutation;
}
