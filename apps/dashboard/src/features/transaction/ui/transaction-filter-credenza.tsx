import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   getDateRangeForPeriod,
   TIME_PERIODS,
   type TimePeriod,
   type TimePeriodDateRange,
} from "@packages/ui/components/time-period-chips";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { cn } from "@packages/ui/lib/utils";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, X } from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";

type TransactionFilterCredenzaProps = {
   timePeriod: TimePeriod | null;
   onTimePeriodChange: (
      period: TimePeriod | null,
      range: TimePeriodDateRange,
   ) => void;
   customStartDate?: Date | null;
   customEndDate?: Date | null;
   onCustomStartDateChange: (date: Date | undefined) => void;
   onCustomEndDateChange: (date: Date | undefined) => void;
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
   bankAccountFilter?: string;
   onBankAccountFilterChange?: (value: string) => void;
   bankAccounts?: Array<{
      id: string;
      name: string | null;
      bank: string;
   }>;
   onClearFilters: () => void;
   hasActiveFilters: boolean;
};

export function TransactionFilterCredenza({
   timePeriod,
   onTimePeriodChange,
   customStartDate,
   customEndDate,
   onCustomStartDateChange,
   onCustomEndDateChange,
   typeFilter,
   onTypeFilterChange,
   categoryFilter,
   onCategoryFilterChange,
   categories,
   bankAccountFilter = "all",
   onBankAccountFilterChange,
   bankAccounts = [],
   onClearFilters,
   hasActiveFilters,
}: TransactionFilterCredenzaProps) {
   const { closeCredenza } = useCredenza();

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

   const handlePeriodClick = (period: TimePeriod) => {
      const range = getDateRangeForPeriod(period);
      onTimePeriodChange(period, range);
   };

   const isCustomMode = timePeriod === "custom";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Filtros</CredenzaTitle>
            <CredenzaDescription>
               Refine os resultados com filtros
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="grid gap-4">
               {hasActiveFilters && (
                  <Button
                     className="w-full flex items-center justify-center gap-2"
                     onClick={onClearFilters}
                     variant="outline"
                  >
                     <X className="size-4" />
                     Limpar Filtros
                  </Button>
               )}

               <FieldGroup>
                  <Field>
                     <FieldLabel>Período</FieldLabel>
                     <div className="grid grid-cols-2 gap-2">
                        {TIME_PERIODS.map((period) => {
                           const Icon = period.icon;
                           const isSelected = timePeriod === period.value;
                           return (
                              <Button
                                 className={cn(
                                    "justify-start gap-2",
                                    isSelected &&
                                       "bg-primary/10 border-primary text-primary",
                                 )}
                                 key={period.value}
                                 onClick={() => handlePeriodClick(period.value)}
                                 size="sm"
                                 variant="outline"
                              >
                                 <Icon className="size-3.5" />
                                 {period.label}
                              </Button>
                           );
                        })}
                        <Button
                           className={cn(
                              "justify-start gap-2 col-span-2",
                              isCustomMode &&
                                 "bg-primary/10 border-primary text-primary",
                           )}
                           onClick={() =>
                              onTimePeriodChange("custom", {
                                 endDate: customEndDate || null,
                                 selectedMonth: new Date(),
                                 startDate: customStartDate || null,
                              })
                           }
                           size="sm"
                           variant="outline"
                        >
                           Personalizado
                        </Button>
                     </div>
                  </Field>
               </FieldGroup>

               {isCustomMode && (
                  <FieldGroup>
                     <Field>
                        <FieldLabel>Data Inicial</FieldLabel>
                        <DatePicker
                           date={customStartDate || undefined}
                           onSelect={onCustomStartDateChange}
                           placeholder="Selecione uma data"
                        />
                     </Field>
                     <Field>
                        <FieldLabel>Data Final</FieldLabel>
                        <DatePicker
                           date={customEndDate || undefined}
                           onSelect={onCustomEndDateChange}
                           placeholder="Selecione uma data"
                        />
                     </Field>
                  </FieldGroup>
               )}

               <FieldGroup>
                  <Field>
                     <FieldLabel>Tipo</FieldLabel>
                     <ToggleGroup
                        className="justify-start"
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
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>Categoria</FieldLabel>
                     <Combobox
                        emptyMessage="Nenhum resultado encontrado"
                        onValueChange={onCategoryFilterChange}
                        options={categoryOptions}
                        placeholder="Selecione uma categoria"
                        searchPlaceholder="Pesquisar"
                        value={categoryFilter}
                     />
                  </Field>
               </FieldGroup>

               {bankAccounts.length > 0 && onBankAccountFilterChange && (
                  <FieldGroup>
                     <Field>
                        <FieldLabel>Conta Bancária</FieldLabel>
                        <Select
                           onValueChange={onBankAccountFilterChange}
                           value={bankAccountFilter}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Selecione uma conta" />
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
                     </Field>
                  </FieldGroup>
               )}
            </div>
         </CredenzaBody>

         <CredenzaFooter>
            <Button onClick={() => closeCredenza()} variant="outline">
               Fechar
            </Button>
         </CredenzaFooter>
      </>
   );
}
