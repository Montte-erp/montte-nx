import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useLinkCounterparty() {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	return useMutation(
		trpc.inventory.linkCounterparty.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.inventory.getCounterparties.queryKey(),
				});
				toast.success("Contraparte vinculada com sucesso");
			},
			onError: (error) => {
				const errorMessage =
					error instanceof Error
						? error.message
						: "Falha ao vincular contraparte";
				toast.error(errorMessage);
			},
		}),
	);
}
