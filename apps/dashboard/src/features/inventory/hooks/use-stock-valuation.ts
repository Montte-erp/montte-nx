import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/integrations/clients";

export function useStockValuation(itemId: string | undefined) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.inventory.getStockValuation.queryOptions({
			itemId: itemId ?? "",
		}),
		enabled: !!itemId,
	});
}
