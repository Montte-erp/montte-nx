import type { Category } from "@packages/database/repositories/category-repository";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteCategory({
   category,
   onSuccess,
}: {
   category: Category;
   onSuccess?: () => void;
}) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const deleteCategoryMutation = useMutation(
      trpc.categories.delete.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Failed to delete category");
         },
         onSuccess: () => {
            toast.success("Category deleted successfully");
            onSuccess?.();
         },
      }),
   );

   const deleteCategory = () => {
      openAlertDialog({
         actionLabel: "Excluir categoria",
         cancelLabel: "Cancelar",
         description:
            "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await deleteCategoryMutation.mutateAsync({ id: category.id });
         },
         title: "Confirmar Exclusão",
         variant: "destructive",
      });
   };

   return { deleteCategory, isDeleting: deleteCategoryMutation.isPending };
}
