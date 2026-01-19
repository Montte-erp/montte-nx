import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useAddWidget({
   onSuccess,
   onError,
}: {
   onSuccess?: () => void;
   onError?: () => void;
}) {
   const trpc = useTRPC();

   const addWidgetMutation = useMutation(
      trpc.dashboards.addWidget.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao adicionar widget");
            onError?.();
         },
         onSuccess: () => {
            toast.success("Widget adicionado com sucesso");
            onSuccess?.();
         },
      }),
   );

   return addWidgetMutation;
}
