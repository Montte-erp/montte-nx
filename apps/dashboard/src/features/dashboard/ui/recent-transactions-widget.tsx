import { translate } from "@packages/localization";
import type { RecentTransactionsConfig } from "@packages/database/schemas/dashboards";
import { DataTable } from "@packages/ui/components/data-table";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyMedia,
	EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { ItemGroup, ItemSeparator } from "@packages/ui/components/item";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Fragment, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { TransactionMobileCard } from "@/features/transaction/ui/transaction-mobile-card";
import { createTransactionColumns } from "@/features/transaction/ui/transaction-table-columns";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";

type RecentTransactionsWidgetProps = {
	config: RecentTransactionsConfig;
};

function RecentTransactionsWidgetSkeleton() {
	return (
		<div className="h-full">
			<ItemGroup>
				{[1, 2, 3].map((index) => (
					<Fragment key={`skeleton-${index}`}>
						<div className="flex items-center justify-between gap-4 py-2">
							<Skeleton className="h-8 w-8 rounded-sm" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-3 w-24" />
							</div>
							<Skeleton className="h-6 w-16" />
						</div>
						{index !== 3 && <ItemSeparator />}
					</Fragment>
				))}
			</ItemGroup>
		</div>
	);
}

function RecentTransactionsWidgetError() {
	return (
		<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
			{translate("dashboard.routes.home.recent-transactions.state.error.title")}
		</div>
	);
}

function RecentTransactionsWidgetContent({ config }: RecentTransactionsWidgetProps) {
	const trpc = useTRPC();
	const { activeOrganization } = useActiveOrganization();

	const limit = config.limit || 5;

	const { data } = useSuspenseQuery(
		trpc.transactions.getAllPaginated.queryOptions({
			limit,
			orderBy: "date",
			orderDirection: "desc",
			page: 1,
		}),
	);

	const { transactions } = data;

	const { data: categories = [] } = useSuspenseQuery(
		trpc.categories.getAll.queryOptions(),
	);

	if (transactions.length === 0) {
		return (
			<div className="h-full flex items-center justify-center">
				<Empty>
					<EmptyContent>
						<EmptyMedia variant="icon">
							<Wallet />
						</EmptyMedia>
						<EmptyTitle>
							{translate("dashboard.routes.home.recent-transactions.state.empty.title")}
						</EmptyTitle>
						<EmptyDescription>
							{translate("dashboard.routes.home.recent-transactions.state.empty.description")}
						</EmptyDescription>
					</EmptyContent>
				</Empty>
			</div>
		);
	}

	return (
		<div className="h-full overflow-auto">
			<DataTable
				columns={createTransactionColumns(categories, activeOrganization.slug)}
				data={transactions}
				getRowId={(row) => row.id}
				renderMobileCard={(props) => (
					<TransactionMobileCard {...props} categories={categories} />
				)}
			/>
		</div>
	);
}

export function RecentTransactionsWidget({ config }: RecentTransactionsWidgetProps) {
	return (
		<ErrorBoundary FallbackComponent={RecentTransactionsWidgetError}>
			<Suspense fallback={<RecentTransactionsWidgetSkeleton />}>
				<RecentTransactionsWidgetContent config={config} />
			</Suspense>
		</ErrorBoundary>
	);
}
