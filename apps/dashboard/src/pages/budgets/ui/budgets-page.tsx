import type { RouterOutput } from "@packages/api/client";
import { Button } from "@packages/ui/components/button";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { cn } from "@packages/ui/lib/utils";
import {
   Calendar,
   CalendarDays,
   CalendarRange,
   Infinity as InfinityIcon,
   Plus,
   RotateCcw,
} from "lucide-react";
import { DefaultHeader } from "@/default/default-header";
import { useSheet } from "@/hooks/use-sheet";
import {
   BudgetListProvider,
   type BudgetPeriodType,
   useBudgetList,
} from "../features/budget-list-context";
import { ManageBudgetForm } from "../features/manage-budget-form";
import { BudgetsListSection } from "./budgets-list-section";
import { BudgetsStats } from "./budgets-stats";

export type Budget = RouterOutput["budgets"]["getAllPaginated"]["budgets"][0];

function BudgetsPageContent() {
   const { openSheet } = useSheet();
   const { periodType, setPeriodType } = useBudgetList();

   const periodChips = [
      {
         icon: InfinityIcon,
         label: "Todos",
         value: "" as const,
      },
      {
         icon: Calendar,
         label: "Diário",
         value: "daily" as const,
      },
      {
         icon: CalendarRange,
         label: "Semanal",
         value: "weekly" as const,
      },
      {
         icon: CalendarDays,
         label: "Mensal",
         value: "monthly" as const,
      },
      {
         icon: RotateCcw,
         label: "Trimestral",
         value: "quarterly" as const,
      },
      {
         icon: CalendarDays,
         label: "Anual",
         value: "yearly" as const,
      },
   ];

   return (
      <main className="space-y-4">
         <DefaultHeader
            actions={
               <Button
                  onClick={() => openSheet({ children: <ManageBudgetForm /> })}
               >
                  <Plus className="size-4" />
                  Novo orçamento
               </Button>
            }
            description="Gerencie seus orçamentos e acompanhe a evolução dos seus gastos"
            title="Orçamentos"
         />

         <ToggleGroup
            className="flex-wrap justify-start"
            onValueChange={(value) =>
               setPeriodType((value || null) as BudgetPeriodType | null)
            }
            size="sm"
            spacing={2}
            type="single"
            value={periodType || ""}
            variant="outline"
         >
            {periodChips.map((chip) => {
               const Icon = chip.icon;
               return (
                  <ToggleGroupItem
                     aria-label={`Toggle ${chip.value || "all"}`}
                     className={cn(
                        "gap-1.5 data-[state=on]:bg-transparent data-[state=on]:text-primary data-[state=on]:*:[svg]:stroke-primary",
                        "text-xs px-2 h-7",
                     )}
                     key={chip.value || "all"}
                     value={chip.value}
                  >
                     <Icon className="size-3" />
                     {chip.label}
                  </ToggleGroupItem>
               );
            })}
         </ToggleGroup>

         <BudgetsStats />
         <BudgetsListSection />
      </main>
   );
}

export function BudgetsPage() {
   return (
      <BudgetListProvider>
         <BudgetsPageContent />
      </BudgetListProvider>
   );
}
