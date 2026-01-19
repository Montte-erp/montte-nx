import { createFileRoute } from "@tanstack/react-router";
import { CounterpartiesPage } from "@/pages/counterparties/ui/counterparties-page";

export const Route = createFileRoute("/$slug/_dashboard/counterparties/")({
   component: CounterpartiesPage,
   staticData: {
      breadcrumb: "Cadastros",
   },
});
