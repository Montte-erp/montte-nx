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

type CostCenterFilterCredenzaProps = {
   orderBy: "name" | "code" | "createdAt" | "updatedAt";
   orderDirection: "asc" | "desc";
   pageSize?: number;
   onOrderByChange: (
      value: "name" | "code" | "createdAt" | "updatedAt",
   ) => void;
   onOrderDirectionChange: (value: "asc" | "desc") => void;
   onPageSizeChange?: (value: number) => void;
};

export function CostCenterFilterCredenza({
   orderBy,
   orderDirection,
   pageSize,
   onOrderByChange,
   onOrderDirectionChange,
   onPageSizeChange,
}: CostCenterFilterCredenzaProps) {
   const { closeCredenza } = useCredenza();

   const orderByOptions = [
      {
         label: "Nome",
         value: "name" as const,
      },
      {
         label: "Código",
         value: "code" as const,
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

   const hasActiveFilters = orderBy !== "name" || orderDirection !== "asc";

   const clearFilters = () => {
      onOrderByChange("name");
      onOrderDirectionChange("asc");
      closeCredenza();
   };

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               Filtrar Centros de Custo
            </CredenzaTitle>
            <CredenzaDescription>
               Refine a lista de centros de custo com base em critérios específicos.
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
                        Limpar Filtros
                     </Button>
                  </div>
               )}
               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Ordenar por
                     </FieldLabel>
                     <Select
                        onValueChange={(
                           value: "name" | "code" | "createdAt" | "updatedAt",
                        ) => onOrderByChange(value)}
                        value={orderBy}
                     >
                        <SelectTrigger>
                           <SelectValue
                              placeholder="Selecione o campo"
                           />
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
                     <FieldLabel>
                        Direção da Ordenação
                     </FieldLabel>
                     <Select
                        onValueChange={(value: "asc" | "desc") =>
                           onOrderDirectionChange(value)
                        }
                        value={orderDirection}
                     >
                        <SelectTrigger>
                           <SelectValue
                              placeholder="Selecione a direção"
                           />
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
                     <FieldLabel>
                        Itens por Página
                     </FieldLabel>
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
