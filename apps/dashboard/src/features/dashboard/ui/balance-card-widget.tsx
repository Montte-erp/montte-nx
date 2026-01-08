import { translate } from "@packages/localization";
import { formatDecimalCurrency } from "@packages/money";
import type { BalanceCardConfig } from "@packages/database/schemas/dashboards";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

type BalanceCardWidgetProps = {
	config: BalanceCardConfig;
};

function getCurrentMonthDates() {
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), 1);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
	return { end, start };
}

function BalanceCardWidgetSkeleton() {
	return (
		<div className="h-full flex flex-col justify-center">
			<div className="text-center mb-4">
				<Skeleton className="h-4 w-24 mx-auto mb-2" />
				<Skeleton className="h-8 w-40 mx-auto" />
			</div>
			<div className="grid grid-cols-2 gap-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		</div>
	);
}

function BalanceCardWidgetError() {
	return (
		<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
			{translate("dashboard.routes.home.balance-card.state.error.title")}
		</div>
	);
}

function BalanceCardWidgetContent({ config: _config }: BalanceCardWidgetProps) {
	const trpc = useTRPC();
	const { end: endDate, start: startDate } = getCurrentMonthDates();

	const { data: stats } = useSuspenseQuery(
		trpc.transactions.getStats.queryOptions({
			endDate: endDate.toISOString(),
			startDate: startDate.toISOString(),
		}),
	);

	const netBalance = stats.totalIncome - stats.totalExpenses;

	return (
		<div className="h-full flex flex-col justify-center">
			<div className="text-center mb-4">
				<p className="text-sm text-muted-foreground">
					{translate("dashboard.routes.home.balance-card.title")}
				</p>
				<p className="text-3xl font-bold">{formatDecimalCurrency(netBalance)}</p>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<Card className="bg-muted/50">
					<CardHeader className="p-3">
						<div className="flex items-center gap-2">
							<div className="rounded-full bg-green-500/10 p-1.5">
								<ArrowUpRight className="size-3 text-green-500" />
							</div>
							<CardDescription className="text-xs">
								{translate("dashboard.routes.home.balance-card.income")}
							</CardDescription>
						</div>
						<CardTitle className="text-base text-green-500">
							{formatDecimalCurrency(stats.totalIncome)}
						</CardTitle>
					</CardHeader>
				</Card>

				<Card className="bg-muted/50">
					<CardHeader className="p-3">
						<div className="flex items-center gap-2">
							<div className="rounded-full bg-red-500/10 p-1.5">
								<ArrowDownRight className="size-3 text-red-500" />
							</div>
							<CardDescription className="text-xs">
								{translate("dashboard.routes.home.balance-card.expenses")}
							</CardDescription>
						</div>
						<CardTitle className="text-base text-red-500">
							{formatDecimalCurrency(stats.totalExpenses)}
						</CardTitle>
					</CardHeader>
				</Card>
			</div>
		</div>
	);
}

export function BalanceCardWidget({ config }: BalanceCardWidgetProps) {
	return (
		<ErrorBoundary FallbackComponent={BalanceCardWidgetError}>
			<Suspense fallback={<BalanceCardWidgetSkeleton />}>
				<BalanceCardWidgetContent config={config} />
			</Suspense>
		</ErrorBoundary>
	);
}
