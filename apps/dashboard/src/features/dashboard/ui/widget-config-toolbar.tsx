import { Button } from "@packages/ui/components/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@packages/ui/components/popover";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@packages/ui/components/command";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@packages/ui/components/tooltip";
import { cn } from "@packages/ui/lib/utils";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import {
	AreaChart,
	BarChart3,
	Calendar,
	Check,
	ChevronDown,
	Clock,
	Globe,
	GripVertical,
	Hash,
	Layers,
	LineChart,
	Maximize2,
	Minimize2,
	PieChart,
	Scale,
	Settings2,
	Table2,
	Trash2,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";

type ChartType = InsightConfig["chartType"];
type TimeGrouping = InsightConfig["timeGrouping"];
type DataSource = InsightConfig["dataSource"];

const CHART_TYPE_OPTIONS: Array<{
	value: ChartType;
	label: string;
	icon: typeof LineChart;
}> = [
	{ value: "line", label: "Line chart", icon: LineChart },
	{ value: "area", label: "Area chart", icon: AreaChart },
	{ value: "bar", label: "Bar chart", icon: BarChart3 },
	{ value: "stacked_bar", label: "Stacked bar", icon: Layers },
	{ value: "line_cumulative", label: "Cumulative", icon: TrendingUp },
	{ value: "pie", label: "Pie chart", icon: PieChart },
	{ value: "donut", label: "Donut chart", icon: PieChart },
	{ value: "stat_card", label: "Number", icon: Hash },
	{ value: "bar_total", label: "Bar total", icon: BarChart3 },
	{ value: "table", label: "Table", icon: Table2 },
	{ value: "world_map", label: "World map", icon: Globe },
	{ value: "category_analysis", label: "Categories", icon: Layers },
	{ value: "comparison", label: "Comparison", icon: Scale },
];

const TIME_GROUPING_OPTIONS: Array<{
	value: TimeGrouping;
	label: string;
}> = [
	{ value: "day", label: "day" },
	{ value: "week", label: "week" },
	{ value: "month", label: "month" },
	{ value: "quarter", label: "quarter" },
	{ value: "year", label: "year" },
];

const DATE_RANGE_OPTIONS = [
	{ value: "last_7_days", label: "Last 7 days" },
	{ value: "last_30_days", label: "Last 30 days" },
	{ value: "last_90_days", label: "Last 90 days" },
	{ value: "this_month", label: "This month" },
	{ value: "last_month", label: "Last month" },
	{ value: "this_quarter", label: "This quarter" },
	{ value: "this_year", label: "This year" },
	{ value: "last_year", label: "Last year" },
];

const COMPARISON_OPTIONS = [
	{ value: undefined, label: "No comparison" },
	{ value: "previous_period", label: "vs previous period" },
	{ value: "previous_year", label: "vs previous year" },
];

// Chart types available for each data source
const CHART_TYPE_COMPATIBILITY: Record<DataSource, ChartType[]> = {
	transactions: [
		"line", "area", "bar", "stacked_bar", "line_cumulative",
		"pie", "donut", "stat_card", "bar_total", "table",
		"category_analysis", "comparison",
	],
	bills: [
		"line", "area", "bar", "stacked_bar", "line_cumulative",
		"pie", "donut", "stat_card", "bar_total", "table",
	],
	budgets: [
		"line", "area", "bar", "stacked_bar", "line_cumulative",
		"pie", "donut", "stat_card", "bar_total", "table",
	],
	bank_accounts: [
		"pie", "donut", "bar", "stat_card", "bar_total", "table",
	],
};

type WidgetConfigToolbarProps = {
	config: InsightConfig;
	onUpdateConfig: (updates: Partial<InsightConfig>) => void;
	onOpenOptions: () => void;
	isFullWidth: boolean;
	onToggleWidth: () => void;
	onRemove: () => void;
};

export function WidgetConfigToolbar({
	config,
	onUpdateConfig,
	onOpenOptions,
	isFullWidth,
	onToggleWidth,
	onRemove,
}: WidgetConfigToolbarProps) {
	const [dateRangeOpen, setDateRangeOpen] = useState(false);
	const [timeGroupingOpen, setTimeGroupingOpen] = useState(false);
	const [comparisonOpen, setComparisonOpen] = useState(false);
	const [chartTypeOpen, setChartTypeOpen] = useState(false);

	const currentChartType = CHART_TYPE_OPTIONS.find((opt) => opt.value === config.chartType);
	const currentTimeGrouping = TIME_GROUPING_OPTIONS.find((opt) => opt.value === config.timeGrouping);
	const currentDateRange = DATE_RANGE_OPTIONS.find((opt) => opt.value === config.dateRangeOverride?.relativePeriod);
	const currentComparison = COMPARISON_OPTIONS.find((opt) => opt.value === config.comparison?.type);

	const allowedChartTypes = CHART_TYPE_COMPATIBILITY[config.dataSource] || [];
	const filteredChartOptions = CHART_TYPE_OPTIONS.filter((opt) => allowedChartTypes.includes(opt.value));

	// Check if time-based charts are available for this data source
	const supportsTimeSeries = config.dataSource !== "bank_accounts";

	return (
		<div className="hidden md:flex items-center justify-between gap-2 px-4 py-2 border-b bg-muted/30">
			{/* Left side: Drag handle, Date range, Time grouping, Comparison */}
			<div className="flex items-center gap-1">
				{/* Drag handle */}
				<div className="drag-handle cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-muted rounded">
					<GripVertical className="h-4 w-4 text-muted-foreground" />
				</div>

				<div className="w-px h-4 bg-border mx-1" />

				{/* Date Range */}
				<Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-normal">
							<Calendar className="h-3.5 w-3.5" />
							{currentDateRange?.label || "Last 30 days"}
							<ChevronDown className="h-3 w-3 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[200px] p-0" align="start">
						<Command>
							<CommandList>
								<CommandGroup>
									{DATE_RANGE_OPTIONS.map((option) => (
										<CommandItem
											key={option.value}
											value={option.value}
											onSelect={() => {
												onUpdateConfig({
													dateRangeOverride: { relativePeriod: option.value as NonNullable<InsightConfig["dateRangeOverride"]>["relativePeriod"] },
												});
												setDateRangeOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													config.dateRangeOverride?.relativePeriod === option.value
														? "opacity-100"
														: "opacity-0"
												)}
											/>
											{option.label}
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{/* Time Grouping */}
				{supportsTimeSeries && (
					<Popover open={timeGroupingOpen} onOpenChange={setTimeGroupingOpen}>
						<PopoverTrigger asChild>
							<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-normal">
								<Clock className="h-3.5 w-3.5" />
								<span className="text-muted-foreground">grouped by</span>
								{currentTimeGrouping?.label || "month"}
								<ChevronDown className="h-3 w-3 opacity-50" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-[150px] p-0" align="start">
							<Command>
								<CommandList>
									<CommandGroup>
										{TIME_GROUPING_OPTIONS.map((option) => (
											<CommandItem
												key={option.value}
												value={option.value}
												onSelect={() => {
													onUpdateConfig({ timeGrouping: option.value });
													setTimeGroupingOpen(false);
												}}
											>
												<Check
													className={cn(
														"mr-2 h-4 w-4",
														config.timeGrouping === option.value
															? "opacity-100"
															: "opacity-0"
													)}
												/>
												{option.label}
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
				)}

				{/* Comparison */}
				<Popover open={comparisonOpen} onOpenChange={setComparisonOpen}>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-normal">
							<Scale className="h-3.5 w-3.5" />
							{currentComparison?.label || "No comparison"}
							<ChevronDown className="h-3 w-3 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[200px] p-0" align="start">
						<Command>
							<CommandList>
								<CommandGroup>
									{COMPARISON_OPTIONS.map((option) => (
										<CommandItem
											key={option.value || "none"}
											value={option.value || "none"}
											onSelect={() => {
												onUpdateConfig({
													comparison: option.value ? { type: option.value as "previous_period" | "previous_year" } : undefined,
												});
												setComparisonOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													config.comparison?.type === option.value
														? "opacity-100"
														: "opacity-0"
												)}
											/>
											{option.label}
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>
			</div>

			{/* Right side: Options, Chart type, Width toggle, Remove */}
			<div className="flex items-center gap-1">
				{/* Options */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onOpenOptions}
						>
							<Settings2 className="h-3.5 w-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Options</TooltipContent>
				</Tooltip>

				{/* Chart Type */}
				<Popover open={chartTypeOpen} onOpenChange={setChartTypeOpen}>
					<PopoverTrigger asChild>
						<Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-normal">
							{currentChartType && <currentChartType.icon className="h-3.5 w-3.5" />}
							{currentChartType?.label || "Chart"}
							<ChevronDown className="h-3 w-3 opacity-50" />
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[180px] p-0" align="end">
						<Command>
							<CommandList>
								<CommandGroup>
									{filteredChartOptions.map((option) => (
										<CommandItem
											key={option.value}
											value={option.value}
											onSelect={() => {
												onUpdateConfig({ chartType: option.value });
												setChartTypeOpen(false);
											}}
										>
											<Check
												className={cn(
													"mr-2 h-4 w-4",
													config.chartType === option.value
														? "opacity-100"
														: "opacity-0"
												)}
											/>
											<option.icon className="mr-2 h-4 w-4" />
											{option.label}
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				<div className="w-px h-4 bg-border mx-1" />

				{/* Width Toggle */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							onClick={onToggleWidth}
						>
							{isFullWidth ? (
								<Minimize2 className="h-3.5 w-3.5" />
							) : (
								<Maximize2 className="h-3.5 w-3.5" />
							)}
						</Button>
					</TooltipTrigger>
					<TooltipContent>{isFullWidth ? "Half width" : "Full width"}</TooltipContent>
				</Tooltip>

				{/* Remove */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7 text-destructive hover:text-destructive"
							onClick={onRemove}
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Remove widget</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
