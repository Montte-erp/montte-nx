import type { DataSource } from "@packages/workflows/schemas/action-field.schema";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/integrations/clients";

export type OptionItem = {
	value: string;
	label: string;
	icon?: React.ReactNode;
	color?: string;
};

export type UseDataSourceOptionsResult = {
	options: OptionItem[];
	isLoading: boolean;
	error: unknown;
};

/**
 * Hook to fetch options for dynamic data sources.
 * Based on the dataSource value, fetches the appropriate data from the API.
 */
export function useDataSourceOptions(
	dataSource: DataSource | undefined,
): UseDataSourceOptionsResult {
	const trpc = useTRPC();

	// Categories
	const {
		data: categories,
		isLoading: categoriesLoading,
		error: categoriesError,
	} = useQuery({
		...trpc.categories.getAll.queryOptions(),
		enabled: dataSource === "categories",
	});

	// Tags
	const {
		data: tags,
		isLoading: tagsLoading,
		error: tagsError,
	} = useQuery({
		...trpc.tags.getAll.queryOptions(),
		enabled: dataSource === "tags",
	});

	// Bank Accounts
	const {
		data: bankAccounts,
		isLoading: bankAccountsLoading,
		error: bankAccountsError,
	} = useQuery({
		...trpc.bankAccounts.getAll.queryOptions(),
		enabled: dataSource === "bankAccounts",
	});

	// Cost Centers
	const {
		data: costCenters,
		isLoading: costCentersLoading,
		error: costCentersError,
	} = useQuery({
		...trpc.costCenters.getAll.queryOptions(),
		enabled: dataSource === "costCenters",
	});

	// Members (organization members)
	const {
		data: members,
		isLoading: membersLoading,
		error: membersError,
	} = useQuery({
		...trpc.organization.getActiveOrganizationMembers.queryOptions(),
		enabled: dataSource === "members",
	});

	// Map data to options based on dataSource
	if (!dataSource) {
		return { options: [], isLoading: false, error: null };
	}

	switch (dataSource) {
		case "categories":
			return {
				options:
					categories?.map((cat) => ({
						value: cat.id,
						label: cat.name,
						color: cat.color,
					})) ?? [],
				isLoading: categoriesLoading,
				error: categoriesError,
			};

		case "tags":
			return {
				options:
					tags?.map((tag) => ({
						value: tag.id,
						label: tag.name,
						color: tag.color,
					})) ?? [],
				isLoading: tagsLoading,
				error: tagsError,
			};

		case "bankAccounts":
			return {
				options:
					bankAccounts?.map((account) => ({
						value: account.id,
						label: account.name ?? "Sem nome",
					})) ?? [],
				isLoading: bankAccountsLoading,
				error: bankAccountsError,
			};

		case "costCenters":
			return {
				options:
					costCenters?.map((cc) => ({
						value: cc.id,
						label: cc.code ? `${cc.name} (${cc.code})` : cc.name,
					})) ?? [],
				isLoading: costCentersLoading,
				error: costCentersError,
			};

		case "members":
			return {
				options:
					members?.map((member) => ({
						value: member.userId,
						label: member.user.name ?? member.user.email,
					})) ?? [],
				isLoading: membersLoading,
				error: membersError,
			};

		default:
			return { options: [], isLoading: false, error: null };
	}
}
