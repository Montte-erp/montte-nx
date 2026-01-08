import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import type { InsightConfig } from "@packages/database/schemas/dashboards";

type TimeGrouping = NonNullable<InsightConfig["timeGrouping"]>;

const GROUPING_OPTIONS: Array<{ value: TimeGrouping; label: string }> = [
	{ value: "day", label: "Day" },
	{ value: "week", label: "Week" },
	{ value: "month", label: "Month" },
	{ value: "quarter", label: "Quarter" },
	{ value: "year", label: "Year" },
];

type GroupingSectionProps = {
	value?: TimeGrouping;
	onChange: (grouping: TimeGrouping) => void;
};

export function GroupingSection({ value, onChange }: GroupingSectionProps) {
	return (
		<div className="space-y-3">
			<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
				Grouping
			</h4>
			<div className="flex flex-wrap gap-1.5">
				{GROUPING_OPTIONS.map((option) => (
					<Button
						key={option.value}
						variant="ghost"
						size="sm"
						className={cn(
							"h-8 px-3",
							value === option.value && "bg-accent text-accent-foreground",
						)}
						onClick={() => onChange(option.value)}
					>
						{option.label}
					</Button>
				))}
			</div>
		</div>
	);
}
