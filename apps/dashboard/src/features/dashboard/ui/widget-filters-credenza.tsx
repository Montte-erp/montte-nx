import { translate } from "@packages/localization";
import { Button } from "@packages/ui/components/button";
import {
	CredenzaBody,
	CredenzaDescription,
	CredenzaFooter,
	CredenzaHeader,
	CredenzaTitle,
} from "@packages/ui/components/credenza";
import { FieldLabel } from "@packages/ui/components/field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";
import { ToggleGroup, ToggleGroupItem } from "@packages/ui/components/toggle-group";
import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { ArrowLeftRight, Calendar, CalendarCheck, Check, Filter, Layers, RotateCcw, TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { useCredenza } from "@/hooks/use-credenza";
import { cn } from "@packages/ui/lib/utils";

type RelativePeriod = NonNullable<InsightConfig["dateRangeOverride"]>["relativePeriod"];
type TimeGrouping = NonNullable<InsightConfig["timeGrouping"]>;
type ComparisonType = NonNullable<InsightConfig["comparison"]>["type"] | "none";

const DATE_RANGE_OPTIONS = [
	{ value: "last_7_days", label: translate("dashboard.widgets.filters.date-range.last-7-days") },
	{ value: "last_30_days", label: translate("dashboard.widgets.filters.date-range.last-30-days") },
	{ value: "last_90_days", label: translate("dashboard.widgets.filters.date-range.last-90-days") },
	{ value: "this_month", label: translate("dashboard.widgets.filters.date-range.this-month") },
	{ value: "last_month", label: translate("dashboard.widgets.filters.date-range.last-month") },
	{ value: "this_quarter", label: translate("dashboard.widgets.filters.date-range.this-quarter") },
	{ value: "this_year", label: translate("dashboard.widgets.filters.date-range.this-year") },
	{ value: "last_year", label: translate("dashboard.widgets.filters.date-range.last-year") },
] as const;

const GROUPING_OPTIONS: Array<{ value: TimeGrouping; label: string }> = [
	{ value: "day", label: translate("dashboard.widgets.filters.grouped-by.day") },
	{ value: "week", label: translate("dashboard.widgets.filters.grouped-by.week") },
	{ value: "month", label: translate("dashboard.widgets.filters.grouped-by.month") },
	{ value: "quarter", label: translate("dashboard.widgets.filters.grouped-by.quarter") },
	{ value: "year", label: translate("dashboard.widgets.filters.grouped-by.year") },
];

type WidgetFiltersCredenzaProps = {
	config: InsightConfig;
	onApply: (updates: Partial<InsightConfig>) => void;
};

export function WidgetFiltersCredenza({
	config,
	onApply,
}: WidgetFiltersCredenzaProps) {
	const { closeCredenza } = useCredenza();

	const [dateRange, setDateRange] = useState<RelativePeriod>(
		config.dateRangeOverride?.relativePeriod ?? "last_30_days",
	);
	const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>(
		config.timeGrouping ?? "month",
	);
	const [comparison, setComparison] = useState<ComparisonType>(
		config.comparison?.type ?? "none",
	);

	const hasChanges =
		dateRange !== (config.dateRangeOverride?.relativePeriod ?? "last_30_days") ||
		timeGrouping !== (config.timeGrouping ?? "month") ||
		comparison !== (config.comparison?.type ?? "none");

	const handleApply = () => {
		onApply({
			dateRangeOverride: {
				relativePeriod: dateRange,
			},
			timeGrouping,
			comparison: comparison === "none" ? undefined : { type: comparison },
		});
		closeCredenza();
	};

	const handleClearFilters = () => {
		setDateRange("last_30_days");
		setTimeGrouping("month");
		setComparison("none");
	};

	const handleCancel = () => {
		closeCredenza();
	};

	return (
		<>
			<CredenzaHeader>
				<CredenzaTitle className="flex items-center gap-2">
					<Filter className="h-5 w-5" />
					{translate("dashboard.widgets.filters.title")}
				</CredenzaTitle>
				<CredenzaDescription>
					{translate("dashboard.widgets.filters.description")}
				</CredenzaDescription>
			</CredenzaHeader>
			<CredenzaBody className="max-h-[60vh] overflow-y-auto">
				<div className="space-y-6">
					{hasChanges && (
						<Button
							className="w-full flex items-center justify-center gap-2"
							onClick={handleClearFilters}
							variant="outline"
						>
							<RotateCcw className="size-4" />
							{translate("dashboard.widgets.filters.clear")}
						</Button>
					)}

					{/* Date Range */}
					<section className="space-y-3">
						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4 text-muted-foreground" />
							<FieldLabel className="text-sm font-medium m-0">
								{translate("dashboard.widgets.filters.date-range.title")}
							</FieldLabel>
						</div>
						<Select
							value={dateRange}
							onValueChange={(value) => setDateRange(value as RelativePeriod)}
						>
							<SelectTrigger className="w-full h-11">
								<SelectValue
									placeholder={translate("dashboard.widgets.filters.date-range.placeholder")}
								/>
							</SelectTrigger>
							<SelectContent>
								{DATE_RANGE_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value} className="py-2.5">
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</section>

					{/* Grouped By */}
					<section className="space-y-3">
						<div className="flex items-center gap-2">
							<Layers className="h-4 w-4 text-muted-foreground" />
							<FieldLabel className="text-sm font-medium m-0">
								{translate("dashboard.widgets.filters.grouped-by.title")}
							</FieldLabel>
						</div>
						<ToggleGroup
							type="single"
							value={timeGrouping}
							onValueChange={(value) => value && setTimeGrouping(value as TimeGrouping)}
							variant="outline"
							className="flex flex-wrap gap-2"
						>
							{GROUPING_OPTIONS.map((option) => (
								<ToggleGroupItem
									key={option.value}
									value={option.value}
									className={cn(
										"px-4 py-2 rounded-full border transition-all",
										timeGrouping === option.value && "bg-primary text-primary-foreground border-primary"
									)}
								>
									{option.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</section>

					{/* Comparison */}
					<section className="space-y-3">
						<div className="flex items-center gap-2">
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
							<FieldLabel className="text-sm font-medium m-0">
								{translate("dashboard.widgets.filters.comparison.title")}
							</FieldLabel>
						</div>
						<div className="space-y-2">
							<ComparisonOption
								value="none"
								label={translate("dashboard.widgets.filters.comparison.none")}
								icon={X}
								isSelected={comparison === "none"}
								onClick={() => setComparison("none")}
							/>
							<ComparisonOption
								value="previous_period"
								label={translate("dashboard.widgets.filters.comparison.previous-period")}
								icon={ArrowLeftRight}
								isSelected={comparison === "previous_period"}
								onClick={() => setComparison("previous_period")}
							/>
							<ComparisonOption
								value="previous_year"
								label={translate("dashboard.widgets.filters.comparison.previous-year")}
								icon={CalendarCheck}
								isSelected={comparison === "previous_year"}
								onClick={() => setComparison("previous_year")}
							/>
						</div>
					</section>
				</div>
			</CredenzaBody>
			<CredenzaFooter>
				<Button variant="outline" onClick={handleCancel}>
					{translate("common.actions.cancel")}
				</Button>
				<Button onClick={handleApply}>
					{translate("common.actions.apply")}
				</Button>
			</CredenzaFooter>
		</>
	);
}

type ComparisonOptionProps = {
	value: string;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	isSelected: boolean;
	onClick: () => void;
};

function ComparisonOption({ label, icon: Icon, isSelected, onClick }: ComparisonOptionProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
				isSelected
					? "border-primary bg-primary/5"
					: "border-border hover:border-muted-foreground/50 hover:bg-muted/30"
			)}
		>
			<div className={cn(
				"h-8 w-8 rounded-full flex items-center justify-center transition-colors",
				isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
			)}>
				<Icon className="h-4 w-4" />
			</div>
			<span className="text-sm font-medium flex-1 text-left">{label}</span>
			{isSelected && (
				<Check className="h-4 w-4 text-primary" />
			)}
		</button>
	);
}
