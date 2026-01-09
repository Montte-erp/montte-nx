import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

type Transaction = {
   id: string;
   description: string;
};

export function useDeleteTransaction({
   transaction,
   onSuccess,
}: {
   transaction: Transaction;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const deleteTransactionMutation = useMutation(
      trpc.transactions.delete.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao excluir transacao");
         },
         onSuccess: () => {
            toast.success("Transacao excluida com sucesso");
            onSuccess?.();
         },
      }),
   );

   const deleteTransaction = () => {
      openAlertDialog({
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         description:
            "Esta acao nao pode ser desfeita. Tem certeza que deseja continuar?",
         onAction: async () => {
            await deleteTransactionMutation.mutateAsync({ id: transaction.id });
         },
         title: "Confirmar exclusao",
         variant: "destructive",
      });
   };

   return {
      deleteTransaction,
      isDeleting: deleteTransactionMutation.isPending,
   };
}
