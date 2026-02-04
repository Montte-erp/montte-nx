import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/integrations/clients";

export function useStockLevel(itemId: string | undefined) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.inventory.getStockLevel.queryOptions({
			itemId: itemId ?? "",
		}),
		enabled: !!itemId,
	});
}
