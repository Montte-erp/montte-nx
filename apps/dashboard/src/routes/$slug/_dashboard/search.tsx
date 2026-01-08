import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@/pages/search/ui/search-page";

export const Route = createFileRoute("/$slug/_dashboard/search")({
	component: RouteComponent,
	staticData: {
		breadcrumb: "Search",
	},
});

function RouteComponent() {
	return <SearchPage />;
}
