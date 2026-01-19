import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { DateRangePickerPopover } from "@packages/ui/components/date-range-picker-popover";
import { Separator } from "@packages/ui/components/separator";
import {
   type TimePeriod,
   TimePeriodChips,
   type TimePeriodDateRange,
} from "@packages/ui/components/time-period-chips";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import {
   ArrowDownLeft,
   ArrowLeftRight,
   ArrowUpRight,
   Filter,
   X,
} from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";
import { BankAccountFilterCredenza } from "./bank-account-filter-credenza";

type BankAccountFilterBarProps = {
   timePeriod: TimePeriod | null;
   onTimePeriodChange: (
      period: TimePeriod | null,
      range: TimePeriodDateRange,
   ) => void;
   customDateRange: {
      startDate: Date | null;
      endDate: Date | null;
   };
   onCustomDateRangeChange: (range: {
      startDate: Date | null;
      endDate: Date | null;
   }) => void;
   typeFilter: string;
   onTypeFilterChange: (value: string) => void;
   categoryFilter: string;
   onCategoryFilterChange: (value: string) => void;
   categories: Array<{
      id: string;
      name: string;
      color: string;
      icon: string | null;
   }>;
   onClearFilters: () => void;
   hasActiveFilters: boolean;
};

export function BankAccountFilterBar({
   timePeriod,
   onTimePeriodChange,
   customDateRange,
   onCustomDateRangeChange,
   typeFilter,
   onTypeFilterChange,
   categoryFilter,
   onCategoryFilterChange,
   categories,
   onClearFilters,
   hasActiveFilters,
}: BankAccountFilterBarProps) {
   const isMobile = useIsMobile();
   const { openCredenza } = useCredenza();

   const handleCustomDateChange = (range: {
      startDate: Date | null;
      endDate: Date | null;
   }) => {
      onCustomDateRangeChange(range);
      if (range.startDate && range.endDate) {
         onTimePeriodChange("custom", {
            endDate: range.endDate,
            selectedMonth: range.startDate,
            startDate: range.startDate,
         });
      }
   };

   const activeFilterCount = [
      timePeriod !== "this-month" && timePeriod !== null,
      typeFilter !== "",
      categoryFilter !== "all",
   ].filter(Boolean).length;

   const openFilterCredenza = () => {
      openCredenza({
         children: (
            <BankAccountFilterCredenza
               categories={categories}
               categoryFilter={categoryFilter}
               customEndDate={customDateRange.endDate}
               customStartDate={customDateRange.startDate}
               hasActiveFilters={hasActiveFilters}
               onCategoryFilterChange={onCategoryFilterChange}
               onClearFilters={onClearFilters}
               onCustomEndDateChange={(date) =>
                  onCustomDateRangeChange({
                     ...customDateRange,
                     endDate: date || null,
                  })
               }
               onCustomStartDateChange={(date) =>
                  onCustomDateRangeChange({
                     ...customDateRange,
                     startDate: date || null,
                  })
               }
               onTimePeriodChange={onTimePeriodChange}
               onTypeFilterChange={onTypeFilterChange}
               timePeriod={timePeriod}
               typeFilter={typeFilter}
            />
         ),
      });
   };

   if (isMobile) {
      return (
         <div className="flex items-center gap-2">
            <Button
               className="gap-2"
               onClick={openFilterCredenza}
               size="sm"
               variant={hasActiveFilters ? "default" : "outline"}
            >
               <Filter className="size-4" />
               Filtros
               {activeFilterCount > 0 && (
                  <Badge
                     className="size-5 p-0 justify-center"
                     variant="secondary"
                  >
                     {activeFilterCount}
                  </Badge>
               )}
            </Button>
         </div>
      );
   }

   return (
      <div className="space-y-3">
         {/* Row 1: Time period selection */}
         <div className="flex flex-wrap items-center gap-3">
            <TimePeriodChips
               onValueChange={onTimePeriodChange}
               scrollable
               size="sm"
               value={timePeriod === "custom" ? null : timePeriod}
            />

            <DateRangePickerPopover
               endDate={customDateRange.endDate}
               onRangeChange={handleCustomDateChange}
               placeholder="Personalizado"
               startDate={customDateRange.startDate}
            />
         </div>

         {/* Row 2: Type filter + Clear */}
         <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
               onValueChange={onTypeFilterChange}
               size="sm"
               spacing={2}
               type="single"
               value={typeFilter}
               variant="outline"
            >
               <ToggleGroupItem
                  className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600"
                  value="income"
               >
                  <ArrowDownLeft className="size-3.5" />
                  Receita
               </ToggleGroupItem>
               <ToggleGroupItem
                  className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-red-500 data-[state=on]:text-red-600"
                  value="expense"
               >
                  <ArrowUpRight className="size-3.5" />
                  Despesa
               </ToggleGroupItem>
               <ToggleGroupItem
                  className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-blue-500 data-[state=on]:text-blue-600"
                  value="transfer"
               >
                  <ArrowLeftRight className="size-3.5" />
                  Transferência
               </ToggleGroupItem>
            </ToggleGroup>

            {hasActiveFilters && (
               <>
                  <Separator className="h-8" orientation="vertical" />

                  <Button
                     className="h-8 text-xs"
                     onClick={onClearFilters}
                     size="sm"
                     variant="outline"
                  >
                     <X className="size-3" />
                     Limpar filtros
                  </Button>
               </>
            )}
         </div>
      </div>
   );
}
