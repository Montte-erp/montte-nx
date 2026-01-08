import type { InsightConfig } from "@packages/database/schemas/dashboards";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { HelpCircle } from "lucide-react";

const DATA_SOURCE_FIELDS: Record<
	string,
	Array<{ value: string; label: string }>
> = {
	transactions: [
		{ value: "amount", label: "Amount" },
		{ value: "date", label: "Date" },
	],
	bills: [
		{ value: "amount", label: "Amount" },
		{ value: "dueDate", label: "Due Date" },
	],
	budgets: [
		{ value: "amount", label: "Budget Amount" },
		{ value: "spent", label: "Spent Amount" },
		{ value: "remaining", label: "Remaining" },
	],
	bank_accounts: [{ value: "balance", label: "Balance" }],
};

const AGGREGATIONS = [
	{ value: "sum", label: "Sum", description: "Add up all values" },
	{ value: "count", label: "Count", description: "Count the number of items" },
	{ value: "average", label: "Average", description: "Calculate the average" },
	{ value: "min", label: "Minimum", description: "Find the smallest value" },
	{ value: "max", label: "Maximum", description: "Find the largest value" },
] as const;

interface StepConfigureMetricsProps {
	dataSource: InsightConfig["dataSource"];
	aggregation: InsightConfig["aggregation"];
	aggregateField: string;
	onAggregationChange: (agg: InsightConfig["aggregation"]) => void;
	onFieldChange: (field: string) => void;
}

export function StepConfigureMetrics({
	dataSource,
	aggregation,
	aggregateField,
	onAggregationChange,
	onFieldChange,
}: StepConfigureMetricsProps) {
	const fields = DATA_SOURCE_FIELDS[dataSource] ?? [];
	const selectedAgg = AGGREGATIONS.find((a) => a.value === aggregation);
	const selectedField = fields.find((f) => f.value === aggregateField);

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-medium">What do you want to measure?</h3>
				<p className="text-sm text-muted-foreground mt-1">
					Define how to calculate your metric. For example, "Sum of Amount"
					gives total spending.
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				<div className="space-y-2">
					<label className="text-sm font-medium flex items-center gap-2">
						Calculation type
						<Tooltip>
							<TooltipTrigger asChild>
								<HelpCircle className="size-4 text-muted-foreground cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs">
								How to aggregate the selected field. Sum adds up values, Count
								counts items, etc.
							</TooltipContent>
						</Tooltip>
					</label>
					<Select
						value={aggregation}
						onValueChange={(v) =>
							onAggregationChange(v as InsightConfig["aggregation"])
						}
					>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{AGGREGATIONS.map((agg) => (
								<SelectItem key={agg.value} value={agg.value}>
									{agg.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{selectedAgg && (
						<p className="text-xs text-muted-foreground">
							{selectedAgg.description}
						</p>
					)}
				</div>

				<div className="space-y-2">
					<label className="text-sm font-medium flex items-center gap-2">
						Field to calculate
						<Tooltip>
							<TooltipTrigger asChild>
								<HelpCircle className="size-4 text-muted-foreground cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs">
								The data field to apply the calculation to.
							</TooltipContent>
						</Tooltip>
					</label>
					<Select value={aggregateField} onValueChange={onFieldChange}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{fields.map((field) => (
								<SelectItem key={field.value} value={field.value}>
									{field.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* Preview summary */}
			<div className="p-4 rounded-lg bg-muted/50 border">
				<p className="text-sm">
					Your metric:{" "}
					<span className="font-medium">
						{selectedAgg?.label} of {selectedField?.label ?? aggregateField}
					</span>
				</p>
			</div>
		</div>
	);
}
