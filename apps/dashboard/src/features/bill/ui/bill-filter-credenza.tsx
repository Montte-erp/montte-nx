import { Button } from "@packages/ui/components/button";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
   CredenzaDescription,
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
import { cn } from "@packages/ui/lib/utils";
import { X } from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";

type BillFilterCredenzaProps = {
   categories: Array<{
      id: string;
      name: string;
      color: string;
      icon: string | null;
   }>;
   bankAccounts: Array<{
      id: string;
      name: string | null;
      bank: string;
   }>;
   categoryFilter: string;
   statusFilter: string;
   typeFilter: string;
   bankAccountFilter: string;
   customStartDate: Date | null;
   customEndDate: Date | null;
   pageSize: number;
   timePeriod: TimePeriod | null;
   hasActiveFilters: boolean;
   onCategoryFilterChange: (value: string) => void;
   onStatusFilterChange: (value: string) => void;
   onTypeFilterChange: (value: string) => void;
   onBankAccountFilterChange: (value: string) => void;
   onCustomStartDateChange: (date: Date | undefined) => void;
   onCustomEndDateChange: (date: Date | undefined) => void;
   onPageSizeChange: (size: number) => void;
   onTimePeriodChange: (
      period: TimePeriod | null,
      range: TimePeriodDateRange,
   ) => void;
   onClearFilters: () => void;
};

export function BillFilterCredenza({
   categories,
   bankAccounts,
   categoryFilter,
   statusFilter,
   typeFilter,
   bankAccountFilter,
   customStartDate,
   customEndDate,
   pageSize,
   timePeriod,
   hasActiveFilters,
   onCategoryFilterChange,
   onStatusFilterChange,
   onTypeFilterChange,
   onBankAccountFilterChange,
   onCustomStartDateChange,
   onCustomEndDateChange,
   onPageSizeChange,
   onTimePeriodChange,
   onClearFilters,
}: BillFilterCredenzaProps) {
   const { closeCredenza } = useCredenza();

   const categoryOptions = [
      {
         label: "Todas as categorias",
         value: "all",
      },
      ...categories.map((category) => ({
         label: category.name,
         value: category.id,
      })),
   ];

   const statusOptions = [
      {
         label: "Todos os status",
         value: "all",
      },
      {
         label: "Pendente",
         value: "pending",
      },
      {
         label: "Vencida",
         value: "overdue",
      },
      {
         label: "Concluída",
         value: "completed",
      },
   ];

   const typeOptions = [
      {
         label: "Todos os tipos",
         value: "all",
      },
      {
         label: "A Pagar",
         value: "expense",
      },
      {
         label: "A Receber",
         value: "income",
      },
   ];

   const handleClearFilters = () => {
      onClearFilters();
      closeCredenza();
   };

   const handleTimePeriodSelect = (period: TimePeriod) => {
      const range = getDateRangeForPeriod(period);
      onTimePeriodChange(period, range);
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               Filtrar Contas
            </CredenzaTitle>
            <CredenzaDescription>
               Use os filtros abaixo para encontrar contas específicas
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="grid gap-4">
               {hasActiveFilters && (
                  <div className="flex justify-end">
                     <Button
                        className="w-full flex items-center justify-center gap-2"
                        onClick={handleClearFilters}
                        variant="outline"
                     >
                        <X className="size-4" />
                        Limpar Filtros
                     </Button>
                  </div>
               )}

               {/* Time Period Grid */}
               <FieldGroup>
                  <FieldLabel>
                     Período
                  </FieldLabel>
                  <div className="grid grid-cols-3 gap-2">
                     {TIME_PERIODS.map((period) => (
                        <Button
                           className={cn(
                              "h-auto py-2 px-3 justify-start",
                              timePeriod === period.value &&
                                 "border-primary bg-primary/5",
                           )}
                           key={period.value}
                           onClick={() => handleTimePeriodSelect(period.value)}
                           size="sm"
                           variant="outline"
                        >
                           <span className="text-xs">{period.label}</span>
                        </Button>
                     ))}
                  </div>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Status
                     </FieldLabel>
                     <Select
                        onValueChange={onStatusFilterChange}
                        value={statusFilter}
                     >
                        <SelectTrigger>
                           <SelectValue
                              placeholder="Selecione um status"
                           />
                        </SelectTrigger>
                        <SelectContent>
                           {statusOptions.map((option) => (
                              <SelectItem
                                 key={option.value}
                                 value={option.value}
                              >
                                 {option.label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Tipo
                     </FieldLabel>
                     <Select
                        onValueChange={onTypeFilterChange}
                        value={typeFilter}
                     >
                        <SelectTrigger>
                           <SelectValue
                              placeholder="Selecione um tipo"
                           />
                        </SelectTrigger>
                        <SelectContent>
                           {typeOptions.map((option) => (
                              <SelectItem
                                 key={option.value}
                                 value={option.value}
                              >
                                 {option.label}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Categoria
                     </FieldLabel>
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

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Conta Bancária
                     </FieldLabel>
                     <Select
                        onValueChange={onBankAccountFilterChange}
                        value={bankAccountFilter}
                     >
                        <SelectTrigger>
                           <SelectValue
                              placeholder="Selecione uma conta"
                           />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="all">
                              Todas as contas
                           </SelectItem>
                           {bankAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                 {account.name || account.bank}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Data Inicial
                     </FieldLabel>
                     <DatePicker
                        date={customStartDate ?? undefined}
                        onSelect={onCustomStartDateChange}
                        placeholder="Selecione a data inicial"
                     />
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Data Final
                     </FieldLabel>
                     <DatePicker
                        date={customEndDate ?? undefined}
                        onSelect={onCustomEndDateChange}
                        placeholder="Selecione a data final"
                     />
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Itens por página
                     </FieldLabel>
                     <Select
                        onValueChange={(value) =>
                           onPageSizeChange(Number(value))
                        }
                        value={pageSize.toString()}
                     >
                        <SelectTrigger>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {[5, 10, 20, 30, 50].map((size) => (
                              <SelectItem key={size} value={size.toString()}>
                                 {size}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               </FieldGroup>
            </div>
         </CredenzaBody>
      </>
   );
}
