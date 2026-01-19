import type { InterestTemplate } from "@packages/database/repositories/interest-template-repository";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteInterestTemplate({
   template,
   onSuccess,
}: {
   template: InterestTemplate;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const deleteTemplateMutation = useMutation(
      trpc.interestTemplates.delete.mutationOptions({
         onError: () => {
            toast.error("Falha ao excluir modelo de juros");
         },
         onSuccess: () => {
            toast.success("Modelo de juros excluido com sucesso");
            onSuccess?.();
         },
      }),
   );

   const deleteInterestTemplate = () => {
      openAlertDialog({
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         description:
            "Tem certeza que deseja excluir este modelo de juros? Esta acao nao pode ser desfeita.",
         onAction: async () => {
            await deleteTemplateMutation.mutateAsync({ id: template.id });
         },
         title: "Confirmar exclusao",
         variant: "destructive",
      });
   };

   return {
      deleteInterestTemplate,
      isDeleting: deleteTemplateMutation.isPending,
   };
}
