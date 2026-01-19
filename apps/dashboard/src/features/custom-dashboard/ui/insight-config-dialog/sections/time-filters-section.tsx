import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { DatePicker } from "@packages/ui/components/date-picker";
import { FieldLabel } from "@packages/ui/components/field";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { cn } from "@packages/ui/lib/utils";
import {
   ArrowLeftRight,
   Calendar,
   CalendarCheck,
   Check,
   Layers,
   TrendingUp,
   X,
} from "lucide-react";

type RelativePeriod = NonNullable<
   InsightConfig["dateRangeOverride"]
>["relativePeriod"];
type TimeGrouping = NonNullable<InsightConfig["timeGrouping"]>;
type ComparisonType = NonNullable<InsightConfig["comparison"]>["type"] | "none";

const DATE_RANGE_OPTIONS = [
   { value: "last_7_days", label: "Ultimos 7 dias" },
   { value: "last_30_days", label: "Ultimos 30 dias" },
   { value: "last_90_days", label: "Ultimos 90 dias" },
   { value: "this_month", label: "Este mes" },
   { value: "last_month", label: "Mes passado" },
   { value: "this_quarter", label: "Este trimestre" },
   { value: "this_year", label: "Este ano" },
   { value: "last_year", label: "Ano passado" },
   { value: "custom", label: "Personalizado" },
] as const;

const GROUPING_OPTIONS: Array<{ value: TimeGrouping; label: string }> = [
   { value: "day", label: "Dia" },
   { value: "week", label: "Semana" },
   { value: "month", label: "Mes" },
   { value: "quarter", label: "Trimestre" },
   { value: "year", label: "Ano" },
];

type TimeFiltersSectionProps = {
   dateRange: RelativePeriod;
   timeGrouping: TimeGrouping;
   comparison: ComparisonType;
   customStartDate?: Date | null;
   customEndDate?: Date | null;
   onDateRangeChange: (dateRange: RelativePeriod) => void;
   onTimeGroupingChange: (timeGrouping: TimeGrouping) => void;
   onComparisonChange: (comparison: ComparisonType) => void;
   onCustomStartDateChange?: (date: Date | undefined) => void;
   onCustomEndDateChange?: (date: Date | undefined) => void;
};

export function TimeFiltersSection({
   dateRange,
   timeGrouping,
   comparison,
   customStartDate,
   customEndDate,
   onDateRangeChange,
   onTimeGroupingChange,
   onComparisonChange,
   onCustomStartDateChange,
   onCustomEndDateChange,
}: TimeFiltersSectionProps) {
   return (
      <div className="space-y-6">
         {/* Date Range */}
         <section className="space-y-3">
            <div className="flex items-center gap-2">
               <Calendar className="h-4 w-4 text-muted-foreground" />
               <FieldLabel className="text-sm font-medium m-0">
                  Periodo
               </FieldLabel>
            </div>
            <Select
               onValueChange={(value) =>
                  onDateRangeChange(value as RelativePeriod)
               }
               value={dateRange}
            >
               <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Selecione um periodo" />
               </SelectTrigger>
               <SelectContent>
                  {DATE_RANGE_OPTIONS.map((option) => (
                     <SelectItem
                        className="py-2.5"
                        key={option.value}
                        value={option.value}
                     >
                        {option.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>

            {/* Custom date pickers */}
            {dateRange === "custom" && (
               <div className="flex flex-col gap-3 pt-2">
                  <div className="flex flex-col gap-1.5">
                     <FieldLabel className="text-xs text-muted-foreground m-0">
                        Data inicial
                     </FieldLabel>
                     <DatePicker
                        className="w-full"
                        date={customStartDate ?? undefined}
                        onSelect={onCustomStartDateChange}
                        placeholder="Selecione a data inicial"
                     />
                  </div>
                  <div className="flex flex-col gap-1.5">
                     <FieldLabel className="text-xs text-muted-foreground m-0">
                        Data final
                     </FieldLabel>
                     <DatePicker
                        className="w-full"
                        date={customEndDate ?? undefined}
                        onSelect={onCustomEndDateChange}
                        placeholder="Selecione a data final"
                     />
                  </div>
               </div>
            )}
         </section>

         {/* Grouped By */}
         <section className="space-y-3">
            <div className="flex items-center gap-2">
               <Layers className="h-4 w-4 text-muted-foreground" />
               <FieldLabel className="text-sm font-medium m-0">
                  Agrupado por
               </FieldLabel>
            </div>
            <Select
               onValueChange={(value) =>
                  onTimeGroupingChange(value as TimeGrouping)
               }
               value={timeGrouping}
            >
               <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Selecione o agrupamento" />
               </SelectTrigger>
               <SelectContent>
                  {GROUPING_OPTIONS.map((option) => (
                     <SelectItem
                        className="py-2.5"
                        key={option.value}
                        value={option.value}
                     >
                        {option.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </section>

         {/* Comparison */}
         <section className="space-y-3">
            <div className="flex items-center gap-2">
               <TrendingUp className="h-4 w-4 text-muted-foreground" />
               <FieldLabel className="text-sm font-medium m-0">
                  Comparacao
               </FieldLabel>
            </div>
            <div className="space-y-2">
               <ComparisonOption
                  icon={X}
                  isSelected={comparison === "none"}
                  label="Sem comparacao entre periodos"
                  onClick={() => onComparisonChange("none")}
               />
               <ComparisonOption
                  icon={ArrowLeftRight}
                  isSelected={comparison === "previous_period"}
                  label="Comparar com periodo anterior"
                  onClick={() => onComparisonChange("previous_period")}
               />
               <ComparisonOption
                  icon={CalendarCheck}
                  isSelected={comparison === "previous_year"}
                  label="Comparar com mesmo periodo do ano anterior"
                  onClick={() => onComparisonChange("previous_year")}
               />
            </div>
         </section>
      </div>
   );
}

type ComparisonOptionProps = {
   label: string;
   icon: React.ComponentType<{ className?: string }>;
   isSelected: boolean;
   onClick: () => void;
};

function ComparisonOption({
   label,
   icon: Icon,
   isSelected,
   onClick,
}: ComparisonOptionProps) {
   return (
      <button
         className={cn(
            "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
            isSelected
               ? "border-primary bg-primary/5"
               : "border-border hover:border-muted-foreground/50 hover:bg-muted/30",
         )}
         onClick={onClick}
         type="button"
      >
         <div
            className={cn(
               "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
               isSelected ? "bg-primary text-primary-foreground" : "bg-muted",
            )}
         >
            <Icon className="h-4 w-4" />
         </div>
         <span className="text-sm font-medium flex-1 text-left">{label}</span>
         {isSelected && <Check className="h-4 w-4 text-primary" />}
      </button>
   );
}
