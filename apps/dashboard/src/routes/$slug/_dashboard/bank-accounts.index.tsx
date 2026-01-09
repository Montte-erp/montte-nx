import { createFileRoute } from "@tanstack/react-router";
import { BankAccountsPage } from "@/pages/bank-accounts/ui/bank-accounts-page";

export const Route = createFileRoute("/$slug/_dashboard/bank-accounts/")({
   component: RouteComponent,
   staticData: {
      breadcrumb: "Contas Bancárias",
   },
});

function RouteComponent() {
   return <BankAccountsPage />;
}
