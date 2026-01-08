import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@packages/ui/components/select";

const DATE_RANGE_OPTIONS = [
	{ value: "last_7_days", label: "Last 7 days" },
	{ value: "last_30_days", label: "Last 30 days" },
	{ value: "last_90_days", label: "Last 90 days" },
	{ value: "this_month", label: "This month" },
	{ value: "last_month", label: "Last month" },
	{ value: "this_quarter", label: "This quarter" },
	{ value: "this_year", label: "This year" },
	{ value: "last_year", label: "Last year" },
] as const;

type RelativePeriod = (typeof DATE_RANGE_OPTIONS)[number]["value"];

type DateRangeSectionProps = {
	value?: RelativePeriod;
	onChange: (relativePeriod: RelativePeriod) => void;
};

export function DateRangeSection({ value, onChange }: DateRangeSectionProps) {
	return (
		<div className="space-y-3">
			<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
				Date Range
			</h4>
			<Select value={value || "last_30_days"} onValueChange={onChange}>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Select date range" />
				</SelectTrigger>
				<SelectContent>
					{DATE_RANGE_OPTIONS.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
