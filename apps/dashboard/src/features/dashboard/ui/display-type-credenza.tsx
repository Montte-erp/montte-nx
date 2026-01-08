import { translate } from "@packages/localization";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@packages/ui/components/command";
import { cn } from "@packages/ui/lib/utils";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import {
	AreaChart,
	BarChart3,
	Globe,
	Hash,
	Layers,
	LineChart,
	PieChart,
	Scale,
	Table2,
	TrendingUp,
	Check,
} from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";
import { useMemo } from "react";

type ChartType = InsightConfig["chartType"];
type DataSource = InsightConfig["dataSource"];

type ChartTypeOption = {
	value: ChartType;
	label: string;
	description: string;
	icon: typeof LineChart;
};

type ChartCategory = {
	name: string;
	types: ChartTypeOption[];
};

const CHART_CATEGORIES: ChartCategory[] = [
	{
		name: translate("dashboard.widgets.display-type.categories.time-series"),
		types: [
			{
				value: "line",
				label: translate("dashboard.widgets.display-type.types.line.name"),
				description: translate("dashboard.widgets.display-type.types.line.description"),
				icon: LineChart,
			},
			{
				value: "area",
				label: translate("dashboard.widgets.display-type.types.area.name"),
				description: translate("dashboard.widgets.display-type.types.area.description"),
				icon: AreaChart,
			},
			{
				value: "bar",
				label: translate("dashboard.widgets.display-type.types.bar.name"),
				description: translate("dashboard.widgets.display-type.types.bar.description"),
				icon: BarChart3,
			},
			{
				value: "stacked_bar",
				label: translate("dashboard.widgets.display-type.types.stacked-bar.name"),
				description: translate("dashboard.widgets.display-type.types.stacked-bar.description"),
				icon: Layers,
			},
		],
	},
	{
		name: translate("dashboard.widgets.display-type.categories.cumulative"),
		types: [
			{
				value: "line_cumulative",
				label: translate("dashboard.widgets.display-type.types.line-cumulative.name"),
				description: translate("dashboard.widgets.display-type.types.line-cumulative.description"),
				icon: TrendingUp,
			},
		],
	},
	{
		name: translate("dashboard.widgets.display-type.categories.total-value"),
		types: [
			{
				value: "stat_card",
				label: translate("dashboard.widgets.display-type.types.number.name"),
				description: translate("dashboard.widgets.display-type.types.number.description"),
				icon: Hash,
			},
			{
				value: "pie",
				label: translate("dashboard.widgets.display-type.types.pie.name"),
				description: translate("dashboard.widgets.display-type.types.pie.description"),
				icon: PieChart,
			},
			{
				value: "bar_total",
				label: translate("dashboard.widgets.display-type.types.bar-total.name"),
				description: translate("dashboard.widgets.display-type.types.bar-total.description"),
				icon: BarChart3,
			},
			{
				value: "table",
				label: translate("dashboard.widgets.display-type.types.table.name"),
				description: translate("dashboard.widgets.display-type.types.table.description"),
				icon: Table2,
			},
		],
	},
	{
		name: translate("dashboard.widgets.display-type.categories.visualizations"),
		types: [
			{
				value: "world_map",
				label: translate("dashboard.widgets.display-type.types.world-map.name"),
				description: translate("dashboard.widgets.display-type.types.world-map.description"),
				icon: Globe,
			},
		],
	},
	{
		name: translate("dashboard.widgets.display-type.categories.analysis"),
		types: [
			{
				value: "category_analysis",
				label: translate("dashboard.widgets.display-type.types.category-analysis.name"),
				description: translate("dashboard.widgets.display-type.types.category-analysis.description"),
				icon: Layers,
			},
			{
				value: "comparison",
				label: translate("dashboard.widgets.display-type.types.comparison.name"),
				description: translate("dashboard.widgets.display-type.types.comparison.description"),
				icon: Scale,
			},
		],
	},
];

// Chart types available for each data source
// Bank accounts don't support time-based charts (point-in-time data)
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

type DisplayTypeCredenzaProps = {
	currentType: ChartType;
	dataSource?: DataSource;
	onSelectType: (type: ChartType) => void;
};

export function DisplayTypeCredenza({
	currentType,
	dataSource,
	onSelectType,
}: DisplayTypeCredenzaProps) {
	const { closeCredenza } = useCredenza();

	// Filter chart categories based on data source compatibility
	const filteredCategories = useMemo(() => {
		if (!dataSource) return CHART_CATEGORIES;

		const allowedTypes = CHART_TYPE_COMPATIBILITY[dataSource] || [];
		return CHART_CATEGORIES
			.map((category) => ({
				...category,
				types: category.types.filter((type) => allowedTypes.includes(type.value)),
			}))
			.filter((category) => category.types.length > 0);
	}, [dataSource]);

	const handleSelect = (type: ChartType) => {
		onSelectType(type);
		closeCredenza();
	};

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle className="flex items-center gap-2">
					<BarChart3 className="h-5 w-5" />
					{translate("dashboard.widgets.display-type.title")}
				</CredenzaTitle>
				<CredenzaDescription>
					{translate("dashboard.widgets.display-type.description")}
				</CredenzaDescription>
			</CredenzaHeader>
			<CredenzaBody className="p-0">
				<Command className="rounded-none border-none">
					<div className="border-b px-3 pb-3">
						<CommandInput
							placeholder={translate("dashboard.widgets.display-type.search")}
							className="h-10"
						/>
					</div>
					<CommandList className="max-h-[400px] p-2">
						<CommandEmpty>
							{translate("common.form.search.no-results")}
						</CommandEmpty>
						{filteredCategories.map((category) => (
							<CommandGroup 
								key={category.name} 
								heading={category.name}
								className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2"
							>
								{category.types.map((type) => {
									const Icon = type.icon;
									const isSelected = currentType === type.value;
									return (
										<CommandItem
											key={type.value}
											value={`${type.label} ${type.description}`}
											onSelect={() => handleSelect(type.value)}
											className={cn(
												"flex items-start gap-3 py-3 px-3 rounded-lg mb-1 cursor-pointer",
												"transition-all duration-150",
												isSelected 
													? "bg-primary/10 border-l-2 border-l-primary" 
													: "border-l-2 border-l-transparent hover:bg-muted/50",
											)}
										>
											<div className={cn(
												"flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
												isSelected 
													? "bg-primary text-primary-foreground" 
													: "border bg-background"
											)}>
												<Icon className="h-5 w-5" />
											</div>
											<div className="flex flex-col gap-0.5 flex-1 min-w-0">
												<span className="font-medium">{type.label}</span>
												<span className="text-xs text-muted-foreground leading-relaxed">
													{type.description}
												</span>
											</div>
											{isSelected && (
												<Check className="h-5 w-5 text-primary shrink-0 self-center" />
											)}
										</CommandItem>
									);
								})}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</CredenzaBody>
		</>
	);
}
