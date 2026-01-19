import { Button } from "@packages/ui/components/button";
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

type TagFilterCredenzaProps = {
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
   orderBy: "name" | "createdAt" | "updatedAt";
   orderDirection: "asc" | "desc";
   pageSize?: number;
   onOrderByChange: (value: "name" | "createdAt" | "updatedAt") => void;
   onOrderDirectionChange: (value: "asc" | "desc") => void;
   onPageSizeChange?: (value: number) => void;
   onClearFilters: () => void;
   hasActiveFilters: boolean;
};

export function TagFilterCredenza({
   timePeriod,
   onTimePeriodChange,
   customStartDate,
   customEndDate,
   onCustomStartDateChange,
   onCustomEndDateChange,
   typeFilter,
   onTypeFilterChange,
   orderBy,
   orderDirection,
   pageSize,
   onOrderByChange,
   onOrderDirectionChange,
   onPageSizeChange,
   onClearFilters,
   hasActiveFilters,
}: TagFilterCredenzaProps) {
   const { closeCredenza } = useCredenza();

   const orderByOptions = [
      {
         label: "Nome",
         value: "name" as const,
      },
      {
         label: "Data de Criação",
         value: "createdAt" as const,
      },
      {
         label: "Data de Atualização",
         value: "updatedAt" as const,
      },
   ];

   const orderDirectionOptions = [
      {
         label: "Crescente",
         value: "asc" as const,
      },
      {
         label: "Decrescente",
         value: "desc" as const,
      },
   ];

   const handlePeriodClick = (period: TimePeriod) => {
      const range = getDateRangeForPeriod(period);
      onTimePeriodChange(period, range);
   };

   const isCustomMode = timePeriod === "custom";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Filtrar Tags</CredenzaTitle>
            <CredenzaDescription>
               Refine a lista de tags com base em critérios específicos.
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
                     <FieldLabel>Ordenar por</FieldLabel>
                     <Select
                        onValueChange={(
                           value: "name" | "createdAt" | "updatedAt",
                        ) => onOrderByChange(value)}
                        value={orderBy}
                     >
                        <SelectTrigger>
                           <SelectValue placeholder="Selecione o campo" />
                        </SelectTrigger>
                        <SelectContent>
                           {orderByOptions.map((option) => (
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
                     <FieldLabel>Direção da Ordenação</FieldLabel>
                     <Select
                        onValueChange={(value: "asc" | "desc") =>
                           onOrderDirectionChange(value)
                        }
                        value={orderDirection}
                     >
                        <SelectTrigger>
                           <SelectValue placeholder="Selecione a direção" />
                        </SelectTrigger>
                        <SelectContent>
                           {orderDirectionOptions.map((option) => (
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

               {onPageSizeChange && (
                  <FieldGroup>
                     <Field>
                        <FieldLabel>Itens por Página</FieldLabel>
                        <Select
                           onValueChange={(value) =>
                              onPageSizeChange(Number(value))
                           }
                           value={pageSize?.toString()}
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
