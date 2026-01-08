import { createFileRoute } from "@tanstack/react-router";
import { DashboardsListPage } from "@/pages/dashboards/ui/dashboards-list-page";

export const Route = createFileRoute("/$slug/_dashboard/dashboards/")({
	component: RouteComponent,
	staticData: {
		breadcrumb: "Dashboards",
	},
});

function RouteComponent() {
	return <DashboardsListPage />;
}
