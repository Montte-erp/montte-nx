import type { Bill } from "@packages/database/repositories/bill-repository";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteBillDialog({
   bill,
   onSuccess,
}: {
   bill: Bill;
   onSuccess?: () => void;
}) {
   const { openAlertDialog, closeAlertDialog } = useAlertDialog();
   const trpc = useTRPC();

   const deleteBillMutation = useMutation(
      trpc.bills.delete.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir conta");
         },
         onSuccess: () => {
            toast.success("Conta excluída com sucesso");
            closeAlertDialog();
            onSuccess?.();
         },
      }),
   );

   const handleDelete = () => {
      openAlertDialog({
         description: `Tem certeza que deseja excluir "${bill.description}"? Esta ação não pode ser desfeita.`,

         onAction: async () => {
            await deleteBillMutation.mutateAsync({
               id: bill.id,
            });
         },
         title: "Excluir Conta",
      });
   };
   return {
      handleDeleteBill: handleDelete,
   };
}
