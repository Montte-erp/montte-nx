import { createFileRoute } from "@tanstack/react-router";
import { InsightsListPage } from "@/pages/insights/ui/insights-list-page";

export const Route = createFileRoute("/$slug/_dashboard/insights/")({
   component: RouteComponent,
   staticData: {
      breadcrumb: "Insights",
   },
});

function RouteComponent() {
   return <InsightsListPage />;
}
