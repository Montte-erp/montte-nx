import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Separator } from "@packages/ui/components/separator";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import {
   CheckCircle,
   CircleDashed,
   CreditCard,
   Filter,
   PiggyBank,
   TrendingUp,
   X,
} from "lucide-react";
import { useCredenza } from "@/hooks/use-credenza";
import { BankAccountsFilterCredenza } from "../features/bank-accounts-filter-credenza";

type BankAccountsFilterBarProps = {
   statusFilter: string;
   onStatusFilterChange: (value: string) => void;
   typeFilter: string;
   onTypeFilterChange: (value: string) => void;
   onClearFilters: () => void;
   hasActiveFilters: boolean;
};

export function BankAccountsFilterBar({
   statusFilter,
   onStatusFilterChange,
   typeFilter,
   onTypeFilterChange,
   onClearFilters,
   hasActiveFilters,
}: BankAccountsFilterBarProps) {
   const isMobile = useIsMobile();
   const { openCredenza } = useCredenza();

   const activeFilterCount = [statusFilter !== "", typeFilter !== ""].filter(
      Boolean,
   ).length;

   const openFilterCredenza = () => {
      openCredenza({
         children: (
            <BankAccountsFilterCredenza
               hasActiveFilters={hasActiveFilters}
               onClearFilters={onClearFilters}
               onStatusFilterChange={onStatusFilterChange}
               onTypeFilterChange={onTypeFilterChange}
               statusFilter={statusFilter}
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
      <div className="flex flex-wrap items-center gap-3">
         <ToggleGroup
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

         <Separator className="h-6" orientation="vertical" />

         <ToggleGroup
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

         {hasActiveFilters && (
            <>
               <Separator className="h-6" orientation="vertical" />

               <Button
                  className="h-8 text-xs"
                  onClick={onClearFilters}
                  size="sm"
                  variant="outline"
               >
                  <X className="size-3" />
                  Limpar filtros
               </Button>
            </>
         )}
      </div>
   );
}
