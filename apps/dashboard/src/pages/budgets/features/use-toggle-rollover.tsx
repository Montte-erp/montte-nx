import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

type Budget = {
   id: string;
   rollover: boolean;
};

export function useToggleRollover({
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
            onSuccess?.();
         },
      }),
   );

   const toggleRollover = () => {
      openAlertDialog({
         actionLabel: "Confirmar",
         cancelLabel: "Cancelar",
         description: budget.rollover
            ? "O saldo não utilizado não será mais acumulado para o próximo período. O orçamento será reiniciado a cada período."
            : "O saldo não utilizado será acumulado para o próximo período. Isso permite que você economize para usar depois.",
         onAction: async () => {
            await updateMutation.mutateAsync({
               data: { rollover: !budget.rollover },
               id: budget.id,
            });
         },
         title: budget.rollover ? "Desativar acumulação" : "Ativar acumulação",
      });
   };

   return { isUpdating: updateMutation.isPending, toggleRollover };
}
