import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import GridLayout, { type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useTRPC } from "@/integrations/clients";
import type { WidgetPosition, InsightConfig } from "@packages/database/schemas/dashboards";
import { WidgetContainer } from "./widget-container";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";

type Widget = {
	id: string;
	dashboardId: string;
	type: "insight" | "text_card";
	name: string;
	position: WidgetPosition;
	config: unknown;
};

type DashboardGridProps = {
	dashboardId: string;
	widgets: Widget[];
	onRemoveWidget: (widgetId: string, widgetName: string) => void;
	onEditWidget: (widget: Widget) => void;
	onDrillDown?: (config: InsightConfig, context: DrillDownContext) => void;
};

export function DashboardGrid({
	dashboardId,
	widgets,
	onRemoveWidget,
	onEditWidget,
	onDrillDown,
}: DashboardGridProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const updatePositionsMutation = useMutation(
		trpc.dashboards.updateWidgetPositions.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: trpc.dashboards.getById.queryKey({ id: dashboardId }),
				});
			},
		}),
	);

	const layout: LayoutItem[] = useMemo(
		() =>
			widgets.map((widget) => ({
				i: widget.id,
				x: widget.position.x,
				y: widget.position.y,
				w: widget.position.w,
				h: widget.position.h,
				minW: widget.position.minW ?? 2,
				minH: widget.position.minH ?? 2,
			})),
		[widgets],
	);

	const handleLayoutChange = useCallback(
		(newLayout: Layout) => {
			// Check if layout actually changed
			const hasChanges = newLayout.some((item) => {
				const widget = widgets.find((w) => w.id === item.i);
				if (!widget) return false;
				return (
					widget.position.x !== item.x ||
					widget.position.y !== item.y ||
					widget.position.w !== item.w ||
					widget.position.h !== item.h
				);
			});

			if (hasChanges) {
				updatePositionsMutation.mutate({
					positions: newLayout.map((item) => ({
						widgetId: item.i,
						position: {
							x: item.x,
							y: item.y,
							w: item.w,
							h: item.h,
						},
					})),
				});
			}
		},
		[widgets, updatePositionsMutation],
	);

	return (
		<GridLayout
			className="layout"
			layout={layout}
			width={1200}
			onLayoutChange={handleLayoutChange}
			gridConfig={{
				cols: 12,
				rowHeight: 100,
				margin: [16, 16],
				containerPadding: [0, 0],
			}}
			dragConfig={{
				enabled: true,
				handle: ".drag-handle",
			}}
			resizeConfig={{
				enabled: true,
			}}
		>
			{widgets.map((widget) => (
				<div key={widget.id}>
					<WidgetContainer
						widget={widget}
						onRemove={() => onRemoveWidget(widget.id, widget.name)}
						onEdit={() => onEditWidget(widget)}
						onDrillDown={onDrillDown}
					/>
				</div>
			))}
		</GridLayout>
	);
}
