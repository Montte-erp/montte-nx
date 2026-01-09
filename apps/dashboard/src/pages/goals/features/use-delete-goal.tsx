"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useDeleteGoal() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { openAlertDialog } = useAlertDialog();

	const deleteMutation = useMutation(
		trpc.goals.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: [["goals"]] });
				toast.success("Meta excluida com sucesso");
			},
			onError: (error) => {
				toast.error(error.message || "Erro ao excluir meta");
			},
		}),
	);

	const deleteGoal = (goalId: string, goalName: string) => {
		openAlertDialog({
			title: "Excluir Meta",
			description: `Tem certeza que deseja excluir a meta "${goalName}"? Esta acao nao pode ser desfeita.`,
			actionLabel: "Excluir",
			variant: "destructive",
			onAction: async () => {
				await deleteMutation.mutateAsync({ id: goalId });
			},
		});
	};

	return { deleteGoal, isDeleting: deleteMutation.isPending };
}
