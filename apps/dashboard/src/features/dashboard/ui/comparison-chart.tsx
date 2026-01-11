import { formatDecimalCurrency } from "@packages/money";
import { Card, CardContent } from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus, TrendingDown, TrendingUp } from "lucide-react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useTRPC } from "@/integrations/clients";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";

type ComparisonChartProps = {
	config: InsightConfig;
	globalFilters?: {
		dateRange?: {
			startDate: string;
			endDate: string;
		};
	};
	onDrillDown?: (context: DrillDownContext) => void;
};

export function ComparisonChart({
	config,
	globalFilters,
	onDrillDown,
}: ComparisonChartProps) {
	const trpc = useTRPC();

	// Query current period
	const { data, isLoading, error } = useQuery(
		trpc.dashboards.queryInsight.queryOptions({
			config: {
				...config,
				comparison: config.comparison || { type: "previous_period" },
			},
			globalFilters,
		}),
	);

	if (isLoading) {
		return <ComparisonSkeleton />;
	}

	if (error) {
		return (
			<div className="h-full flex items-center justify-center text-destructive text-sm">
				Failed to load comparison data
			</div>
		);
	}

	if (!data) {
		return (
			<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
				No comparison data available
			</div>
		);
	}

	const currentValue = data.value;
	const previousValue = data.comparison?.previousValue ?? 0;
	const change = data.comparison?.change ?? 0;
	const changePercent = data.comparison?.changePercent ?? 0;
	const isPositive = change >= 0;
	const comparisonLabel =
		config.comparison?.type === "previous_year" ? "Last Year" : "Previous Period";

	// Prepare chart data for side-by-side comparison
	const chartData = [
		{
			name: "Current Period",
			value: currentValue,
		},
		{
			name: comparisonLabel,
			value: previousValue,
		},
	];

	// If we have breakdown data, show comparison per category
	const breakdownComparison = data.breakdown?.map((item) => ({
		name: item.label,
		current: item.value,
		previous: (item as { previousValue?: number }).previousValue ?? 0,
	}));

	return (
		<div className="h-full flex flex-col gap-4 overflow-auto">
			{/* Summary Cards */}
			<div className="grid grid-cols-3 gap-4 px-1">
				{/* Current Period */}
				<Card>
					<CardContent className="p-4">
						<div className="text-xs text-muted-foreground mb-1">Current Period</div>
						<div className="text-2xl font-bold">
							{config.aggregation === "count"
								? currentValue.toLocaleString()
								: formatDecimalCurrency(currentValue)}
						</div>
					</CardContent>
				</Card>

				{/* Previous Period */}
				<Card>
					<CardContent className="p-4">
						<div className="text-xs text-muted-foreground mb-1">{comparisonLabel}</div>
						<div className="text-2xl font-bold text-muted-foreground">
							{config.aggregation === "count"
								? previousValue.toLocaleString()
								: formatDecimalCurrency(previousValue)}
						</div>
					</CardContent>
				</Card>

				{/* Change */}
				<Card className={cn(isPositive ? "border-green-200" : "border-red-200")}>
					<CardContent className="p-4">
						<div className="text-xs text-muted-foreground mb-1">Change</div>
						<div
							className={cn(
								"text-2xl font-bold flex items-center gap-2",
								isPositive ? "text-green-600" : "text-red-600",
							)}
						>
							{isPositive ? (
								<TrendingUp className="h-5 w-5" />
							) : (
								<TrendingDown className="h-5 w-5" />
							)}
							<span>
								{isPositive ? "+" : ""}
								{changePercent.toFixed(1)}%
							</span>
						</div>
						<div
							className={cn(
								"text-xs mt-1",
								isPositive ? "text-green-600" : "text-red-600",
							)}
						>
							{isPositive ? "+" : ""}
							{config.aggregation === "count"
								? change.toLocaleString()
								: formatDecimalCurrency(change)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Comparison Bar Chart */}
			<div className="flex-1 min-h-48 px-1">
				<ResponsiveContainer width="100%" height="100%">
					{breakdownComparison && breakdownComparison.length > 0 ? (
						<BarChart
							data={breakdownComparison.slice(0, 10)}
							margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="name" tick={{ fontSize: 10 }} />
							<YAxis
								tickFormatter={(value) =>
									config.aggregation === "count"
										? value.toLocaleString()
										: formatDecimalCurrency(value)
								}
								tick={{ fontSize: 10 }}
							/>
							<Tooltip
								formatter={(value: number, name: string) => [
									config.aggregation === "count"
										? value.toLocaleString()
										: formatDecimalCurrency(value),
									name === "current" ? "Current Period" : comparisonLabel,
								]}
							/>
							<Legend />
							<Bar
								dataKey="current"
								name="Current Period"
								fill="hsl(var(--chart-1))"
								radius={[4, 4, 0, 0]}
							/>
							<Bar
								dataKey="previous"
								name={comparisonLabel}
								fill="hsl(var(--chart-2))"
								radius={[4, 4, 0, 0]}
							/>
						</BarChart>
					) : (
						<BarChart
							data={chartData}
							margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="name" tick={{ fontSize: 12 }} />
							<YAxis
								tickFormatter={(value) =>
									config.aggregation === "count"
										? value.toLocaleString()
										: formatDecimalCurrency(value)
								}
								tick={{ fontSize: 10 }}
							/>
							<Tooltip
								formatter={(value: number) => [
									config.aggregation === "count"
										? value.toLocaleString()
										: formatDecimalCurrency(value),
									"Amount",
								]}
							/>
							<Bar dataKey="value" radius={[4, 4, 0, 0]}>
								{chartData.map((_, index) => (
									<Cell
										key={`cell-${index + 1}`}
										fill={index === 0 ? "hsl(var(--chart-1))" : "hsl(var(--chart-2))"}
									/>
								))}
							</Bar>
						</BarChart>
					)}
				</ResponsiveContainer>
			</div>

			{/* Breakdown List (if available) */}
			{breakdownComparison && breakdownComparison.length > 0 && (
				<div className="space-y-2 px-1">
					<div className="text-sm font-medium text-muted-foreground">
						Breakdown by Category
					</div>
					{breakdownComparison.slice(0, 5).map((item, index) => {
						const itemChange = item.previous > 0
							? ((item.current - item.previous) / item.previous) * 100
							: 0;
						const isItemPositive = itemChange >= 0;

						return (
							<div
								key={`breakdown-${index + 1}`}
								className={cn(
									"flex items-center justify-between p-3 rounded-lg border",
									onDrillDown && "cursor-pointer hover:bg-muted/50",
								)}
								onClick={() => {
									if (onDrillDown) {
										onDrillDown({
											dimension: "categoryId",
											value: item.name,
											label: item.name,
										});
									}
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter" && onDrillDown) {
										onDrillDown({
											dimension: "categoryId",
											value: item.name,
											label: item.name,
										});
									}
								}}
								role={onDrillDown ? "button" : undefined}
								tabIndex={onDrillDown ? 0 : undefined}
							>
								<div>
									<div className="font-medium">{item.name}</div>
									<div className="text-xs text-muted-foreground">
										{formatDecimalCurrency(item.current)} vs{" "}
										{formatDecimalCurrency(item.previous)}
									</div>
								</div>
								<div
									className={cn(
										"flex items-center gap-1 text-sm font-medium",
										isItemPositive ? "text-green-600" : "text-red-600",
									)}
								>
									{isItemPositive ? (
										<ArrowUp className="h-4 w-4" />
									) : (
										<ArrowDown className="h-4 w-4" />
									)}
									{itemChange === 0 ? (
										<Minus className="h-4 w-4" />
									) : (
										<span>
											{isItemPositive ? "+" : ""}
											{itemChange.toFixed(1)}%
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function ComparisonSkeleton() {
	return (
		<div className="h-full flex flex-col gap-4">
			<div className="grid grid-cols-3 gap-4 px-1">
				{Array.from({ length: 3 }).map((_, i) => (
					<Skeleton key={`card-skeleton-${i + 1}`} className="h-24" />
				))}
			</div>
			<Skeleton className="flex-1 min-h-48" />
		</div>
	);
}
