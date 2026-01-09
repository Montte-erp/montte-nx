import type { Counterparty } from "@packages/database/repositories/counterparty-repository";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteCounterparty({
   counterparty,
   onSuccess,
}: {
   counterparty: Counterparty;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const deleteCounterpartyMutation = useMutation(
      trpc.counterparties.delete.mutationOptions({
         onError: () => {
            toast.error("Erro ao excluir cadastro");
         },
         onSuccess: () => {
            toast.success("Cadastro excluído com sucesso");
            onSuccess?.();
         },
      }),
   );

   const deleteCounterparty = () => {
      openAlertDialog({
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         description: "Tem certeza que deseja excluir este cadastro? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteCounterpartyMutation.mutateAsync({
               id: counterparty.id,
            });
         },
         title: "Excluir cadastro",
         variant: "destructive",
      });
   };

   return {
      deleteCounterparty,
      isDeleting: deleteCounterpartyMutation.isPending,
   };
}
