import type { BankAccount } from "@packages/database/repositories/bank-account-repository";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteBankAccount({
   bankAccount,
   onSuccess,
}: {
   bankAccount: BankAccount;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const { data: allBankAccounts = [] } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   const deleteBankAccountMutation = useMutation(
      trpc.bankAccounts.delete.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Failed to delete bank account");
         },
         onSuccess: () => {
            toast.success("Bank account deleted successfully");
            onSuccess?.();
         },
      }),
   );

   const canDelete = allBankAccounts.length >= 2;

   const deleteBankAccount = () => {
      if (allBankAccounts.length < 2) {
         toast.error(
            "Você deve ter pelo menos uma conta bancária.",
         );
         return;
      }

      openAlertDialog({
         actionLabel: "Excluir conta",
         cancelLabel: "Cancelar",
         description: "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteBankAccountMutation.mutateAsync({ id: bankAccount.id });
         },
         title: "Confirmar Exclusão",
         variant: "destructive",
      });
   };

   return {
      canDelete,
      deleteBankAccount,
      isDeleting: deleteBankAccountMutation.isPending,
   };
}
