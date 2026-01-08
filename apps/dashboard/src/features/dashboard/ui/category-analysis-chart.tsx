import { formatDecimalCurrency } from "@packages/money";
import { Card, CardContent } from "@packages/ui/components/card";
import { Progress } from "@packages/ui/components/progress";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { useQuery } from "@tanstack/react-query";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	XAxis,
	YAxis,
	Tooltip,
} from "recharts";
import { useTRPC } from "@/integrations/clients";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";

const COLORS = [
	"#8884d8",
	"#82ca9d",
	"#ffc658",
	"#ff7300",
	"#0088fe",
	"#00c49f",
	"#ffbb28",
	"#ff8042",
];

type CategoryAnalysisChartProps = {
	config: InsightConfig;
	globalFilters?: {
		dateRange?: {
			startDate: string;
			endDate: string;
		};
	};
	onDrillDown?: (context: DrillDownContext) => void;
};

export function CategoryAnalysisChart({
	config,
	globalFilters,
	onDrillDown,
}: CategoryAnalysisChartProps) {
	const trpc = useTRPC();

	const { data, isLoading, error } = useQuery(
		trpc.dashboards.queryInsight.queryOptions({
			config: {
				...config,
				breakdown: { field: "categoryId" },
			},
			globalFilters,
		}),
	);

	if (isLoading) {
		return <CategoryAnalysisSkeleton />;
	}

	if (error) {
		return (
			<div className="h-full flex items-center justify-center text-destructive text-sm">
				Failed to load category data
			</div>
		);
	}

	if (!data || !data.breakdown || data.breakdown.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
				No category data available
			</div>
		);
	}

	// Transform breakdown data to category analysis format
	const categories = data.breakdown.map((item, index) => ({
		id: (item as { id?: string }).id || item.label,
		name: item.label,
		color: item.color || COLORS[index % COLORS.length],
		value: item.value,
	}));

	const total = categories.reduce((sum, cat) => sum + cat.value, 0);

	const handleCategoryClick = (category: { id: string; name: string }) => {
		if (onDrillDown) {
			onDrillDown({
				dimension: "categoryId",
				value: category.id,
				label: category.name,
			});
		}
	};

	return (
		<div className="h-full flex flex-col gap-4 overflow-auto">
			{/* Summary Header */}
			<div className="flex items-center justify-between px-1">
				<div>
					<div className="text-2xl font-bold">{formatDecimalCurrency(total)}</div>
					<div className="text-sm text-muted-foreground">
						Total across {categories.length} categories
					</div>
				</div>
			</div>

			{/* Horizontal Bar Chart */}
			<div className="h-48 min-h-48">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart
						data={categories.slice(0, 8)}
						layout="vertical"
						margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
					>
						<CartesianGrid strokeDasharray="3 3" horizontal={false} />
						<XAxis
							type="number"
							tickFormatter={(value) => formatDecimalCurrency(value)}
							tick={{ fontSize: 10 }}
						/>
						<YAxis
							type="category"
							dataKey="name"
							tick={{ fontSize: 11 }}
							width={75}
						/>
						<Tooltip
							formatter={(value: number) => [formatDecimalCurrency(value), "Amount"]}
							labelStyle={{ fontWeight: "bold" }}
						/>
						<Bar
							dataKey="value"
							radius={[0, 4, 4, 0]}
							cursor={onDrillDown ? "pointer" : undefined}
						>
							{categories.slice(0, 8).map((category, index) => (
								<Cell
									key={`cell-${index + 1}`}
									fill={category.color}
									onClick={() => handleCategoryClick(category)}
								/>
							))}
						</Bar>
					</BarChart>
				</ResponsiveContainer>
			</div>

			{/* Category List with Details */}
			<div className="flex-1 space-y-2 px-1">
				{categories.map((category, index) => {
					const percentage = total > 0 ? (category.value / total) * 100 : 0;

					return (
						<Card
							key={`category-${index + 1}`}
							className={cn(
								"transition-colors",
								onDrillDown && "cursor-pointer hover:bg-muted/50",
							)}
							onClick={() => onDrillDown && handleCategoryClick(category)}
						>
							<CardContent className="p-3">
								<div className="flex items-center justify-between gap-4">
									{/* Category Info */}
									<div className="flex items-center gap-3 min-w-0 flex-1">
										<div
											className="w-3 h-3 rounded-full shrink-0"
											style={{ backgroundColor: category.color }}
										/>
										<div className="min-w-0">
											<div className="font-medium truncate">{category.name}</div>
											<div className="text-xs text-muted-foreground">
												{percentage.toFixed(1)}% of total
											</div>
										</div>
									</div>

									{/* Amount */}
									<div className="text-right shrink-0">
										<div className="font-medium">
											{formatDecimalCurrency(category.value)}
										</div>
									</div>
								</div>

								{/* Progress bar showing percentage of total */}
								<div className="mt-2">
									<Progress
										value={percentage}
										className="h-1.5"
										style={
											{
												"--progress-background": category.color,
											} as React.CSSProperties
										}
									/>
								</div>
							</CardContent>
						</Card>
					);
				})}
			</div>
		</div>
	);
}

function CategoryAnalysisSkeleton() {
	return (
		<div className="h-full flex flex-col gap-4">
			<div className="space-y-2 px-1">
				<Skeleton className="h-8 w-32" />
				<Skeleton className="h-4 w-48" />
			</div>
			<Skeleton className="h-48" />
			<div className="flex-1 space-y-2 px-1">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton key={`skeleton-${i + 1}`} className="h-16" />
				))}
			</div>
		</div>
	);
}
