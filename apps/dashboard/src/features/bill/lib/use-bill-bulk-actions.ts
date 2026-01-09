import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

interface UseBillBulkActionsOptions {
   onSuccess?: () => void;
}

export type BillPaymentItem = {
   id: string;
   completionDate: string;
};

export function useBillBulkActions(options?: UseBillBulkActionsOptions) {
   const trpc = useTRPC();

   const completeMutation = useMutation(
      trpc.bills.completeMany.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const completeManyWithDatesMutation = useMutation(
      trpc.bills.completeManyWithDates.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const deleteMutation = useMutation(
      trpc.bills.deleteMany.mutationOptions({
         onSuccess: () => {
            options?.onSuccess?.();
         },
      }),
   );

   const completeSelected = async (ids: string[]) => {
      if (ids.length === 0) return;

      try {
         const completionDate = new Date().toISOString();
         await completeMutation.mutateAsync({ completionDate, ids });
         toast.success(`${ids.length} conta(s) marcada(s) como paga(s)`);
      } catch {
         toast.error("Erro ao marcar contas como pagas");
      }
   };

   const completeManyWithDates = async (items: BillPaymentItem[]) => {
      if (items.length === 0) return;

      try {
         await completeManyWithDatesMutation.mutateAsync({
            items: items.map((item) => ({
               billId: item.id,
               completionDate: item.completionDate,
            })),
         });
         toast.success(`${items.length} conta(s) marcada(s) como paga(s)`);
      } catch {
         toast.error("Erro ao marcar contas como pagas");
      }
   };

   const deleteSelected = async (ids: string[]) => {
      if (ids.length === 0) return;

      try {
         await deleteMutation.mutateAsync({ ids });
         toast.success(`${ids.length} conta(s) excluída(s) com sucesso`);
      } catch {
         toast.error("Erro ao excluir contas");
      }
   };

   return {
      completeSelected,
      completeManyWithDates,
      deleteSelected,
      isLoading:
         completeMutation.isPending ||
         completeManyWithDatesMutation.isPending ||
         deleteMutation.isPending,
   };
}
