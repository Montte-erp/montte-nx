import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useCreateItem() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation(
		trpc.inventory.create.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.list.queryKey(),
				});
				toast.success("Item de inventário criado com sucesso");
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Falha ao criar item de inventário";
				toast.error(errorMessage);
			},
		}),
	);
}
