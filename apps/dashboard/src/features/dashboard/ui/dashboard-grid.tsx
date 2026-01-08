import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useEffect, useState } from "react";
import GridLayout, { type Layout, type LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useTRPC } from "@/integrations/clients";
import type { WidgetPosition, InsightConfig } from "@packages/database/schemas/dashboards";
import { WidgetContainer } from "./widget-container";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";

// Breakpoint for mobile (matches Tailwind md: breakpoint)
const MOBILE_BREAKPOINT = 768;

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
	onUpdateWidgetConfig: (widgetId: string, updates: Partial<InsightConfig>) => void;
	onUpdateWidgetName: (widgetId: string, name: string) => void;
	onUpdateWidgetDescription: (widgetId: string, description: string | null) => void;
	onToggleWidgetWidth: (widgetId: string, newWidth: 1 | 2) => void;
	onDrillDown?: (config: InsightConfig, context: DrillDownContext) => void;
};

export function DashboardGrid({
	dashboardId,
	widgets,
	onRemoveWidget,
	onUpdateWidgetConfig,
	onUpdateWidgetName,
	onUpdateWidgetDescription,
	onToggleWidgetWidth,
	onDrillDown,
}: DashboardGridProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(1200);

	// Detect mobile based on container width
	const isMobile = containerWidth < MOBILE_BREAKPOINT;

	// Measure container width for responsive grid
	useEffect(() => {
		const updateWidth = () => {
			if (containerRef.current) {
				setContainerWidth(containerRef.current.offsetWidth);
			}
		};

		updateWidth();
		window.addEventListener("resize", updateWidth);
		return () => window.removeEventListener("resize", updateWidth);
	}, []);

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
				x: isMobile ? 0 : Math.min(widget.position.x, 1), // On mobile, always x=0
				y: widget.position.y,
				w: isMobile ? 2 : Math.min(Math.max(widget.position.w, 1), 2), // On mobile, always full width (2)
				h: widget.position.h,
				minW: isMobile ? 2 : 1, // On mobile, lock to full width
				maxW: 2,
				minH: widget.position.minH ?? 2,
			})),
		[widgets, isMobile],
	);

	const handleLayoutChange = useCallback(
		(newLayout: Layout) => {
			// Don't save position changes on mobile since they're forced
			if (isMobile) return;

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
		[widgets, updatePositionsMutation, isMobile],
	);

	return (
		<div ref={containerRef}>
			<GridLayout
				className="layout"
				layout={layout}
				width={containerWidth}
				onLayoutChange={handleLayoutChange}
				gridConfig={{
					cols: isMobile ? 1 : 2, // Single column on mobile
					rowHeight: 100,
					margin: isMobile ? [12, 12] : [16, 16],
					containerPadding: [0, 0],
				}}
				dragConfig={{
					enabled: !isMobile, // Disable drag on mobile
					handle: ".drag-handle",
				}}
				resizeConfig={{
					enabled: !isMobile, // Disable resize on mobile
				}}
			>
				{widgets.map((widget) => (
					<div key={widget.id}>
						<WidgetContainer
							widget={widget}
							onRemove={() => onRemoveWidget(widget.id, widget.name)}
							onUpdateConfig={(updates) => onUpdateWidgetConfig(widget.id, updates)}
							onUpdateName={(name) => onUpdateWidgetName(widget.id, name)}
							onUpdateDescription={(description) => onUpdateWidgetDescription(widget.id, description)}
							onToggleWidth={(newWidth) => onToggleWidgetWidth(widget.id, newWidth)}
							onDrillDown={onDrillDown}
						/>
					</div>
				))}
			</GridLayout>
		</div>
	);
}
