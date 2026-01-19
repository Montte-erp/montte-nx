import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteCostCenter(options?: MutationOptions) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   return useMutation(
      trpc.costCenter.delete.mutationOptions({
         onError: (error) => {
            toast.error("Falha ao excluir centro de custo");
            options?.onError?.(error);
         },
         onSuccess: (data, variables, context) => {
            toast.success("Centro de custo excluído com sucesso");
            options?.onSuccess?.(data, variables, context);
         },
      }),
   );
}
