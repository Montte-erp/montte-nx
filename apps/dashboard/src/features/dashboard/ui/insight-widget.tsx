import { formatDecimalCurrency } from "@packages/money";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@packages/ui/components/chart";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import { useTRPC } from "@/integrations/clients";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";
import { CategoryAnalysisChart } from "./category-analysis-chart";
import { ComparisonChart } from "./comparison-chart";

type InsightWidgetProps = {
	widgetId: string;
	config: InsightConfig;
	globalFilters?: {
		dateRange?: {
			startDate: string;
			endDate: string;
		};
	};
	onDrillDown?: (context: DrillDownContext) => void;
};

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

export function InsightWidget({
	config,
	globalFilters,
	onDrillDown,
}: InsightWidgetProps) {
	const trpc = useTRPC();

	const { data, isLoading, error } = useQuery(
		trpc.dashboards.queryInsight.queryOptions({
			config,
			globalFilters,
		}),
	);

	if (isLoading) {
		return <InsightSkeleton chartType={config.chartType} />;
	}

	if (error) {
		return (
			<div className="h-full flex items-center justify-center text-destructive text-sm">
				Failed to load data
			</div>
		);
	}

	if (!data) {
		return (
			<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
				No data available
			</div>
		);
	}

	switch (config.chartType) {
		case "stat_card":
			return <StatCardChart data={data} config={config} onDrillDown={onDrillDown} />;
		case "line":
			return <LineChartWidget data={data} config={config} onDrillDown={onDrillDown} />;
		case "bar":
			return <BarChartWidget data={data} config={config} onDrillDown={onDrillDown} />;
		case "pie":
		case "donut":
			return <PieChartWidget data={data} config={config} isDonut={config.chartType === "donut"} onDrillDown={onDrillDown} />;
		case "table":
			return <TableWidget data={data} config={config} onDrillDown={onDrillDown} />;
		case "category_analysis":
			return <CategoryAnalysisChart config={config} globalFilters={globalFilters} onDrillDown={onDrillDown} />;
		case "comparison":
			return <ComparisonChart config={config} globalFilters={globalFilters} onDrillDown={onDrillDown} />;
		default:
			return (
				<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
					Unsupported chart type
				</div>
			);
	}
}

function InsightSkeleton({ chartType }: { chartType: string }) {
	if (chartType === "stat_card") {
		return (
			<div className="h-full flex flex-col justify-center">
				<Skeleton className="h-10 w-32 mb-2" />
				<Skeleton className="h-4 w-24" />
			</div>
		);
	}
	return <Skeleton className="h-full w-full" />;
}

type InsightData = {
	value: number;
	comparison?: {
		previousValue: number;
		change: number;
		changePercent: number;
	};
	breakdown?: Array<{
		id?: string;
		label: string;
		value: number;
		color?: string;
	}>;
	timeSeries?: Array<{
		date: string;
		value: number;
	}>;
	tableData?: Array<Record<string, unknown>>;
};

type ChartComponentProps = {
	data: InsightData;
	config: InsightConfig;
	onDrillDown?: (context: DrillDownContext) => void;
};

function StatCardChart({
	data,
	config,
	onDrillDown,
}: ChartComponentProps) {
	const formattedValue =
		config.aggregation === "count"
			? data.value.toLocaleString()
			: formatDecimalCurrency(data.value);

	const hasComparison = data.comparison && config.comparison;
	const isPositive = data.comparison ? data.comparison.change >= 0 : true;

	const handleClick = () => {
		if (onDrillDown && config.breakdown?.field) {
			// For stat cards, clicking opens a breakdown view
			onDrillDown({
				dimension: "view",
				value: "breakdown",
				label: "View breakdown",
			});
		}
	};

	return (
		<div
			className={`h-full flex flex-col justify-center ${onDrillDown ? "cursor-pointer hover:bg-muted/30 transition-colors rounded-lg p-2 -m-2" : ""}`}
			onClick={handleClick}
			onKeyDown={(e) => e.key === "Enter" && handleClick()}
			role={onDrillDown ? "button" : undefined}
			tabIndex={onDrillDown ? 0 : undefined}
		>
			<div className="text-3xl font-bold">{formattedValue}</div>
			{hasComparison && data.comparison && (
				<div
					className={`flex items-center gap-1 text-sm ${
						isPositive ? "text-green-600" : "text-red-600"
					}`}
				>
					{isPositive ? (
						<TrendingUp className="h-4 w-4" />
					) : (
						<TrendingDown className="h-4 w-4" />
					)}
					<span>
						{isPositive ? "+" : ""}
						{data.comparison.changePercent.toFixed(1)}%
					</span>
					<span className="text-muted-foreground">
						vs {config.comparison?.type === "previous_year" ? "last year" : "previous period"}
					</span>
				</div>
			)}
		</div>
	);
}

function LineChartWidget({
	data,
	config,
	onDrillDown,
}: ChartComponentProps) {
	// Line chart drill-down is visual only for now (activeDot highlight)
	// Full click handling requires custom Recharts components
	void onDrillDown; // Acknowledge prop for future use
	
	if (!data.timeSeries || data.timeSeries.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
				No time series data
			</div>
		);
	}

	const chartConfig: ChartConfig = {
		value: {
			color: "hsl(var(--chart-1))",
			label: config.aggregateField,
		},
	};

	return (
		<ChartContainer config={chartConfig} className="h-full w-full">
			<LineChart data={data.timeSeries} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
				<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
				<XAxis
					dataKey="date"
					tick={{ fontSize: 10 }}
					tickLine={false}
					axisLine={false}
				/>
				<YAxis
					tick={{ fontSize: 10 }}
					tickLine={false}
					axisLine={false}
					tickFormatter={(value) =>
						config.aggregation === "count"
							? value.toLocaleString()
							: formatDecimalCurrency(value)
					}
				/>
				<ChartTooltip content={<ChartTooltipContent />} />
				<Line
					type="monotone"
					dataKey="value"
					stroke="var(--color-value)"
					strokeWidth={2}
					dot={false}
					activeDot={onDrillDown ? { r: 6, cursor: "pointer" } : undefined}
				/>
			</LineChart>
		</ChartContainer>
	);
}

function BarChartWidget({
	data,
	config,
	onDrillDown,
}: ChartComponentProps) {
	const chartData = data.breakdown || data.timeSeries || [];

	if (chartData.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
				No data available
			</div>
		);
	}

	const chartConfig: ChartConfig = {
		value: {
			color: "hsl(var(--chart-1))",
			label: config.aggregateField,
		},
	};

	const dataKey = data.breakdown ? "label" : "date";
	const isBreakdown = Boolean(data.breakdown);

	const handleBarClick = (entry: { label?: string; date?: string; id?: string; value: number }) => {
		if (!onDrillDown) return;

		if (isBreakdown && config.breakdown?.field) {
			onDrillDown({
				dimension: config.breakdown.field,
				value: entry.id || entry.label || "",
				label: entry.label || "",
			});
		} else if (entry.date) {
			onDrillDown({
				dimension: "date",
				value: entry.date,
				label: entry.date,
			});
		}
	};

	return (
		<ChartContainer config={chartConfig} className="h-full w-full">
			<BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
				<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
				<XAxis
					dataKey={dataKey}
					tick={{ fontSize: 10 }}
					tickLine={false}
					axisLine={false}
				/>
				<YAxis
					tick={{ fontSize: 10 }}
					tickLine={false}
					axisLine={false}
					tickFormatter={(value) =>
						config.aggregation === "count"
							? value.toLocaleString()
							: formatDecimalCurrency(value)
					}
				/>
				<ChartTooltip content={<ChartTooltipContent />} />
				<Bar
					dataKey="value"
					radius={[4, 4, 0, 0]}
					cursor={onDrillDown ? "pointer" : undefined}
				>
					{chartData.map((entry, index) => (
						<Cell
							key={`cell-${index + 1}`}
							fill={(entry as { color?: string }).color || COLORS[index % COLORS.length]}
							onClick={() => handleBarClick(entry as { label?: string; date?: string; id?: string; value: number })}
						/>
					))}
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}

function PieChartWidget({
	data,
	config,
	isDonut,
	onDrillDown,
}: ChartComponentProps & { isDonut: boolean }) {
	if (!data.breakdown || data.breakdown.length === 0) {
		return (
			<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
				No breakdown data
			</div>
		);
	}

	const chartConfig: ChartConfig = {};
	data.breakdown.forEach((item, index) => {
		chartConfig[item.label] = {
			color: item.color || COLORS[index % COLORS.length],
			label: item.label,
		};
	});

	const handleSliceClick = (entry: { id?: string; label: string; value: number }) => {
		if (!onDrillDown || !config.breakdown?.field) return;

		onDrillDown({
			dimension: config.breakdown.field,
			value: entry.id || entry.label,
			label: entry.label,
		});
	};

	return (
		<ChartContainer config={chartConfig} className="h-full w-full">
			<PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
				<ChartTooltip content={<ChartTooltipContent />} />
				<Pie
					data={data.breakdown}
					dataKey="value"
					nameKey="label"
					innerRadius={isDonut ? "50%" : 0}
					outerRadius="80%"
					paddingAngle={2}
					cursor={onDrillDown ? "pointer" : undefined}
				>
					{data.breakdown.map((entry, index) => (
						<Cell
							key={`cell-${index + 1}`}
							fill={entry.color || COLORS[index % COLORS.length]}
							onClick={() => handleSliceClick(entry)}
						/>
					))}
				</Pie>
			</PieChart>
		</ChartContainer>
	);
}

function TableWidget({
	data,
	config,
	onDrillDown,
}: ChartComponentProps) {
	const firstRow = data.tableData?.[0];
	if (!data.tableData || data.tableData.length === 0 || !firstRow) {
		return (
			<div className="h-full flex items-center justify-center text-muted-foreground text-sm">
				No data available
			</div>
		);
	}

	const columns = Object.keys(firstRow);

	const handleRowClick = (row: Record<string, unknown>) => {
		if (!onDrillDown || !config.breakdown?.field) return;

		const idValue = row.id || row[config.breakdown.field];
		const labelValue = row.label || row.name || row[config.breakdown.field];

		onDrillDown({
			dimension: config.breakdown.field,
			value: String(idValue ?? ""),
			label: String(labelValue ?? ""),
		});
	};

	return (
		<div className="h-full overflow-auto">
			<table className="w-full text-sm">
				<thead className="bg-muted/50 sticky top-0">
					<tr>
						{columns.map((col) => (
							<th key={col} className="text-left p-2 font-medium">
								{col}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{data.tableData.slice(0, 50).map((row, index) => (
						<tr
							key={`row-${index + 1}`}
							className={`border-b border-muted ${onDrillDown ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
							onClick={() => handleRowClick(row)}
							onKeyDown={(e) => e.key === "Enter" && handleRowClick(row)}
							role={onDrillDown ? "button" : undefined}
							tabIndex={onDrillDown ? 0 : undefined}
						>
							{columns.map((col) => (
								<td key={`${col}-${index + 1}`} className="p-2">
									{String(row[col] ?? "")}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
