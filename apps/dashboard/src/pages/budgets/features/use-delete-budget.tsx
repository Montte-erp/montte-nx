import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import type { Budget } from "../ui/budgets-page";

export function useDeleteBudget({
   budget,
   onSuccess,
}: {
   budget: Budget;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const deleteBudgetMutation = useMutation(
      trpc.budgets.delete.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao excluir orçamento");
         },
         onSuccess: () => {
            toast.success("Orçamento excluído com sucesso");
            onSuccess?.();
         },
      }),
   );

   const deleteBudget = () => {
      openAlertDialog({
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         description:
            "Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteBudgetMutation.mutateAsync({ id: budget.id });
         },
         title: "Excluir orçamento",
         variant: "destructive",
      });
   };

   return { deleteBudget, isDeleting: deleteBudgetMutation.isPending };
}
