import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { cn } from "@packages/ui/lib/utils";
import { Check } from "lucide-react";
import { useMemo } from "react";
import {
   CHART_CATEGORIES,
   CHART_TYPE_COMPATIBILITY,
   type ChartType,
} from "../config-search-index";

type DisplayTypeSectionProps = {
   chartType: ChartType;
   dataSource: InsightConfig["dataSource"];
   onChartTypeChange: (chartType: ChartType) => void;
};

export function DisplayTypeSection({
   chartType,
   dataSource,
   onChartTypeChange,
}: DisplayTypeSectionProps) {
   const filteredCategories = useMemo(() => {
      if (!dataSource) return CHART_CATEGORIES;

      const allowedTypes = CHART_TYPE_COMPATIBILITY[dataSource] || [];
      return CHART_CATEGORIES.map((category) => ({
         ...category,
         types: category.types.filter((type) =>
            allowedTypes.includes(type.value),
         ),
      })).filter((category) => category.types.length > 0);
   }, [dataSource]);

   return (
      <div className="space-y-6">
         {filteredCategories.map((category) => (
            <section className="space-y-3" key={category.name}>
               <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {category.name}
               </h4>
               <div className="grid grid-cols-2 gap-2">
                  {category.types.map((type) => {
                     const Icon = type.icon;
                     const isSelected = chartType === type.value;
                     return (
                        <button
                           className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                              isSelected
                                 ? "border-primary bg-primary/5 ring-1 ring-primary"
                                 : "border-border hover:border-muted-foreground/50 hover:bg-muted/30",
                           )}
                           key={type.value}
                           onClick={() => onChartTypeChange(type.value)}
                           type="button"
                        >
                           <div
                              className={cn(
                                 "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                                 isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "border bg-background",
                              )}
                           >
                              <Icon className="h-4 w-4" />
                           </div>
                           <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                              <span className="text-sm font-medium truncate">
                                 {type.label}
                              </span>
                              <span className="text-xs text-muted-foreground line-clamp-2">
                                 {type.description}
                              </span>
                           </div>
                           {isSelected && (
                              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                           )}
                        </button>
                     );
                  })}
               </div>
            </section>
         ))}
      </div>
   );
}
