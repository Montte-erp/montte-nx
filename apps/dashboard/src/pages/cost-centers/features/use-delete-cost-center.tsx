import type { CostCenter } from "@packages/database/repositories/cost-center-repository";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteCostCenter({
   costCenter,
   onSuccess,
}: {
   costCenter: CostCenter;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const deleteCostCenterMutation = useMutation(
      trpc.costCenters.delete.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao excluir centro de custo");
         },
         onSuccess: () => {
            toast.success("Centro de custo excluído com sucesso");
            onSuccess?.();
         },
      }),
   );

   const deleteCostCenter = () => {
      openAlertDialog({
         actionLabel: "Excluir centro de custo",
         cancelLabel: "Cancelar",
         description:
            "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteCostCenterMutation.mutateAsync({ id: costCenter.id });
         },
         title: "Confirmar Exclusão",
         variant: "destructive",
      });
   };

   return { deleteCostCenter, isDeleting: deleteCostCenterMutation.isPending };
}
