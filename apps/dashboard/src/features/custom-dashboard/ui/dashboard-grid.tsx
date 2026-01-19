import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { cn } from "@packages/ui/lib/utils";
import type { DrillDownContext } from "../hooks/use-insight-drill-down";
import { getColSpanClass, type Widget } from "../hooks/use-widget";
import { WidgetContainer } from "./widget-container";

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
   onDrillDown?: (
      widgetId: string,
      config: InsightConfig,
      context: DrillDownContext,
   ) => void;
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
   const sortedWidgets = [...widgets].sort(
      (a, b) => a.position.y - b.position.y,
   );

   return (
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
         {sortedWidgets.map((widget) => (
            <div
               className={cn(
                  "col-span-1",
                  widget.type !== "text_card" && "h-[400px]",
                  getColSpanClass(widget.position.w),
               )}
               key={widget.id}
            >
               <WidgetContainer
                  onChangeWidth={(newWidth) =>
                     onChangeWidgetWidth(widget.id, newWidth)
                  }
                  onDrillDown={
                     onDrillDown
                        ? (config, context) =>
                             onDrillDown(widget.id, config, context)
                        : undefined
                  }
                  onRemove={() => onRemoveWidget(widget.id, widget.name)}
                  onUpdateConfig={(updates) =>
                     onUpdateWidgetConfig(widget.id, updates)
                  }
                  onUpdateDescription={(description) =>
                     onUpdateWidgetDescription(widget.id, description)
                  }
                  onUpdateName={(name) => onUpdateWidgetName(widget.id, name)}
                  widget={widget}
               />
            </div>
         ))}
      </div>
   );
}
