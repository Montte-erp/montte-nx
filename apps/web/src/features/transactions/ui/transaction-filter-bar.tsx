import type { ConditionGroup } from "@f-o-t/condition-evaluator";
import { Button } from "@packages/ui/components/button";
import { DateRangePicker } from "@packages/ui/components/date-range-picker";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { TransactionFilterPopover } from "./transaction-filter-popover";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TransactionType = "income" | "expense" | "transfer";

export interface TransactionFilters {
   type?: TransactionType;
   dateFrom?: string;
   dateTo?: string;
   datePreset?: string;
   search: string;
   conditionGroup?: ConditionGroup;
   page: number;
   pageSize: number;
}

function getThisMonthRange() {
   const today = new Date();
   const fmt = (d: Date) => d.toISOString().split("T")[0];
   return {
      dateFrom: fmt(new Date(today.getFullYear(), today.getMonth(), 1)),
      dateTo: fmt(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
   };
}

const thisMonth = getThisMonthRange();

export const DEFAULT_FILTERS: TransactionFilters = {
   search: "",
   page: 1,
   pageSize: 20,
   datePreset: "this_month",
   dateFrom: thisMonth.dateFrom,
   dateTo: thisMonth.dateTo,
};

export interface TransactionFilterBarProps {
   filters: TransactionFilters;
   onFiltersChange: (filters: TransactionFilters) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date range presets
// ─────────────────────────────────────────────────────────────────────────────

export const DATE_RANGE_PRESETS = [
   { label: "Hoje", value: "today" },
   { label: "Últimos 7 dias", value: "7d" },
   { label: "Este mês", value: "this_month" },
   { label: "Mês passado", value: "last_month" },
   { label: "Este ano", value: "this_year" },
] as const;

export function presetToDateRange(preset: string): {
   dateFrom: string;
   dateTo: string;
} {
   const today = new Date();
   const fmt = (d: Date) => d.toISOString().split("T")[0];
   switch (preset) {
      case "today":
         return { dateFrom: fmt(today), dateTo: fmt(today) };
      case "7d": {
         const from = new Date(today);
         from.setDate(from.getDate() - 6);
         return { dateFrom: fmt(from), dateTo: fmt(today) };
      }
      case "this_month": {
         const from = new Date(today.getFullYear(), today.getMonth(), 1);
         const to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
         return { dateFrom: fmt(from), dateTo: fmt(to) };
      }
      case "last_month": {
         const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
         const to = new Date(today.getFullYear(), today.getMonth(), 0);
         return { dateFrom: fmt(from), dateTo: fmt(to) };
      }
      case "this_year": {
         const from = new Date(today.getFullYear(), 0, 1);
         const to = new Date(today.getFullYear(), 11, 31);
         return { dateFrom: fmt(from), dateTo: fmt(to) };
      }
      default:
         return { dateFrom: fmt(today), dateTo: fmt(today) };
   }
}

// ─────────────────────────────────────────────────────────────────────────────
// TransactionFilterBar
// ─────────────────────────────────────────────────────────────────────────────

export function TransactionFilterBar({
   filters,
   onFiltersChange,
}: TransactionFilterBarProps) {
   // Debounced search via timeout ref
   const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const [searchInput, setSearchInput] = useState(filters.search);

   const handleSearchChange = (value: string) => {
      setSearchInput(value);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
         onFiltersChange({ ...filters, search: value, page: 1 });
      }, 350);
   };

   const hasDateFilter = !!(filters.dateFrom || filters.dateTo);

   const dateLabel = useMemo(() => {
      if (filters.datePreset) {
         return (
            DATE_RANGE_PRESETS.find((p) => p.value === filters.datePreset)
               ?.label ?? "Período"
         );
      }
      if (filters.dateFrom && filters.dateTo) {
         const fmt = (s: string) =>
            new Date(`${s}T00:00:00`).toLocaleDateString("pt-BR", {
               day: "numeric",
               month: "short",
            });
         return `${fmt(filters.dateFrom)} – ${fmt(filters.dateTo)}`;
      }
      return "Período";
   }, [filters.datePreset, filters.dateFrom, filters.dateTo]);

   const selectedRange = useMemo(() => {
      if (filters.datePreset || !filters.dateFrom || !filters.dateTo)
         return null;
      return {
         from: new Date(`${filters.dateFrom}T00:00:00`),
         to: new Date(`${filters.dateTo}T00:00:00`),
      };
   }, [filters.datePreset, filters.dateFrom, filters.dateTo]);

   const hasActiveFilters =
      !!filters.type ||
      !!(filters.dateFrom || filters.dateTo) ||
      filters.search.length > 0 ||
      (filters.conditionGroup?.conditions.length ?? 0) > 0;

   const handleClear = () => {
      setSearchInput("");
      onFiltersChange(DEFAULT_FILTERS);
   };

   return (
      <div className="flex flex-wrap items-center gap-2">
         {/* Search */}
         <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
               className="pl-8 h-8 w-[220px]"
               onChange={(e) => handleSearchChange(e.target.value)}
               placeholder="Buscar transação..."
               value={searchInput}
            />
         </div>

         {/* Date range */}
         <DateRangePicker
            clearLabel="Limpar período"
            heading="Período"
            label={dateLabel}
            onClear={
               hasDateFilter
                  ? () =>
                       onFiltersChange({
                          ...filters,
                          dateFrom: undefined,
                          dateTo: undefined,
                          datePreset: undefined,
                          page: 1,
                       })
                  : undefined
            }
            onPresetSelect={(preset) => {
               const { dateFrom, dateTo } = presetToDateRange(preset);
               onFiltersChange({
                  ...filters,
                  dateFrom,
                  dateTo,
                  datePreset: preset,
                  page: 1,
               });
            }}
            onRangeSelect={(range) => {
               const fmt = (d: Date) => d.toISOString().split("T")[0];
               onFiltersChange({
                  ...filters,
                  dateFrom: fmt(range.from),
                  dateTo: fmt(range.to),
                  datePreset: undefined,
                  page: 1,
               });
            }}
            presets={DATE_RANGE_PRESETS}
            selectedPreset={filters.datePreset ?? null}
            selectedRange={selectedRange}
            triggerClassName="h-8"
            triggerVariant={hasDateFilter ? "secondary" : "outline"}
         />

         {/* Type select */}
         <Select
            onValueChange={(v) =>
               onFiltersChange({
                  ...filters,
                  type: v === "all" ? undefined : (v as TransactionType),
                  page: 1,
               })
            }
            value={filters.type ?? "all"}
         >
            <SelectTrigger className="h-8 w-[130px]">
               <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="all">Todos</SelectItem>
               <SelectItem value="income">Receita</SelectItem>
               <SelectItem value="expense">Despesa</SelectItem>
               <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
         </Select>

         {/* Condition builder popover */}
         <TransactionFilterPopover
            onChange={(group) =>
               onFiltersChange({ ...filters, conditionGroup: group, page: 1 })
            }
            value={filters.conditionGroup}
         />

         {/* Clear all */}
         {hasActiveFilters && (
            <Button className="h-8 gap-1" onClick={handleClear} variant="ghost">
               <X className="size-3.5" />
               Limpar
            </Button>
         )}
      </div>
   );
}
