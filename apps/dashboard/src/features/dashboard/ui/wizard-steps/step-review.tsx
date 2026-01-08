import type { InsightConfig } from "@packages/database/schemas/dashboards";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@packages/ui/components/card";
import { Badge } from "@packages/ui/components/badge";
import { InsightWidget } from "../insight-widget";

interface StepReviewProps {
	config: InsightConfig;
	name: string;
}

const CHART_TYPE_LABELS: Record<string, string> = {
	stat_card: "Stat Card",
	line: "Line Chart",
	bar: "Bar Chart",
	pie: "Pie Chart",
	donut: "Donut Chart",
	table: "Table",
	category_analysis: "Category Analysis",
	comparison: "Comparison",
};

const DATA_SOURCE_LABELS: Record<string, string> = {
	transactions: "Transactions",
	bills: "Bills",
	budgets: "Budgets",
	bank_accounts: "Bank Accounts",
};

const AGGREGATION_LABELS: Record<string, string> = {
	sum: "Sum",
	count: "Count",
	average: "Average",
	min: "Minimum",
	max: "Maximum",
};

const TIME_GROUPING_LABELS: Record<string, string> = {
	day: "Daily",
	week: "Weekly",
	month: "Monthly",
	quarter: "Quarterly",
	year: "Yearly",
};

export function StepReview({ config, name }: StepReviewProps) {
	return (
		<div className="space-y-6">
			<div>
				<h3 className="text-lg font-medium">Review your insight</h3>
				<p className="text-sm text-muted-foreground mt-1">
					Here's a preview of your insight. Click "Create Insight" to add it to
					your dashboard.
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				{/* Configuration Summary */}
				<div className="space-y-4">
					<h4 className="text-sm font-medium">Configuration</h4>
					<div className="space-y-3">
						<div className="flex items-center justify-between py-2 border-b">
							<span className="text-sm text-muted-foreground">Name</span>
							<span className="text-sm font-medium">{name}</span>
						</div>
						<div className="flex items-center justify-between py-2 border-b">
							<span className="text-sm text-muted-foreground">Chart Type</span>
							<Badge variant="secondary">
								{CHART_TYPE_LABELS[config.chartType] ?? config.chartType}
							</Badge>
						</div>
						<div className="flex items-center justify-between py-2 border-b">
							<span className="text-sm text-muted-foreground">Data Source</span>
							<span className="text-sm">
								{DATA_SOURCE_LABELS[config.dataSource] ?? config.dataSource}
							</span>
						</div>
						<div className="flex items-center justify-between py-2 border-b">
							<span className="text-sm text-muted-foreground">Metric</span>
							<span className="text-sm">
								{AGGREGATION_LABELS[config.aggregation] ?? config.aggregation}{" "}
								of {config.aggregateField}
							</span>
						</div>
						{config.timeGrouping && (
							<div className="flex items-center justify-between py-2 border-b">
								<span className="text-sm text-muted-foreground">
									Time Grouping
								</span>
								<span className="text-sm">
									{TIME_GROUPING_LABELS[config.timeGrouping] ??
										config.timeGrouping}
								</span>
							</div>
						)}
						{config.breakdown && (
							<div className="flex items-center justify-between py-2 border-b">
								<span className="text-sm text-muted-foreground">Breakdown</span>
								<span className="text-sm capitalize">
									{config.breakdown.field}
								</span>
							</div>
						)}
						{config.comparison && (
							<div className="flex items-center justify-between py-2 border-b">
								<span className="text-sm text-muted-foreground">
									Comparison
								</span>
								<span className="text-sm">
									{config.comparison.type === "previous_period"
										? "Previous Period"
										: "Previous Year"}
								</span>
							</div>
						)}
						{config.filters && config.filters.length > 0 && (
							<div className="flex items-center justify-between py-2 border-b">
								<span className="text-sm text-muted-foreground">Filters</span>
								<Badge variant="outline">{config.filters.length} applied</Badge>
							</div>
						)}
					</div>
				</div>

				{/* Live Preview */}
				<div className="space-y-4">
					<h4 className="text-sm font-medium">Preview</h4>
					<Card className="h-[300px]">
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-sm font-medium">{name}</CardTitle>
						</CardHeader>
						<CardContent className="h-[calc(100%-52px)]">
							<InsightWidget widgetId="preview" config={config} />
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
