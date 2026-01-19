import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Label } from "@packages/ui/components/label";

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
                  checked={showLabels}
                  id="showLabels"
                  onCheckedChange={(checked) =>
                     onChange({ showLabels: checked === true })
                  }
               />
               <Label
                  className="text-sm font-normal cursor-pointer"
                  htmlFor="showLabels"
               >
                  Show values on chart
               </Label>
            </div>
            <div className="flex items-center space-x-2">
               <Checkbox
                  checked={showLegend}
                  id="showLegend"
                  onCheckedChange={(checked) =>
                     onChange({ showLegend: checked === true })
                  }
               />
               <Label
                  className="text-sm font-normal cursor-pointer"
                  htmlFor="showLegend"
               >
                  Show legend
               </Label>
            </div>
            <div className="flex items-center space-x-2">
               <Checkbox
                  checked={showTrendLine}
                  id="showTrendLine"
                  onCheckedChange={(checked) =>
                     onChange({ showTrendLine: checked === true })
                  }
               />
               <Label
                  className="text-sm font-normal cursor-pointer"
                  htmlFor="showTrendLine"
               >
                  Show trend line
               </Label>
            </div>
         </div>
      </div>
   );
}
