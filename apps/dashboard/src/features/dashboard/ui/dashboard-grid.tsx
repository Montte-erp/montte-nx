import type {
	WidgetPosition,
	InsightConfig,
} from "@packages/database/schemas/dashboards";
import { cn } from "@packages/ui/lib/utils";
import { WidgetContainer } from "./widget-container";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";

type Widget = {
	id: string;
	dashboardId: string;
	type: "insight" | "text_card";
	name: string;
	description: string | null;
	position: WidgetPosition;
	config: unknown;
};

type DashboardGridProps = {
	dashboardId: string;
	widgets: Widget[];
	onRemoveWidget: (widgetId: string, widgetName: string) => void;
	onUpdateWidgetConfig: (
		widgetId: string,
		updates: Partial<InsightConfig>,
	) => void;
	onUpdateWidgetName: (widgetId: string, name: string) => void;
	onUpdateWidgetDescription: (
		widgetId: string,
		description: string | null,
	) => void;
	onChangeWidgetWidth: (widgetId: string, newWidth: number) => void;
	onDrillDown?: (config: InsightConfig, context: DrillDownContext) => void;
};

const getColSpanClass = (width: number) => {
	const colSpanMap: Record<number, string> = {
		1: "md:col-span-1",
		2: "md:col-span-2",
		3: "md:col-span-3",
		4: "md:col-span-4",
		5: "md:col-span-5",
		6: "md:col-span-6",
	};
	return colSpanMap[width] || "md:col-span-3";
};

export function DashboardGrid({
	widgets,
	onRemoveWidget,
	onUpdateWidgetConfig,
	onUpdateWidgetName,
	onUpdateWidgetDescription,
	onChangeWidgetWidth,
	onDrillDown,
}: DashboardGridProps) {
	// Sort widgets by y position for consistent ordering
	const sortedWidgets = [...widgets].sort((a, b) => a.position.y - b.position.y);

	return (
		<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
			{sortedWidgets.map((widget) => (
				<div
					key={widget.id}
					className={cn("col-span-1", getColSpanClass(widget.position.w))}
				>
					<WidgetContainer
						widget={widget}
						onRemove={() => onRemoveWidget(widget.id, widget.name)}
						onUpdateConfig={(updates) =>
							onUpdateWidgetConfig(widget.id, updates)
						}
						onUpdateName={(name) =>
							onUpdateWidgetName(widget.id, name)
						}
						onUpdateDescription={(description) =>
							onUpdateWidgetDescription(widget.id, description)
						}
						onChangeWidth={(newWidth) =>
							onChangeWidgetWidth(widget.id, newWidth)
						}
						onDrillDown={onDrillDown}
					/>
				</div>
			))}
		</div>
	);
}
