import { Checkbox } from "@packages/ui/components/checkbox";
import { Label } from "@packages/ui/components/label";
import type { InsightConfig } from "@packages/database/schemas/dashboards";

type ComparisonType = NonNullable<InsightConfig["comparison"]>["type"];

type ComparisonSectionProps = {
	value?: ComparisonType;
	onChange: (comparison: InsightConfig["comparison"]) => void;
};

export function ComparisonSection({ value, onChange }: ComparisonSectionProps) {
	const handleChange = (type: ComparisonType, checked: boolean) => {
		if (checked) {
			onChange({ type });
		} else if (value === type) {
			onChange(undefined);
		}
	};

	return (
		<div className="space-y-3">
			<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
				Comparison
			</h4>
			<div className="space-y-3">
				<div className="flex items-center space-x-2">
					<Checkbox
						id="previousPeriod"
						checked={value === "previous_period"}
						onCheckedChange={(checked) =>
							handleChange("previous_period", checked === true)
						}
					/>
					<Label
						htmlFor="previousPeriod"
						className="text-sm font-normal cursor-pointer"
					>
						Compare to previous period
					</Label>
				</div>
				<div className="flex items-center space-x-2">
					<Checkbox
						id="previousYear"
						checked={value === "previous_year"}
						onCheckedChange={(checked) =>
							handleChange("previous_year", checked === true)
						}
					/>
					<Label
						htmlFor="previousYear"
						className="text-sm font-normal cursor-pointer"
					>
						Compare to same period last year
					</Label>
				</div>
			</div>
		</div>
	);
}
