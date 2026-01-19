import type { Tag } from "@packages/database/repositories/tag-repository";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteTag({
   tag,
   onSuccess,
}: {
   tag: Tag;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const deleteTagMutation = useMutation(
      trpc.tags.delete.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao excluir tag");
         },
         onSuccess: () => {
            toast.success("Tag excluída com sucesso");
            onSuccess?.();
         },
      }),
   );

   const deleteTag = () => {
      openAlertDialog({
         actionLabel: "Excluir tag",
         cancelLabel: "Cancelar",
         description:
            "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteTagMutation.mutateAsync({ id: tag.id });
         },
         title: "Confirmar Exclusão",
         variant: "destructive",
      });
   };

   return { deleteTag, isDeleting: deleteTagMutation.isPending };
}
