import { useCallback } from "react";
import { useDeleteItem } from "@/features/inventory/hooks/use-delete-item";
import { useAlertDialog } from "@/hooks/use-alert-dialog";

type DeleteItemAlertProps = {
	itemId: string;
	itemName: string;
	onSuccess?: () => void;
};

export function useDeleteItemAlert() {
	const { openAlertDialog } = useAlertDialog();
	const deleteMutation = useDeleteItem();

	const openDeleteAlert = useCallback(
		({ itemId, itemName, onSuccess }: DeleteItemAlertProps) => {
			openAlertDialog({
				title: "Excluir Item de Inventário",
				description: `Tem certeza que deseja excluir o item "${itemName}"? Esta ação não pode ser desfeita.`,
				actionLabel: "Excluir",
				cancelLabel: "Cancelar",
				variant: "destructive",
				onAction: async () => {
					await deleteMutation.mutateAsync({ id: itemId });
					onSuccess?.();
				},
			});
		},
		[openAlertDialog, deleteMutation],
	);

	return { openDeleteAlert };
}
