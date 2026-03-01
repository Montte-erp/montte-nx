import type { TransactionFilters } from "@packages/analytics/types";
import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { cn } from "@packages/ui/lib/utils";
import { Calendar, ChevronDown } from "lucide-react";

interface InsightFilterBarProps {
   filters: TransactionFilters;
   onFiltersChange: (updates: Partial<TransactionFilters>) => void;
}

const DATE_RANGE_PRESETS = [
   { value: "7d", label: "Últimos 7 dias" },
   { value: "14d", label: "Últimos 14 dias" },
   { value: "30d", label: "Últimos 30 dias" },
   { value: "90d", label: "Últimos 90 dias" },
   { value: "180d", label: "Últimos 180 dias" },
   { value: "12m", label: "Últimos 12 meses" },
   { value: "this_month", label: "Este mês" },
   { value: "last_month", label: "Mês passado" },
   { value: "this_quarter", label: "Este trimestre" },
   { value: "this_year", label: "Este ano" },
] as const;

const TRANSACTION_TYPES = [
   { value: "income" as const, label: "Receita" },
   { value: "expense" as const, label: "Despesa" },
   { value: "transfer" as const, label: "Transferência" },
];

function getDateRangeLabel(filters: TransactionFilters): string {
   const dr = filters.dateRange;
   if (dr.type === "absolute") return "Período personalizado";
   const preset = DATE_RANGE_PRESETS.find((p) => p.value === dr.value);
   return preset?.label ?? dr.value;
}

export function InsightFilterBar({
   filters,
   onFiltersChange,
}: InsightFilterBarProps) {
   const selectedTypes = filters.transactionType ?? [];

   const toggleType = (type: "income" | "expense" | "transfer") => {
      const current = filters.transactionType ?? [];
      const next = current.includes(type)
         ? current.filter((t) => t !== type)
         : [...current, type];
      onFiltersChange({ transactionType: next.length > 0 ? next : undefined });
   };

   return (
      <div className="flex items-center gap-2 border-b py-2">
         <Popover>
            <PopoverTrigger asChild>
               <Button className="h-7 text-xs" size="sm" variant="outline">
                  <Calendar className="mr-1.5 size-3.5" />
                  {getDateRangeLabel(filters)}
               </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-2">
               <div className="space-y-1">
                  {DATE_RANGE_PRESETS.map((preset) => (
                     <Button
                        className={cn(
                           "w-full justify-start text-xs",
                           filters.dateRange.type === "relative" &&
                              filters.dateRange.value === preset.value &&
                              "bg-accent",
                        )}
                        key={preset.value}
                        onClick={() =>
                           onFiltersChange({
                              dateRange: {
                                 type: "relative",
                                 value: preset.value,
                              },
                           })
                        }
                        size="sm"
                        variant="ghost"
                     >
                        {preset.label}
                     </Button>
                  ))}
               </div>
            </PopoverContent>
         </Popover>

         <Popover>
            <PopoverTrigger asChild>
               <Button
                  className="h-7 text-xs gap-1.5"
                  size="sm"
                  variant="outline"
               >
                  {selectedTypes.length === 0
                     ? "Todos os tipos"
                     : selectedTypes.length === 1
                       ? TRANSACTION_TYPES.find(
                            (t) => t.value === selectedTypes[0],
                         )?.label
                       : `${selectedTypes.length} tipos`}
                  <ChevronDown className="size-3 text-muted-foreground" />
               </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-44 p-2">
               <div className="space-y-1">
                  {TRANSACTION_TYPES.map((type) => (
                     <Button
                        className={cn(
                           "w-full justify-start text-xs",
                           selectedTypes.includes(type.value) && "bg-accent",
                        )}
                        key={type.value}
                        onClick={() => toggleType(type.value)}
                        size="sm"
                        variant="ghost"
                     >
                        {type.label}
                     </Button>
                  ))}
               </div>
            </PopoverContent>
         </Popover>
      </div>
   );
}
