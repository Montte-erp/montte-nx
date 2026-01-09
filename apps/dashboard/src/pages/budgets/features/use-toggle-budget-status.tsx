import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import type { Budget } from "../ui/budgets-page";

export function useToggleBudgetStatus({
   budget,
   onSuccess,
}: {
   budget: Budget;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const updateMutation = useMutation(
      trpc.budgets.update.mutationOptions({
         onError: () => {
            toast.error("Erro ao atualizar orçamento");
         },
         onSuccess: () => {
            toast.success(
               budget.isActive
                  ? "Orçamento desativado com sucesso"
                  : "Orçamento ativado com sucesso",
            );
            onSuccess?.();
         },
      }),
   );

   const toggleStatus = () => {
      openAlertDialog({
         actionLabel: "Confirmar",
         cancelLabel: "Cancelar",
         description: budget.isActive
            ? "Ao desativar, este orçamento não será mais considerado no controle de gastos."
            : "Ao ativar, este orçamento voltará a ser considerado no controle de gastos.",
         onAction: async () => {
            await updateMutation.mutateAsync({
               data: { isActive: !budget.isActive },
               id: budget.id,
            });
         },
         title: budget.isActive
            ? "Desativar orçamento"
            : "Ativar orçamento",
      });
   };

   return { isUpdating: updateMutation.isPending, toggleStatus };
}
