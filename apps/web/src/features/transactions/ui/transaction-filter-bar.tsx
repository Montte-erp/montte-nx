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
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useDebouncedValue } from "foxact/use-debounced-value";
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";
import { useEffect, useMemo, useRef, useState } from "react";
import { orpc } from "@/integrations/orpc/client";
import { TransactionFilterPopover } from "./transaction-filter-popover";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
   pix: "Pix",
   credit_card: "Cartão de Crédito",
   debit_card: "Cartão de Débito",
   boleto: "Boleto",
   cash: "Dinheiro",
   transfer: "Transferência",
   other: "Outro",
   cheque: "Cheque",
   automatic_debit: "Débito Automático",
};

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
   bankAccountId?: string;
   creditCardId?: string;
   paymentMethod?: string;
   categoryId?: string;
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
   // Data queries for filter dropdowns
   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const categories = categoriesResult;
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: creditCards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({}),
   );

   const [searchInput, setSearchInput] = useState(filters.search);
   const debouncedSearch = useDebouncedValue(searchInput, 350);

   const stableOnFiltersChange = useStableHandler(onFiltersChange);
   const filtersRef = useRef(filters);
   useEffect(() => {
      filtersRef.current = filters;
   });

   const isMounted = useRef(false);
   useEffect(() => {
      if (!isMounted.current) {
         isMounted.current = true;
         return;
      }
      stableOnFiltersChange({
         ...filtersRef.current,
         search: debouncedSearch,
         page: 1,
      });
   }, [debouncedSearch, stableOnFiltersChange]);

   const handleSearchChange = (value: string) => {
      setSearchInput(value);
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
      (filters.conditionGroup?.conditions.length ?? 0) > 0 ||
      !!filters.categoryId ||
      !!filters.bankAccountId ||
      !!filters.creditCardId ||
      !!filters.paymentMethod;

   const handleClear = () => {
      setSearchInput("");
      onFiltersChange(DEFAULT_FILTERS);
   };

   const setFilters = (
      updater: (prev: TransactionFilters) => TransactionFilters,
   ) => {
      onFiltersChange(updater(filters));
   };

   return (
      <div className="flex flex-col gap-4">
         {/* Row 1: Search */}
         <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
               className="pl-8 h-8"
               onChange={(e) => handleSearchChange(e.target.value)}
               placeholder="Buscar por nome, descrição ou contato..."
               value={searchInput}
            />
         </div>

         {/* Row 2: Filters */}
         <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {/* Período */}
            <div className="flex flex-col gap-2">
               <span className="text-xs font-medium uppercase text-muted-foreground">
                  Período
               </span>
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
                  triggerVariant="outline"
               />
            </div>

            {/* Tipo */}
            <div className="flex flex-col gap-2">
               <span className="text-xs font-medium uppercase text-muted-foreground">
                  Tipo
               </span>
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
                  <SelectTrigger className="h-8 sm:w-[130px]">
                     <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todos</SelectItem>
                     <SelectItem value="income">Receita</SelectItem>
                     <SelectItem value="expense">Despesa</SelectItem>
                     <SelectItem value="transfer">Transferência</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            {/* Categoria */}
            <div className="flex flex-col gap-2">
               <span className="text-xs font-medium uppercase text-muted-foreground">
                  Categoria
               </span>
               <Select
                  onValueChange={(v) =>
                     setFilters((f) => ({
                        ...f,
                        categoryId: v === "all" ? undefined : v,
                        page: 1,
                     }))
                  }
                  value={filters.categoryId ?? "all"}
               >
                  <SelectTrigger className="h-8 sm:w-[150px]">
                     <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todas</SelectItem>
                     {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                           {c.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            {/* Conta */}
            <div className="flex flex-col gap-2">
               <span className="text-xs font-medium uppercase text-muted-foreground">
                  Conta
               </span>
               <Select
                  onValueChange={(v) =>
                     setFilters((f) => ({
                        ...f,
                        bankAccountId: v === "all" ? undefined : v,
                        page: 1,
                     }))
                  }
                  value={filters.bankAccountId ?? "all"}
               >
                  <SelectTrigger className="h-8 sm:w-[150px]">
                     <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todas</SelectItem>
                     {bankAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                           {a.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            {/* Cartão */}
            <div className="flex flex-col gap-2">
               <span className="text-xs font-medium uppercase text-muted-foreground">
                  Cartão
               </span>
               <Select
                  onValueChange={(v) =>
                     setFilters((f) => ({
                        ...f,
                        creditCardId: v === "all" ? undefined : v,
                        page: 1,
                     }))
                  }
                  value={filters.creditCardId ?? "all"}
               >
                  <SelectTrigger className="h-8 sm:w-[150px]">
                     <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todos</SelectItem>
                     {creditCards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                           {c.name}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </div>

            {/* Forma de pagamento */}
            <div className="flex flex-col gap-2">
               <span className="text-xs font-medium uppercase text-muted-foreground">
                  Forma de pagamento
               </span>
               <Select
                  onValueChange={(v) =>
                     setFilters((f) => ({
                        ...f,
                        paymentMethod: v === "all" ? undefined : v,
                        page: 1,
                     }))
                  }
                  value={filters.paymentMethod ?? "all"}
               >
                  <SelectTrigger className="h-8 sm:w-[170px]">
                     <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todas</SelectItem>
                     {Object.entries(PAYMENT_METHOD_LABELS).map(
                        ([value, label]) => (
                           <SelectItem key={value} value={value}>
                              {label}
                           </SelectItem>
                        ),
                     )}
                  </SelectContent>
               </Select>
            </div>

            {/* More filters popover + Clear */}
            <div className="col-span-2 flex items-center gap-2 sm:self-end">
               <TransactionFilterPopover
                  onChange={(group) =>
                     onFiltersChange({
                        ...filters,
                        conditionGroup: group,
                        page: 1,
                     })
                  }
                  value={filters.conditionGroup}
               />

               {hasActiveFilters && (
                  <Button
                     className="h-8 gap-2"
                     onClick={handleClear}
                     variant="ghost"
                  >
                     <X className="size-3.5" />
                     Limpar
                  </Button>
               )}
            </div>
         </div>
      </div>
   );
}
