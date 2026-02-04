import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useDeleteItem() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation(
		trpc.inventory.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.list.queryKey(),
				});
				toast.success("Item de inventário excluído com sucesso");
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Falha ao excluir item de inventário";
				toast.error(errorMessage);
			},
		}),
	);
}
