import type { BankAccount } from "@packages/database/repositories/bank-account-repository";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useToggleBankAccountStatus({
   bankAccount,
   onSuccess,
}: {
   bankAccount: BankAccount;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const updateStatusMutation = useMutation(
      trpc.bankAccounts.update.mutationOptions({
         onError: () => {
            toast.error("Erro ao atualizar status da conta bancária");
         },
         onSuccess: () => {
            toast.success(
               bankAccount.status === "active"
                  ? "Conta bancária desativada com sucesso"
                  : "Conta bancária ativada com sucesso",
            );
            onSuccess?.();
         },
      }),
   );

   const toggleStatus = () => {
      const isActive = bankAccount.status === "active";
      const newStatus = isActive ? "inactive" : "active";

      openAlertDialog({
         actionLabel: "Confirmar",
         cancelLabel: "Cancelar",
         description: isActive
            ? "Ao desativar esta conta, ela não aparecerá mais nos relatórios e filtros. Você poderá reativá-la a qualquer momento."
            : "Ao ativar esta conta, ela voltará a aparecer nos relatórios e filtros.",
         onAction: async () => {
            await updateStatusMutation.mutateAsync({
               data: { status: newStatus },
               id: bankAccount.id,
            });
         },
         title: isActive ? "Desativar conta bancária" : "Ativar conta bancária",
         variant: "default",
      });
   };

   return {
      isUpdating: updateStatusMutation.isPending,
      toggleStatus,
   };
}
