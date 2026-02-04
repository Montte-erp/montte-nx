import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useUpdateItem() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation(
		trpc.inventory.update.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.list.queryKey(),
				});
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getItem.queryKey(),
				});
				toast.success("Item de inventário atualizado com sucesso");
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Falha ao atualizar item de inventário";
				toast.error(errorMessage);
			},
		}),
	);
}
