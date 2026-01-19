import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useUpdateWidget({
   onSuccess,
   onError,
}: {
   onSuccess?: () => void;
   onError?: () => void;
}) {
   const trpc = useTRPC();

   const updateWidgetMutation = useMutation(
      trpc.dashboards.updateWidget.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao atualizar widget");
            onError?.();
         },
         onSuccess: () => {
            toast.success("Widget atualizado com sucesso");
            onSuccess?.();
         },
      }),
   );

   return updateWidgetMutation;
}
