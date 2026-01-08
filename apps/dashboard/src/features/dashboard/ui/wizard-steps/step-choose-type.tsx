import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { cn } from "@packages/ui/lib/utils";
import {
	BarChart3,
	Layers,
	LineChart,
	PieChart,
	Scale,
	Table2,
	TrendingUp,
} from "lucide-react";

const INSIGHT_TYPES = [
	{
		value: "stat_card",
		label: "Stat Card",
		description: "Single metric with trend indicator. Great for KPIs.",
		icon: TrendingUp,
		color: "text-orange-500",
		bg: "bg-orange-500/10",
	},
	{
		value: "line",
		label: "Line Chart",
		description: "Track trends over time. Perfect for growth metrics.",
		icon: LineChart,
		color: "text-blue-500",
		bg: "bg-blue-500/10",
	},
	{
		value: "bar",
		label: "Bar Chart",
		description: "Compare categories side by side.",
		icon: BarChart3,
		color: "text-green-500",
		bg: "bg-green-500/10",
	},
	{
		value: "pie",
		label: "Pie Chart",
		description: "Show distribution as percentages.",
		icon: PieChart,
		color: "text-pink-500",
		bg: "bg-pink-500/10",
	},
	{
		value: "donut",
		label: "Donut Chart",
		description: "Distribution with center metric.",
		icon: PieChart,
		color: "text-violet-500",
		bg: "bg-violet-500/10",
	},
	{
		value: "table",
		label: "Table",
		description: "Detailed data view with sorting.",
		icon: Table2,
		color: "text-slate-500",
		bg: "bg-slate-500/10",
	},
	{
		value: "category_analysis",
		label: "Category Analysis",
		description: "Deep dive into category spending patterns.",
		icon: Layers,
		color: "text-amber-500",
		bg: "bg-amber-500/10",
	},
	{
		value: "comparison",
		label: "Comparison",
		description: "Side-by-side period analysis.",
		icon: Scale,
		color: "text-cyan-500",
		bg: "bg-cyan-500/10",
	},
] as const;

interface StepChooseTypeProps {
	value: InsightConfig["chartType"] | null;
	onChange: (type: InsightConfig["chartType"]) => void;
}

export function StepChooseType({ value, onChange }: StepChooseTypeProps) {
	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-medium">
					What type of insight do you want to create?
				</h3>
				<p className="text-sm text-muted-foreground mt-1">
					Choose how you want to visualize your data. You can change this later.
				</p>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
				{INSIGHT_TYPES.map((type) => {
					const Icon = type.icon;
					const isSelected = value === type.value;

					return (
						<button
							key={type.value}
							type="button"
							onClick={() =>
								onChange(type.value as InsightConfig["chartType"])
							}
							className={cn(
								"flex flex-col items-start gap-3 p-4 rounded-lg border-2 text-left transition-all",
								"hover:border-primary/50 hover:bg-accent/50",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								isSelected
									? "border-primary bg-primary/5"
									: "border-border",
							)}
						>
							<div className={cn("p-2 rounded-md", type.bg)}>
								<Icon className={cn("size-5", type.color)} />
							</div>
							<div>
								<p className="font-medium text-sm">{type.label}</p>
								<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
									{type.description}
								</p>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
