import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/integrations/clients";

export function useItemCounterparties(itemId: string | undefined) {
	const trpc = useTRPC();

	return useQuery({
		...trpc.inventory.getCounterparties.queryOptions({
			itemId: itemId ?? "",
		}),
		enabled: !!itemId,
	});
}
