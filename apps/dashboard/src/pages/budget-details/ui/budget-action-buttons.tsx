import type { RouterOutput } from "@packages/api/client";
import { translate } from "@packages/localization";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Tooltip,
   TooltipContent,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { CircleDot, Edit, HelpCircle, RefreshCw, Trash2 } from "lucide-react";
import { useSheet } from "@/hooks/use-sheet";
import { ManageBudgetForm } from "@/pages/budgets/features/manage-budget-form";
import { useDeleteBudget } from "@/pages/budgets/features/use-delete-budget";
import { useToggleBudgetStatus } from "@/pages/budgets/features/use-toggle-budget-status";
import { useToggleRollover } from "@/pages/budgets/features/use-toggle-rollover";

type Budget = RouterOutput["budgets"]["getById"];

type BudgetActionButtonsProps = {
   budget: Budget;
   onDeleteSuccess?: () => void;
};

export function BudgetActionButtons({
   budget,
   onDeleteSuccess,
}: BudgetActionButtonsProps) {
   const { openSheet } = useSheet();

   const budgetForList = {
      ...budget,
      periods: budget?.currentPeriod ? [budget.currentPeriod] : [],
   };

   const { deleteBudget } = useDeleteBudget({
      budget: budgetForList,
      onSuccess: onDeleteSuccess,
   });
   const { isUpdating: isStatusUpdating, toggleStatus } = useToggleBudgetStatus(
      { budget: budgetForList },
   );
   const { isUpdating: isRolloverUpdating, toggleRollover } = useToggleRollover(
      { budget },
   );

   const regimeLabels: Record<string, string> = {
      accrual: translate("dashboard.routes.budgets.form.regime.accrual"),
      cash: translate("dashboard.routes.budgets.form.regime.cash"),
   };

   return (
      <div className="flex flex-wrap items-center gap-2">
         <Button
            onClick={() =>
               openSheet({
                  children: <ManageBudgetForm budget={budgetForList} />,
               })
            }
            size="sm"
            variant="outline"
         >
            <Edit className="size-4" />
            {translate("dashboard.routes.budgets.details.actions.edit")}
         </Button>

         <Button
            className="text-destructive hover:text-destructive"
            onClick={deleteBudget}
            size="sm"
            variant="outline"
         >
            <Trash2 className="size-4" />
            {translate("dashboard.routes.budgets.details.actions.delete")}
         </Button>

         <div className="h-4 w-px bg-border" />

         <Button
            className="gap-2"
            disabled={isStatusUpdating}
            onClick={toggleStatus}
            size="sm"
            variant="outline"
         >
            <CircleDot className="size-4" />
            {translate("dashboard.routes.budgets.details.information.status")}
            <Badge variant={budget.isActive ? "default" : "secondary"}>
               {budget.isActive
                  ? translate("dashboard.routes.budgets.status.active")
                  : translate("dashboard.routes.budgets.status.inactive")}
            </Badge>
         </Button>

         <Button
            className="gap-2"
            disabled={isRolloverUpdating}
            onClick={toggleRollover}
            size="sm"
            variant="outline"
         >
            <RefreshCw className="size-4" />
            {translate("dashboard.routes.budgets.details.information.rollover")}
            <Badge variant={budget.rollover ? "default" : "secondary"}>
               {budget.rollover
                  ? translate(
                       "dashboard.routes.budgets.details.information.rollover-enabled",
                    )
                  : translate(
                       "dashboard.routes.budgets.details.information.rollover-disabled",
                    )}
            </Badge>
         </Button>

         <Tooltip>
            <TooltipTrigger asChild>
               <Badge className="cursor-help gap-1" variant="outline">
                  {regimeLabels[budget.regime] ?? budget.regime}
                  <HelpCircle className="size-3" />
               </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
               {budget.regime === "cash"
                  ? translate("dashboard.routes.budgets.regime-tooltip.cash")
                  : translate(
                       "dashboard.routes.budgets.regime-tooltip.accrual",
                    )}
            </TooltipContent>
         </Tooltip>
      </div>
   );
}
