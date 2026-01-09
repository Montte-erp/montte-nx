import { createFileRoute } from "@tanstack/react-router";
import { BudgetsPage } from "@/pages/budgets/ui/budgets-page";

export const Route = createFileRoute("/$slug/_dashboard/budgets/")({
   component: BudgetsPage,
   staticData: {
      breadcrumb: "Orçamentos",
   },
});
