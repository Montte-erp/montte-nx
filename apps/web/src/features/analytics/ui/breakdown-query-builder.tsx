import type { BreakdownConfig } from "@packages/analytics/types";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";

interface BreakdownQueryBuilderProps {
   config: BreakdownConfig;
   onUpdate: (updates: Partial<BreakdownConfig>) => void;
}

const AGGREGATION_OPTIONS = [
   { value: "sum", label: "Soma dos valores" },
   { value: "count", label: "Contagem de transações" },
   { value: "avg", label: "Média dos valores" },
] as const;

const GROUP_BY_OPTIONS = [
   { value: "category", label: "Categoria" },
   { value: "bank_account", label: "Conta bancária" },
   { value: "transaction_type", label: "Tipo (Receita/Despesa)" },
   { value: "subcategory", label: "Subcategoria" },
] as const;

const LIMIT_OPTIONS = [
   { value: "5", label: "Top 5" },
   { value: "10", label: "Top 10" },
   { value: "20", label: "Top 20" },
] as const;

export function BreakdownQueryBuilder({
   config,
   onUpdate,
}: BreakdownQueryBuilderProps) {
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
                           value as BreakdownConfig["measure"]["aggregation"],
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
               Agrupar por
            </Label>
            <Select
               onValueChange={(value) =>
                  onUpdate({ groupBy: value as BreakdownConfig["groupBy"] })
               }
               value={config.groupBy}
            >
               <SelectTrigger>
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  {GROUP_BY_OPTIONS.map((opt) => (
                     <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>

         <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
               Limite
            </Label>
            <Select
               onValueChange={(value) => onUpdate({ limit: Number(value) })}
               value={String(config.limit ?? 10)}
            >
               <SelectTrigger>
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  {LIMIT_OPTIONS.map((opt) => (
                     <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </div>
      </div>
   );
}
