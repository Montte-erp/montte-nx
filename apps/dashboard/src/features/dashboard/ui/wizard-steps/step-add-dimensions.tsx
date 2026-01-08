import type {
	InsightConfig,
	InsightBreakdown,
} from "@packages/database/schemas/dashboards";
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

const TIME_GROUPINGS = [
	{ value: "day", label: "Daily", description: "Group data by day" },
	{ value: "week", label: "Weekly", description: "Group data by week" },
	{ value: "month", label: "Monthly", description: "Group data by month" },
	{ value: "quarter", label: "Quarterly", description: "Group data by quarter" },
	{ value: "year", label: "Yearly", description: "Group data by year" },
] as const;

const BREAKDOWN_FIELDS: Record<
	string,
	Array<{ value: string; label: string; description: string }>
> = {
	transactions: [
		{
			value: "category",
			label: "Category",
			description: "Break down by transaction category",
		},
		{
			value: "bankAccount",
			label: "Bank Account",
			description: "Break down by bank account",
		},
		{
			value: "type",
			label: "Type (Income/Expense)",
			description: "Separate income from expenses",
		},
		{ value: "tag", label: "Tag", description: "Break down by tags" },
	],
	bills: [
		{
			value: "status",
			label: "Status",
			description: "Group by bill status (paid, pending, etc.)",
		},
		{
			value: "category",
			label: "Category",
			description: "Break down by bill category",
		},
		{
			value: "bankAccount",
			label: "Bank Account",
			description: "Break down by bank account",
		},
	],
	budgets: [
		{
			value: "category",
			label: "Category",
			description: "Break down by budget category",
		},
		{
			value: "period",
			label: "Period",
			description: "Group by budget period",
		},
	],
	bank_accounts: [
		{
			value: "type",
			label: "Account Type",
			description: "Group by account type (checking, savings, etc.)",
		},
	],
};

const COMPARISON_OPTIONS = [
	{
		value: "previous_period",
		label: "Previous Period",
		description: "Compare to the same length period before",
	},
	{
		value: "previous_year",
		label: "Previous Year",
		description: "Compare to the same period last year",
	},
] as const;

interface StepAddDimensionsProps {
	dataSource: InsightConfig["dataSource"];
	timeGrouping: InsightConfig["timeGrouping"];
	breakdown: InsightBreakdown | undefined;
	comparison: InsightConfig["comparison"];
	onTimeGroupingChange: (tg: InsightConfig["timeGrouping"]) => void;
	onBreakdownChange: (bd: InsightBreakdown | undefined) => void;
	onComparisonChange: (cmp: InsightConfig["comparison"]) => void;
}

export function StepAddDimensions({
	dataSource,
	timeGrouping,
	breakdown,
	comparison,
	onTimeGroupingChange,
	onBreakdownChange,
	onComparisonChange,
}: StepAddDimensionsProps) {
	const breakdownFields = BREAKDOWN_FIELDS[dataSource] ?? [];

	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-medium">
					Add dimensions to your insight
				</h3>
				<p className="text-sm text-muted-foreground mt-1">
					These settings are optional. They help you slice and compare your
					data.
				</p>
			</div>

			<div className="grid gap-6">
				{/* Time Grouping */}
				<div className="space-y-2">
					<label className="text-sm font-medium flex items-center gap-2">
						Time Grouping
						<Tooltip>
							<TooltipTrigger asChild>
								<HelpCircle className="size-4 text-muted-foreground cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs">
								How to group your data over time. Required for line charts to
								show trends.
							</TooltipContent>
						</Tooltip>
						<span className="text-xs text-muted-foreground font-normal">
							(optional)
						</span>
					</label>
					<Select
						value={timeGrouping ?? "none"}
						onValueChange={(value) =>
							onTimeGroupingChange(
								value === "none"
									? undefined
									: (value as InsightConfig["timeGrouping"]),
							)
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="No time grouping" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">No time grouping</SelectItem>
							{TIME_GROUPINGS.map((tg) => (
								<SelectItem key={tg.value} value={tg.value}>
									{tg.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{timeGrouping && (
						<p className="text-xs text-muted-foreground">
							{
								TIME_GROUPINGS.find((t) => t.value === timeGrouping)
									?.description
							}
						</p>
					)}
				</div>

				{/* Breakdown */}
				<div className="space-y-2">
					<label className="text-sm font-medium flex items-center gap-2">
						Breakdown by
						<Tooltip>
							<TooltipTrigger asChild>
								<HelpCircle className="size-4 text-muted-foreground cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs">
								Split your data by a dimension to see how it varies across
								categories, accounts, etc.
							</TooltipContent>
						</Tooltip>
						<span className="text-xs text-muted-foreground font-normal">
							(optional)
						</span>
					</label>
					<Select
						value={breakdown?.field ?? "none"}
						onValueChange={(value) =>
							onBreakdownChange(
								value === "none" ? undefined : { field: value, limit: 10 },
							)
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="No breakdown" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">No breakdown</SelectItem>
							{breakdownFields.map((bf) => (
								<SelectItem key={bf.value} value={bf.value}>
									{bf.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{breakdown?.field && (
						<p className="text-xs text-muted-foreground">
							{
								breakdownFields.find((b) => b.value === breakdown.field)
									?.description
							}
						</p>
					)}
				</div>

				{/* Comparison */}
				<div className="space-y-2">
					<label className="text-sm font-medium flex items-center gap-2">
						Compare to
						<Tooltip>
							<TooltipTrigger asChild>
								<HelpCircle className="size-4 text-muted-foreground cursor-help" />
							</TooltipTrigger>
							<TooltipContent className="max-w-xs">
								Add a comparison to see how your current data compares to a
								previous period.
							</TooltipContent>
						</Tooltip>
						<span className="text-xs text-muted-foreground font-normal">
							(optional)
						</span>
					</label>
					<Select
						value={comparison?.type ?? "none"}
						onValueChange={(value) =>
							onComparisonChange(
								value === "none"
									? undefined
									: { type: value as "previous_period" | "previous_year" },
							)
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="No comparison" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">No comparison</SelectItem>
							{COMPARISON_OPTIONS.map((opt) => (
								<SelectItem key={opt.value} value={opt.value}>
									{opt.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{comparison?.type && (
						<p className="text-xs text-muted-foreground">
							{
								COMPARISON_OPTIONS.find((c) => c.value === comparison.type)
									?.description
							}
						</p>
					)}
				</div>
			</div>
		</div>
	);
}
