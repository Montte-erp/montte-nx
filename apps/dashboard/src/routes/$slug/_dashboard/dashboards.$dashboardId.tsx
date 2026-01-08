import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/pages/dashboards/ui/dashboard-page";

export const Route = createFileRoute("/$slug/_dashboard/dashboards/$dashboardId")(
	{
		component: RouteComponent,
		staticData: {
			breadcrumb: "Dashboard",
		},
	},
);

function RouteComponent() {
	const { dashboardId } = Route.useParams();
	return <DashboardPage dashboardId={dashboardId} />;
}
