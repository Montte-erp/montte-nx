import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Label } from "@packages/ui/components/label";

type ComparisonType = NonNullable<InsightConfig["comparison"]>["type"];

type ComparisonSectionProps = {
   value?: ComparisonType;
   onChange: (comparison: InsightConfig["comparison"]) => void;
};

export function ComparisonSection({ value, onChange }: ComparisonSectionProps) {
   const handleChange = (type: ComparisonType, checked: boolean) => {
      if (checked) {
         onChange({ type });
      } else if (value === type) {
         onChange(undefined);
      }
   };

   return (
      <div className="space-y-3">
         <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Comparison
         </h4>
         <div className="space-y-3">
            <div className="flex items-center space-x-2">
               <Checkbox
                  checked={value === "previous_period"}
                  id="previousPeriod"
                  onCheckedChange={(checked) =>
                     handleChange("previous_period", checked === true)
                  }
               />
               <Label
                  className="text-sm font-normal cursor-pointer"
                  htmlFor="previousPeriod"
               >
                  Compare to previous period
               </Label>
            </div>
            <div className="flex items-center space-x-2">
               <Checkbox
                  checked={value === "previous_year"}
                  id="previousYear"
                  onCheckedChange={(checked) =>
                     handleChange("previous_year", checked === true)
                  }
               />
               <Label
                  className="text-sm font-normal cursor-pointer"
                  htmlFor="previousYear"
               >
                  Compare to same period last year
               </Label>
            </div>
         </div>
      </div>
   );
}
