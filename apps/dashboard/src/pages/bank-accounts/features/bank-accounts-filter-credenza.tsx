import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import {
   CheckCircle,
   CircleDashed,
   CreditCard,
   PiggyBank,
   TrendingUp,
   X,
} from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";

interface BankAccountsFilterCredenzaProps {
   statusFilter: string;
   onStatusFilterChange: (value: string) => void;
   typeFilter: string;
   onTypeFilterChange: (value: string) => void;
   onClearFilters: () => void;
   hasActiveFilters: boolean;
}

export function BankAccountsFilterCredenza({
   statusFilter,
   onStatusFilterChange,
   typeFilter,
   onTypeFilterChange,
   onClearFilters,
   hasActiveFilters,
}: BankAccountsFilterCredenzaProps) {
   const { closeCredenza } = useCredenza();

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Filtros</CredenzaTitle>
            <CredenzaDescription>
               Filtre as contas bancárias por status e tipo.
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
                     Limpar todos
                  </Button>
               )}

               <FieldGroup>
                  <Field>
                     <FieldLabel>Status</FieldLabel>
                     <ToggleGroup
                        className="justify-start"
                        onValueChange={onStatusFilterChange}
                        size="sm"
                        spacing={2}
                        type="single"
                        value={statusFilter}
                        variant="outline"
                     >
                        <ToggleGroupItem
                           className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600"
                           value="active"
                        >
                           <CheckCircle className="size-3.5" />
                           Ativa
                        </ToggleGroupItem>
                        <ToggleGroupItem
                           className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-muted-foreground data-[state=on]:text-muted-foreground"
                           value="inactive"
                        >
                           <CircleDashed className="size-3.5" />
                           Inativa
                        </ToggleGroupItem>
                     </ToggleGroup>
                  </Field>
               </FieldGroup>

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
                           className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-primary data-[state=on]:text-primary"
                           value="checking"
                        >
                           <CreditCard className="size-3.5" />
                           Conta corrente
                        </ToggleGroupItem>
                        <ToggleGroupItem
                           className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-primary data-[state=on]:text-primary"
                           value="savings"
                        >
                           <PiggyBank className="size-3.5" />
                           Conta poupança
                        </ToggleGroupItem>
                        <ToggleGroupItem
                           className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-primary data-[state=on]:text-primary"
                           value="investment"
                        >
                           <TrendingUp className="size-3.5" />
                           Conta de investimento
                        </ToggleGroupItem>
                     </ToggleGroup>
                  </Field>
               </FieldGroup>
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
