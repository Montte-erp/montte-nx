import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import { DateRangePickerPopover } from "@packages/ui/components/date-range-picker-popover";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
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
import { cn } from "@packages/ui/lib/utils";
import {
   ArrowDownLeft,
   ArrowLeftRight,
   ArrowUpRight,
   Building2,
   ChevronDown,
   Filter,
   FolderOpen,
   X,
} from "lucide-react";
import { useState } from "react";
import { TransactionFilterCredenza } from "@/features/transaction/ui/transaction-filter-credenza";
import { useCredenza } from "@/hooks/use-credenza";

type TransactionFilterBarProps = {
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
   bankAccountFilter: string;
   onBankAccountFilterChange: (value: string) => void;
   bankAccounts: Array<{
      id: string;
      name: string | null;
      bank: string;
   }>;
   onClearFilters: () => void;
   hasActiveFilters: boolean;
};

export function TransactionFilterBar({
   timePeriod,
   onTimePeriodChange,
   customDateRange,
   onCustomDateRangeChange,
   typeFilter,
   onTypeFilterChange,
   categoryFilter,
   onCategoryFilterChange,
   categories,
   bankAccountFilter,
   onBankAccountFilterChange,
   bankAccounts,
   onClearFilters,
   hasActiveFilters,
}: TransactionFilterBarProps) {
   const isMobile = useIsMobile();
   const { openCredenza } = useCredenza();
   const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

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
      bankAccountFilter !== "all",
   ].filter(Boolean).length;

   const hasMoreFilters =
      categoryFilter !== "all" || bankAccountFilter !== "all";

   const selectedCategory = categories.find((c) => c.id === categoryFilter);
   const selectedBankAccount = bankAccounts.find(
      (a) => a.id === bankAccountFilter,
   );

   const categoryOptions = [
      {
         label: "Todas as Categorias",
         value: "all",
      },
      ...categories.map((category) => ({
         label: category.name,
         value: category.id,
      })),
   ];

   const openFilterCredenza = () => {
      openCredenza({
         children: (
            <TransactionFilterCredenza
               bankAccountFilter={bankAccountFilter}
               bankAccounts={bankAccounts}
               categories={categories}
               categoryFilter={categoryFilter}
               customEndDate={customDateRange.endDate}
               customStartDate={customDateRange.startDate}
               hasActiveFilters={hasActiveFilters}
               onBankAccountFilterChange={onBankAccountFilterChange}
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

         {/* Row 2: Type filter + More filters + Clear */}
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

            <div className="h-8 w-px bg-border" />

            <Popover onOpenChange={setMoreFiltersOpen} open={moreFiltersOpen}>
               <PopoverTrigger asChild>
                  <Button
                     className={cn(
                        "gap-1.5 pr-2",
                        hasMoreFilters && "border-primary text-primary",
                     )}
                     size="sm"
                     variant="outline"
                  >
                     <Filter className="size-3.5" />
                     Mais Filtros
                     <ChevronDown
                        className={cn(
                           "size-3.5 transition-transform",
                           moreFiltersOpen && "rotate-180",
                        )}
                     />
                  </Button>
               </PopoverTrigger>
               <PopoverContent align="start" className="w-80 p-0">
                  <div className="border-b px-4 py-3">
                     <h4 className="font-medium text-sm">
                        Mais Filtros
                     </h4>
                     <p className="text-xs text-muted-foreground mt-0.5">
                        Refine os resultados com filtros
                     </p>
                  </div>

                  <div className="p-4 space-y-4">
                     <div className="space-y-2">
                        <div className="flex items-center gap-2">
                           <Building2 className="size-4 text-muted-foreground" />
                           <label className="text-sm font-medium">
                              Conta Bancária
                           </label>
                        </div>
                        <Select
                           onValueChange={onBankAccountFilterChange}
                           value={bankAccountFilter}
                        >
                           <SelectTrigger className="h-9">
                              <SelectValue
                                 placeholder="Selecione uma conta"
                              />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="all">
                                 Todas as Contas
                              </SelectItem>
                              {bankAccounts.map((account) => (
                                 <SelectItem
                                    key={account.id}
                                    value={account.id}
                                 >
                                    {account.name || account.bank}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="space-y-2">
                        <div className="flex items-center gap-2">
                           <FolderOpen className="size-4 text-muted-foreground" />
                           <label className="text-sm font-medium">
                              Categoria
                           </label>
                        </div>
                        <Combobox
                           className="h-9"
                           emptyMessage="Nenhum resultado encontrado"
                           onValueChange={onCategoryFilterChange}
                           options={categoryOptions}
                           placeholder="Selecione uma categoria"
                           searchPlaceholder="Pesquisar"
                           value={categoryFilter}
                        />
                     </div>
                  </div>

                  {hasMoreFilters && (
                     <div className="border-t px-4 py-3">
                        <Button
                           className="w-full"
                           onClick={() => {
                              onBankAccountFilterChange("all");
                              onCategoryFilterChange("all");
                           }}
                           size="sm"
                           variant="ghost"
                        >
                           <X className="size-3.5 mr-2" />
                           Limpar Filtros
                        </Button>
                     </div>
                  )}
               </PopoverContent>
            </Popover>

            {selectedBankAccount && (
               <Badge
                  className="gap-1.5 pl-2 pr-1 cursor-pointer hover:bg-secondary/80"
                  onClick={() => onBankAccountFilterChange("all")}
                  variant="secondary"
               >
                  <Building2 className="size-3" />
                  <span className="max-w-24 truncate">
                     {selectedBankAccount.name || selectedBankAccount.bank}
                  </span>
                  <X className="size-3" />
               </Badge>
            )}

            {selectedCategory && (
               <Badge
                  className="gap-1.5 pl-2 pr-1 cursor-pointer hover:bg-secondary/80"
                  onClick={() => onCategoryFilterChange("all")}
                  variant="secondary"
               >
                  <FolderOpen className="size-3" />
                  <span className="max-w-24 truncate">
                     {selectedCategory.name}
                  </span>
                  <X className="size-3" />
               </Badge>
            )}

            {hasActiveFilters && (
               <Button
                  className="h-8 text-xs"
                  onClick={onClearFilters}
                  size="sm"
                  variant="outline"
               >
                  <X className="size-3" />
                  Limpar filtros
               </Button>
            )}
         </div>
      </div>
   );
}
