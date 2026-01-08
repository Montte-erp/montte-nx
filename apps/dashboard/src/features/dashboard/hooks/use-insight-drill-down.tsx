import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { useSheet } from "@/hooks/use-sheet";
import { InsightBuilderWizard } from "../ui/insight-builder-wizard";

export type DrillDownContext = {
	dimension: string;
	value: string;
	label: string;
};

export function createDrillDownConfig(
	currentConfig: InsightConfig,
	context: DrillDownContext,
): InsightConfig {
	// Create a new config with the filter applied
	const newFilters = [
		...currentConfig.filters,
		{
			field: context.dimension,
			operator: "equals" as const,
			value: context.value,
		},
	];

	// Determine the best chart type for drill-down
	let chartType: InsightConfig["chartType"] = "line";
	if (currentConfig.timeGrouping) {
		chartType = "line"; // Show trends over time
	} else {
		chartType = "bar"; // Show breakdown
	}

	return {
		...currentConfig,
		filters: newFilters,
		// For drill-down, prefer time series or breakdown view
		chartType,
		timeGrouping: currentConfig.timeGrouping || "month",
		// Remove the breakdown that was just drilled into
		breakdown: undefined,
	};
}

export function useInsightDrillDown(dashboardId?: string) {
	const { openSheet, closeSheet } = useSheet();

	const drillDown = (
		currentConfig: InsightConfig,
		context: DrillDownContext,
	) => {
		const drillDownConfig = createDrillDownConfig(currentConfig, context);

		if (dashboardId) {
			// Open InsightBuilderWizard with the drilled-down config as initial state
			openSheet({
				children: (
					<InsightBuilderWizard
						dashboardId={dashboardId}
						initialChartType={drillDownConfig.chartType}
						onSuccess={closeSheet}
						onCancel={closeSheet}
					/>
				),
			});
		}

		return drillDownConfig;
	};

	return { drillDown };
}
