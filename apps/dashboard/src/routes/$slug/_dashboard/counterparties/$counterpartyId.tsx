import { createFileRoute } from "@tanstack/react-router";
import { CounterpartyDetailsPage } from "@/pages/counterparty-details/ui/counterparty-details-page";

export const Route = createFileRoute(
   "/$slug/_dashboard/counterparties/$counterpartyId",
)({
   component: CounterpartyDetailsPage,
   staticData: {
      breadcrumb: "Cadastros",
   },
});
