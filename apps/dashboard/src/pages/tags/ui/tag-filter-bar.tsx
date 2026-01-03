import { translate } from "@packages/localization";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { DateRangePickerPopover } from "@packages/ui/components/date-range-picker-popover";
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
   ArrowDownAZ,
   ArrowDownLeft,
   ArrowLeftRight,
   ArrowUpAZ,
   ArrowUpRight,
   Filter,
   X,
} from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";
import { TagFilterCredenza } from "../features/tag-filter-credenza";

type TagFilterBarProps = {
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
   orderBy: "name" | "createdAt" | "updatedAt";
   onOrderByChange: (value: "name" | "createdAt" | "updatedAt") => void;
   orderDirection: "asc" | "desc";
   onOrderDirectionChange: (value: "asc" | "desc") => void;
   pageSize: number;
   onPageSizeChange: (value: number) => void;
   onClearFilters: () => void;
   hasActiveFilters: boolean;
};

export function TagFilterBar({
   timePeriod,
   onTimePeriodChange,
   customDateRange,
   onCustomDateRangeChange,
   typeFilter,
   onTypeFilterChange,
   orderBy,
   onOrderByChange,
   orderDirection,
   onOrderDirectionChange,
   pageSize,
   onPageSizeChange,
   onClearFilters,
   hasActiveFilters,
}: TagFilterBarProps) {
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
      orderBy !== "name" || orderDirection !== "asc",
   ].filter(Boolean).length;

   const openFilterCredenza = () => {
      openCredenza({
         children: (
            <TagFilterCredenza
               customEndDate={customDateRange.endDate}
               customStartDate={customDateRange.startDate}
               hasActiveFilters={hasActiveFilters}
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
               onOrderByChange={onOrderByChange}
               onOrderDirectionChange={onOrderDirectionChange}
               onPageSizeChange={onPageSizeChange}
               onTimePeriodChange={onTimePeriodChange}
               onTypeFilterChange={onTypeFilterChange}
               orderBy={orderBy}
               orderDirection={orderDirection}
               pageSize={pageSize}
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
               {translate("common.form.filter.title")}
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
               placeholder={translate("common.form.date-range.custom")}
               startDate={customDateRange.startDate}
            />
         </div>

         {/* Row 2: Type filter + Sort + Clear */}
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
                  {translate(
                     "dashboard.routes.transactions.list-section.types.income",
                  )}
               </ToggleGroupItem>
               <ToggleGroupItem
                  className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-red-500 data-[state=on]:text-red-600"
                  value="expense"
               >
                  <ArrowUpRight className="size-3.5" />
                  {translate(
                     "dashboard.routes.transactions.list-section.types.expense",
                  )}
               </ToggleGroupItem>
               <ToggleGroupItem
                  className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-blue-500 data-[state=on]:text-blue-600"
                  value="transfer"
               >
                  <ArrowLeftRight className="size-3.5" />
                  {translate(
                     "dashboard.routes.transactions.list-section.types.transfer",
                  )}
               </ToggleGroupItem>
            </ToggleGroup>

            <div className="h-8 w-px bg-border" />

            <div className="flex items-center gap-2">
               <span className="text-sm text-muted-foreground">
                  {translate("common.form.sort-by.label")}:
               </span>
               <ToggleGroup
                  onValueChange={(value) => {
                     if (value) {
                        onOrderDirectionChange(value as "asc" | "desc");
                     }
                  }}
                  size="sm"
                  spacing={2}
                  type="single"
                  value={orderDirection}
                  variant="outline"
               >
                  <ToggleGroupItem
                     className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-primary data-[state=on]:text-primary"
                     value="asc"
                  >
                     <ArrowUpAZ className="size-3.5" />
                     A-Z
                  </ToggleGroupItem>
                  <ToggleGroupItem
                     className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-primary data-[state=on]:text-primary"
                     value="desc"
                  >
                     <ArrowDownAZ className="size-3.5" />
                     Z-A
                  </ToggleGroupItem>
               </ToggleGroup>
            </div>

            {hasActiveFilters && (
               <Button
                  className="h-8 text-xs"
                  onClick={onClearFilters}
                  size="sm"
                  variant="outline"
               >
                  <X className="size-3" />
                  {translate("common.actions.clear-filters")}
               </Button>
            )}
         </div>
      </div>
   );
}
