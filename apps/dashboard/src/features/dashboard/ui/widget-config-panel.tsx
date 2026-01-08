import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Separator } from "@packages/ui/components/separator";
import { cn } from "@packages/ui/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";
import {
	useWidgetConfigPanel,
	closeWidgetConfigPanel,
} from "../hooks/use-widget-config-panel";
import { ChartTypeSelectorSection } from "./config-sections/chart-type-selector-section";
import { DisplayOptionsSection } from "./config-sections/display-options-section";
import { DateRangeSection } from "./config-sections/date-range-section";
import { GroupingSection } from "./config-sections/grouping-section";
import { ComparisonSection } from "./config-sections/comparison-section";
import type { InsightConfig } from "@packages/database/schemas/dashboards";

export function WidgetConfigPanel() {
	const {
		isOpen,
		widgetId,
		dashboardId,
		widgetName,
		effectiveConfig,
		hasPendingChanges,
		updateConfig,
		updateName,
		resetChanges,
	} = useWidgetConfigPanel();

	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const updateWidgetMutation = useMutation(
		trpc.dashboards.updateWidget.mutationOptions({
			onSuccess: () => {
				toast.success("Widget updated");
				queryClient.invalidateQueries({
					queryKey: [["dashboards", "getById"]],
				});
				closeWidgetConfigPanel();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to update widget");
			},
		}),
	);

	const handleSave = () => {
		if (!widgetId || !dashboardId || !effectiveConfig) return;

		updateWidgetMutation.mutate({
			widgetId,
			name: widgetName,
			config: effectiveConfig,
		});
	};

	const handleCancel = () => {
		resetChanges();
		closeWidgetConfigPanel();
	};

	if (!isOpen || !effectiveConfig) return null;

	return (
		<div
			className={cn(
				"fixed right-0 top-12 bottom-0 w-80 bg-background border-l shadow-lg z-50",
				"transform transition-transform duration-200 ease-in-out",
				isOpen ? "translate-x-0" : "translate-x-full",
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex-1 min-w-0">
					<Input
						value={widgetName}
						onChange={(e) => updateName(e.target.value)}
						className="font-medium border-none shadow-none px-0 h-auto focus-visible:ring-0"
						placeholder="Widget name"
					/>
				</div>
				<Button variant="ghost" size="icon" onClick={handleCancel}>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Content */}
			<div className="overflow-y-auto h-[calc(100%-8rem)] p-4 space-y-6">
				<ChartTypeSelectorSection
					value={effectiveConfig.chartType}
					onChange={(chartType) => updateConfig({ chartType })}
				/>

				<Separator />

				<DisplayOptionsSection
					showLegend={effectiveConfig.showLegend}
					showLabels={effectiveConfig.showLabels}
					showTrendLine={(effectiveConfig as { showTrendLine?: boolean }).showTrendLine}
					onChange={updateConfig}
				/>

				<Separator />

				<DateRangeSection
					value={(effectiveConfig as { dateRangeOverride?: { relativePeriod?: string } }).dateRangeOverride?.relativePeriod as Parameters<typeof DateRangeSection>[0]["value"]}
					onChange={(relativePeriod) =>
						updateConfig({
							dateRangeOverride: { relativePeriod },
						} as Partial<InsightConfig>)
					}
				/>

				<Separator />

				<GroupingSection
					value={effectiveConfig.timeGrouping}
					onChange={(timeGrouping) => updateConfig({ timeGrouping })}
				/>

				<Separator />

				<ComparisonSection
					value={effectiveConfig.comparison?.type}
					onChange={(comparison) => updateConfig({ comparison })}
				/>
			</div>

			{/* Footer */}
			<div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
				<div className="flex gap-2">
					<Button
						variant="outline"
						className="flex-1"
						onClick={handleCancel}
					>
						Cancel
					</Button>
					<Button
						className="flex-1"
						onClick={handleSave}
						disabled={!hasPendingChanges && widgetName === widgetName}
					>
						Apply Changes
					</Button>
				</div>
			</div>
		</div>
	);
}
