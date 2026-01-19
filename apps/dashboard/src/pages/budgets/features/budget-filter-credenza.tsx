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
import { X } from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";

type BudgetFilterCredenzaProps = {
   orderBy: "name" | "createdAt" | "updatedAt" | "amount";
   orderDirection: "asc" | "desc";
   pageSize?: number;
   activeFilter?: boolean;
   onOrderByChange: (
      value: "name" | "createdAt" | "updatedAt" | "amount",
   ) => void;
   onOrderDirectionChange: (value: "asc" | "desc") => void;
   onPageSizeChange?: (value: number) => void;
   onActiveFilterChange?: (value: boolean | undefined) => void;
};

export function BudgetFilterCredenza({
   orderBy,
   orderDirection,
   pageSize,
   activeFilter,
   onOrderByChange,
   onOrderDirectionChange,
   onPageSizeChange,
   onActiveFilterChange,
}: BudgetFilterCredenzaProps) {
   const { closeCredenza } = useCredenza();

   const orderByOptions = [
      {
         label: "Nome",
         value: "name" as const,
      },
      {
         label: "Valor limite",
         value: "amount" as const,
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

   const hasActiveFilters =
      orderBy !== "name" ||
      orderDirection !== "asc" ||
      activeFilter !== undefined;

   const clearFilters = () => {
      onOrderByChange("name");
      onOrderDirectionChange("asc");
      onActiveFilterChange?.(undefined);
      closeCredenza();
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Filtrar orçamentos</CredenzaTitle>
            <CredenzaDescription>
               Filtre os orçamentos por diferentes critérios
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <div className="grid gap-4">
               {hasActiveFilters && (
                  <div className="flex justify-end">
                     <Button
                        className="w-full flex items-center justify-center gap-2"
                        onClick={clearFilters}
                     >
                        <X className="size-4" />
                        Limpar filtros
                     </Button>
                  </div>
               )}

               <FieldGroup>
                  <Field>
                     <FieldLabel>Ordenar por</FieldLabel>
                     <Select
                        onValueChange={(
                           value: "name" | "createdAt" | "updatedAt" | "amount",
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
            </div>
         </CredenzaBody>
      </>
   );
}
