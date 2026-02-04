import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useRecordMovement() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation(
		trpc.inventory.recordMovement.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getStockLevel.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getStockValuation.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getMovements.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getStockSummary.queryKey(),
				});
				toast.success("Movimentação de estoque registrada com sucesso");
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Falha ao registrar movimentação de estoque";
				toast.error(errorMessage);
			},
		}),
	);
}
