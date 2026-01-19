import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useRemoveWidget({
   onSuccess,
   onError,
}: {
   onSuccess?: () => void;
   onError?: () => void;
}) {
   const trpc = useTRPC();

   const removeWidgetMutation = useMutation(
      trpc.dashboards.removeWidget.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao remover widget");
            onError?.();
         },
         onSuccess: () => {
            toast.success("Widget removido com sucesso");
            onSuccess?.();
         },
      }),
   );

   return removeWidgetMutation;
}
