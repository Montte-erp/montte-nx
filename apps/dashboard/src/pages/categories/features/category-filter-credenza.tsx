import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   type TimePeriod,
   type TimePeriodDateRange,
} from "@packages/ui/components/time-period-chips";
import { X } from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";

type CategoryFilterCredenzaProps = {
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

export function CategoryFilterCredenza({
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
}: CategoryFilterCredenzaProps) {
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
            <CredenzaTitle>Filtrar Categorias</CredenzaTitle>
            <CredenzaDescription>
               Refine a lista de categorias com base em critérios específicos.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <div className="grid gap-4">
               {hasActiveFilters && (
                  <div className="flex justify-end">
                     <Button
                        className="w-full flex items-center justify-center gap-2"
                        onClick={onClearFilters}
                     >
                        <X className="size-4" />
                        Limpar Filtros
                     </Button>
                  </div>
               )}

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
                              onPageSizeChange?.(Number(value))
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
      </>
   );
}
