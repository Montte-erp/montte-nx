import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import { cn } from "@packages/ui/lib/utils";
import {
   BarChart3,
   LineChart,
   PieChart,
   Table2,
   TrendingUp,
} from "lucide-react";

type ChartType = InsightConfig["chartType"];

const CHART_TYPES: Array<{
   value: ChartType;
   label: string;
   icon: typeof LineChart;
}> = [
   { value: "stat_card", label: "Stat", icon: TrendingUp },
   { value: "line", label: "Line", icon: LineChart },
   { value: "bar", label: "Bar", icon: BarChart3 },
   { value: "pie", label: "Pie", icon: PieChart },
   { value: "donut", label: "Donut", icon: PieChart },
   { value: "table", label: "Table", icon: Table2 },
];

type ChartTypeSelectorSectionProps = {
   value: ChartType;
   onChange: (chartType: ChartType) => void;
};

export function ChartTypeSelectorSection({
   value,
   onChange,
}: ChartTypeSelectorSectionProps) {
   return (
      <div className="space-y-3">
         <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Chart Type
         </h4>
         <div className="grid grid-cols-4 gap-1.5">
            {CHART_TYPES.map((type) => {
               const Icon = type.icon;
               const isSelected = value === type.value;
               return (
                  <Button
                     className={cn(
                        "flex flex-col items-center gap-1 h-auto py-2 px-2",
                        isSelected && "bg-accent text-accent-foreground",
                     )}
                     key={type.value}
                     onClick={() => onChange(type.value)}
                     size="sm"
                     variant="ghost"
                  >
                     <Icon className="h-4 w-4" />
                     <span className="text-[10px]">{type.label}</span>
                  </Button>
               );
            })}
         </div>
      </div>
   );
}
