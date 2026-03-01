import type { KpiConfig } from "@packages/analytics/types";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Switch } from "@packages/ui/components/switch";

interface KpiQueryBuilderProps {
   config: KpiConfig;
   onUpdate: (updates: Partial<KpiConfig>) => void;
}

const AGGREGATION_OPTIONS = [
   { value: "sum", label: "Soma dos valores" },
   { value: "count", label: "Contagem de transações" },
   { value: "avg", label: "Média dos valores" },
   { value: "net", label: "Saldo líquido (receitas − despesas)" },
] as const;

export function KpiQueryBuilder({ config, onUpdate }: KpiQueryBuilderProps) {
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
                           value as KpiConfig["measure"]["aggregation"],
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
