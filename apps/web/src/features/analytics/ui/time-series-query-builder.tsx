import type { TimeSeriesConfig } from "@modules/insights/types";
import { Button } from "@packages/ui/components/button";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";
import { cn } from "@packages/ui/lib/utils";
import { BarChart3, LineChart } from "lucide-react";

interface TimeSeriesQueryBuilderProps {
   config: TimeSeriesConfig;
   onUpdate: (updates: Partial<TimeSeriesConfig>) => void;
}

const AGGREGATION_OPTIONS = [
   { value: "sum", label: "Soma dos valores" },
   { value: "count", label: "Contagem de transações" },
   { value: "avg", label: "Média dos valores" },
] as const;

const INTERVAL_OPTIONS = [
   { value: "day", label: "Dia" },
   { value: "week", label: "Semana" },
   { value: "month", label: "Mês" },
] as const;

export function TimeSeriesQueryBuilder({
   config,
   onUpdate,
}: TimeSeriesQueryBuilderProps) {
   return (
      <div className="space-y-4">
         <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
               Métrica
            </Label>
            <Select
               onValueChange={(value) =>
                  onUpdate({
                     measure: {
                        aggregation:
                           value as TimeSeriesConfig["measure"]["aggregation"],
                     },
                  })
               }
               value={config.measure.aggregation}
            >
               <SelectTrigger>
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  {AGGREGATION_OPTIONS.map((opt) => (
                     <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>

         <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
               Intervalo
            </Label>
            <Select
               onValueChange={(value) =>
                  onUpdate({ interval: value as TimeSeriesConfig["interval"] })
               }
               value={config.interval}
            >
               <SelectTrigger>
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  {INTERVAL_OPTIONS.map((opt) => (
                     <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>

         <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
               Tipo de gráfico
            </Label>
            <div className="flex gap-2">
               <Button
                  className={cn(
                     "flex-1 gap-1.5",
                     config.chartType === "line" && "border-primary",
                  )}
                  onClick={() => onUpdate({ chartType: "line" })}
                  variant={config.chartType === "line" ? "default" : "outline"}
               >
                  <LineChart className="size-4" />
                  Linha
               </Button>
               <Button
                  className={cn(
                     "flex-1 gap-1.5",
                     config.chartType === "bar" && "border-primary",
                  )}
                  onClick={() => onUpdate({ chartType: "bar" })}
                  variant={config.chartType === "bar" ? "default" : "outline"}
               >
                  <BarChart3 className="size-4" />
                  Barras
               </Button>
            </div>
         </div>

         <div className="flex items-center justify-between">
            <Label className="text-sm">Comparar com período anterior</Label>
            <Switch
               checked={config.compare ?? false}
               onCheckedChange={(checked) => onUpdate({ compare: checked })}
            />
         </div>
      </div>
   );
}
