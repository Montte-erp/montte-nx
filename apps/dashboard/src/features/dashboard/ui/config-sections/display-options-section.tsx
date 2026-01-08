import { Checkbox } from "@packages/ui/components/checkbox";
import { Label } from "@packages/ui/components/label";
import type { InsightConfig } from "@packages/database/schemas/dashboards";

type DisplayOptionsProps = {
	showLegend?: boolean;
	showLabels?: boolean;
	showTrendLine?: boolean;
	onChange: (updates: Partial<InsightConfig>) => void;
};

export function DisplayOptionsSection({
	showLegend = true,
	showLabels = false,
	showTrendLine = false,
	onChange,
}: DisplayOptionsProps) {
	return (
		<div className="space-y-3">
			<h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
				Display
			</h4>
			<div className="space-y-3">
				<div className="flex items-center space-x-2">
					<Checkbox
						id="showLabels"
						checked={showLabels}
						onCheckedChange={(checked) =>
							onChange({ showLabels: checked === true })
						}
					/>
					<Label
						htmlFor="showLabels"
						className="text-sm font-normal cursor-pointer"
					>
						Show values on chart
					</Label>
				</div>
				<div className="flex items-center space-x-2">
					<Checkbox
						id="showLegend"
						checked={showLegend}
						onCheckedChange={(checked) =>
							onChange({ showLegend: checked === true })
						}
					/>
					<Label
						htmlFor="showLegend"
						className="text-sm font-normal cursor-pointer"
					>
						Show legend
					</Label>
				</div>
				<div className="flex items-center space-x-2">
					<Checkbox
						id="showTrendLine"
						checked={showTrendLine}
						onCheckedChange={(checked) =>
							onChange({ showTrendLine: checked === true })
						}
					/>
					<Label
						htmlFor="showTrendLine"
						className="text-sm font-normal cursor-pointer"
					>
						Show trend line
					</Label>
				</div>
			</div>
		</div>
	);
}
