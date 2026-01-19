import type {
   InsightConfig,
   InsightFilter,
} from "@packages/database/schemas/dashboards";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { FieldLabel } from "@packages/ui/components/field";
import { MultiSelect } from "@packages/ui/components/multi-select";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { cn } from "@packages/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
   ArrowDownLeft,
   ArrowLeftRight,
   ArrowUpRight,
   Calendar,
   CalendarCheck,
   Check,
   CreditCard,
   Filter,
   Layers,
   RotateCcw,
   Tag,
   TrendingUp,
   X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCredenza } from "@/hooks/use-credenza";
import { trpc } from "@/integrations/clients";

type RelativePeriod = NonNullable<
   InsightConfig["dateRangeOverride"]
>["relativePeriod"];
type TimeGrouping = NonNullable<InsightConfig["timeGrouping"]>;
type ComparisonType = NonNullable<InsightConfig["comparison"]>["type"] | "none";

const DATE_RANGE_OPTIONS = [
   { value: "last_7_days", label: "Últimos 7 dias" },
   { value: "last_30_days", label: "Últimos 30 dias" },
   { value: "last_90_days", label: "Últimos 90 dias" },
   { value: "this_month", label: "Este mês" },
   { value: "last_month", label: "Mês passado" },
   { value: "this_quarter", label: "Este trimestre" },
   { value: "this_year", label: "Este ano" },
   { value: "last_year", label: "Ano passado" },
   { value: "custom", label: "Personalizado" },
] as const;

const GROUPING_OPTIONS: Array<{ value: TimeGrouping; label: string }> = [
   { value: "day", label: "Dia" },
   { value: "week", label: "Semana" },
   { value: "month", label: "Mês" },
   { value: "quarter", label: "Trimestre" },
   { value: "year", label: "Ano" },
];

type TransactionType = "income" | "expense" | "transfer" | "all";

// Helper functions to parse and build InsightFilter array
function getFilterValue(
   filters: InsightFilter[],
   field: string,
): string | string[] | null {
   const filter = filters.find((f) => f.field === field);
   if (!filter) return null;
   return filter.value as string | string[];
}

function getCategoryIdsFromFilters(filters: InsightFilter[]): string[] {
   const value = getFilterValue(filters, "categoryId");
   if (!value) return [];
   return Array.isArray(value) ? value : [value];
}

function getTagIdsFromFilters(filters: InsightFilter[]): string[] {
   const value = getFilterValue(filters, "tagId");
   if (!value) return [];
   return Array.isArray(value) ? value : [value];
}

function getBankAccountIdFromFilters(filters: InsightFilter[]): string {
   const value = getFilterValue(filters, "bankAccountId");
   if (!value) return "all";
   return Array.isArray(value) ? value[0] || "all" : value;
}

function getTransactionTypeFromFilters(
   filters: InsightFilter[],
): TransactionType {
   const value = getFilterValue(filters, "type");
   if (!value) return "all";
   const typeValue = Array.isArray(value) ? value[0] : value;
   if (
      typeValue === "income" ||
      typeValue === "expense" ||
      typeValue === "transfer"
   ) {
      return typeValue;
   }
   return "all";
}

function buildDataFilters(
   typeFilter: TransactionType,
   categoryIds: string[],
   tagIds: string[],
   bankAccountId: string,
): InsightFilter[] {
   const filters: InsightFilter[] = [];

   if (typeFilter !== "all") {
      filters.push({ field: "type", operator: "equals", value: typeFilter });
   }

   if (categoryIds.length > 0) {
      filters.push({ field: "categoryId", operator: "in", value: categoryIds });
   }

   if (tagIds.length > 0) {
      filters.push({ field: "tagId", operator: "in", value: tagIds });
   }

   if (bankAccountId !== "all") {
      filters.push({
         field: "bankAccountId",
         operator: "equals",
         value: bankAccountId,
      });
   }

   return filters;
}

type WidgetFiltersCredenzaProps = {
   config: InsightConfig;
   onApply: (updates: Partial<InsightConfig>) => void;
};

export function WidgetFiltersCredenza({
   config,
   onApply,
}: WidgetFiltersCredenzaProps) {
   const { closeCredenza } = useCredenza();

   // Parse initial filter values from config
   const initialFilters = config.filters || [];

   // Time-based filter states
   const [dateRange, setDateRange] = useState<RelativePeriod>(
      config.dateRangeOverride?.relativePeriod ?? "last_30_days",
   );
   const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
      config.dateRangeOverride?.startDate
         ? new Date(config.dateRangeOverride.startDate)
         : undefined,
   );
   const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
      config.dateRangeOverride?.endDate
         ? new Date(config.dateRangeOverride.endDate)
         : undefined,
   );
   const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>(
      config.timeGrouping ?? "month",
   );
   const [comparison, setComparison] = useState<ComparisonType>(
      config.comparison?.type ?? "none",
   );

   // Data filter states
   const [typeFilter, setTypeFilter] = useState<TransactionType>(
      getTransactionTypeFromFilters(initialFilters),
   );
   const [selectedCategories, setSelectedCategories] = useState<string[]>(
      getCategoryIdsFromFilters(initialFilters),
   );
   const [selectedTags, setSelectedTags] = useState<string[]>(
      getTagIdsFromFilters(initialFilters),
   );
   const [selectedBankAccount, setSelectedBankAccount] = useState<string>(
      getBankAccountIdFromFilters(initialFilters),
   );

   // Fetch data for filters
   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );
   const { data: tags = [] } = useQuery(trpc.tags.getAll.queryOptions());
   const { data: bankAccounts = [] } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   // Convert to MultiSelect options
   const categoryOptions = useMemo(
      () => categories.map((c) => ({ label: c.name, value: c.id })),
      [categories],
   );
   const tagOptions = useMemo(
      () => tags.map((t) => ({ label: t.name, value: t.id })),
      [tags],
   );

   // Check which data filters are relevant for the data source
   const showTypeFilter = config.dataSource === "transactions";
   const showCategoryFilter =
      config.dataSource === "transactions" || config.dataSource === "budgets";
   const showTagFilter =
      config.dataSource === "transactions" || config.dataSource === "bills";
   const showBankAccountFilter = config.dataSource === "transactions";

   // Check for time-based changes
   const hasTimeChanges =
      dateRange !==
         (config.dateRangeOverride?.relativePeriod ?? "last_30_days") ||
      timeGrouping !== (config.timeGrouping ?? "month") ||
      comparison !== (config.comparison?.type ?? "none");

   // Check for data filter changes
   const hasDataChanges =
      typeFilter !== getTransactionTypeFromFilters(initialFilters) ||
      JSON.stringify(selectedCategories.sort()) !==
         JSON.stringify(getCategoryIdsFromFilters(initialFilters).sort()) ||
      JSON.stringify(selectedTags.sort()) !==
         JSON.stringify(getTagIdsFromFilters(initialFilters).sort()) ||
      selectedBankAccount !== getBankAccountIdFromFilters(initialFilters);

   const hasChanges = hasTimeChanges || hasDataChanges;

   const handleApply = () => {
      const dataFilters = buildDataFilters(
         typeFilter,
         selectedCategories,
         selectedTags,
         selectedBankAccount,
      );

      onApply({
         dateRangeOverride: {
            relativePeriod: dateRange,
            startDate:
               dateRange === "custom" && customStartDate
                  ? customStartDate.toISOString()
                  : undefined,
            endDate:
               dateRange === "custom" && customEndDate
                  ? customEndDate.toISOString()
                  : undefined,
         },
         timeGrouping,
         comparison: comparison === "none" ? undefined : { type: comparison },
         filters: dataFilters,
      });
      closeCredenza();
   };

   const handleClearFilters = () => {
      // Clear time-based filters
      setDateRange("last_30_days");
      setCustomStartDate(undefined);
      setCustomEndDate(undefined);
      setTimeGrouping("month");
      setComparison("none");
      // Clear data filters
      setTypeFilter("all");
      setSelectedCategories([]);
      setSelectedTags([]);
      setSelectedBankAccount("all");
   };

   const handleCancel = () => {
      closeCredenza();
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle className="flex items-center gap-2">
               <Filter className="h-5 w-5" />
               Filtros do Widget
            </CredenzaTitle>
            <CredenzaDescription>
               Configure o período e comparações
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="max-h-[60vh] overflow-y-auto">
            <div className="space-y-6">
               {hasChanges && (
                  <Button
                     className="w-full flex items-center justify-center gap-2"
                     onClick={handleClearFilters}
                     variant="outline"
                  >
                     <RotateCcw className="size-4" />
                     Limpar filtros
                  </Button>
               )}

               {/* Date Range */}
               <section className="space-y-3">
                  <div className="flex items-center gap-2">
                     <Calendar className="h-4 w-4 text-muted-foreground" />
                     <FieldLabel className="text-sm font-medium m-0">
                        Período
                     </FieldLabel>
                  </div>
                  <Select
                     onValueChange={(value) =>
                        setDateRange(value as RelativePeriod)
                     }
                     value={dateRange}
                  >
                     <SelectTrigger className="w-full h-11">
                        <SelectValue placeholder="Selecione um período" />
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
                              date={customStartDate}
                              onSelect={setCustomStartDate}
                              placeholder="Selecione a data inicial"
                           />
                        </div>
                        <div className="flex flex-col gap-1.5">
                           <FieldLabel className="text-xs text-muted-foreground m-0">
                              Data final
                           </FieldLabel>
                           <DatePicker
                              className="w-full"
                              date={customEndDate}
                              onSelect={setCustomEndDate}
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
                        setTimeGrouping(value as TimeGrouping)
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
                        Comparação
                     </FieldLabel>
                  </div>
                  <div className="space-y-2">
                     <ComparisonOption
                        icon={X}
                        isSelected={comparison === "none"}
                        label="Sem comparação entre períodos"
                        onClick={() => setComparison("none")}
                        value="none"
                     />
                     <ComparisonOption
                        icon={ArrowLeftRight}
                        isSelected={comparison === "previous_period"}
                        label="Comparar com período anterior"
                        onClick={() => setComparison("previous_period")}
                        value="previous_period"
                     />
                     <ComparisonOption
                        icon={CalendarCheck}
                        isSelected={comparison === "previous_year"}
                        label="Comparar com mesmo período do ano anterior"
                        onClick={() => setComparison("previous_year")}
                        value="previous_year"
                     />
                  </div>
               </section>

               {/* Data Filters Separator */}
               {(showTypeFilter ||
                  showCategoryFilter ||
                  showTagFilter ||
                  showBankAccountFilter) && (
                  <div className="border-t pt-2">
                     <FieldLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Filtros de Dados
                     </FieldLabel>
                  </div>
               )}

               {/* Transaction Type Filter */}
               {showTypeFilter && (
                  <section className="space-y-3">
                     <div className="flex items-center gap-2">
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                        <FieldLabel className="text-sm font-medium m-0">
                           Tipo de Transacao
                        </FieldLabel>
                     </div>
                     <ToggleGroup
                        className="flex flex-wrap gap-2"
                        onValueChange={(value) =>
                           value && setTypeFilter(value as TransactionType)
                        }
                        type="single"
                        value={typeFilter}
                        variant="outline"
                     >
                        <ToggleGroupItem
                           className={cn(
                              "px-4 py-2 rounded-full border transition-all",
                              typeFilter === "all" &&
                                 "bg-primary text-primary-foreground border-primary",
                           )}
                           value="all"
                        >
                           Todos
                        </ToggleGroupItem>
                        <ToggleGroupItem
                           className={cn(
                              "px-4 py-2 rounded-full border transition-all gap-1.5",
                              typeFilter === "income" &&
                                 "bg-emerald-500/10 text-emerald-600 border-emerald-500",
                           )}
                           value="income"
                        >
                           <ArrowDownLeft className="h-3.5 w-3.5" />
                           Receita
                        </ToggleGroupItem>
                        <ToggleGroupItem
                           className={cn(
                              "px-4 py-2 rounded-full border transition-all gap-1.5",
                              typeFilter === "expense" &&
                                 "bg-red-500/10 text-red-600 border-red-500",
                           )}
                           value="expense"
                        >
                           <ArrowUpRight className="h-3.5 w-3.5" />
                           Despesa
                        </ToggleGroupItem>
                     </ToggleGroup>
                  </section>
               )}

               {/* Category Filter */}
               {showCategoryFilter && (
                  <section className="space-y-3">
                     <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground" />
                        <FieldLabel className="text-sm font-medium m-0">
                           Categorias
                        </FieldLabel>
                     </div>
                     <MultiSelect
                        onChange={setSelectedCategories}
                        options={categoryOptions}
                        placeholder="Selecione categorias..."
                        selected={selectedCategories}
                     />
                  </section>
               )}

               {/* Tag Filter */}
               {showTagFilter && (
                  <section className="space-y-3">
                     <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <FieldLabel className="text-sm font-medium m-0">
                           Tags
                        </FieldLabel>
                     </div>
                     <MultiSelect
                        onChange={setSelectedTags}
                        options={tagOptions}
                        placeholder="Selecione tags..."
                        selected={selectedTags}
                     />
                  </section>
               )}

               {/* Bank Account Filter */}
               {showBankAccountFilter && bankAccounts.length > 0 && (
                  <section className="space-y-3">
                     <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <FieldLabel className="text-sm font-medium m-0">
                           Conta Bancaria
                        </FieldLabel>
                     </div>
                     <Select
                        onValueChange={setSelectedBankAccount}
                        value={selectedBankAccount}
                     >
                        <SelectTrigger className="w-full h-11">
                           <SelectValue placeholder="Selecione uma conta" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem className="py-2.5" value="all">
                              Todas as contas
                           </SelectItem>
                           {bankAccounts.map((account) => (
                              <SelectItem
                                 className="py-2.5"
                                 key={account.id}
                                 value={account.id}
                              >
                                 {account.name || account.bank}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </section>
               )}
            </div>
         </CredenzaBody>
         <CredenzaFooter>
            <Button onClick={handleCancel} variant="outline">
               Cancelar
            </Button>
            <Button onClick={handleApply}>Aplicar</Button>
         </CredenzaFooter>
      </>
   );
}

type ComparisonOptionProps = {
   value: string;
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
