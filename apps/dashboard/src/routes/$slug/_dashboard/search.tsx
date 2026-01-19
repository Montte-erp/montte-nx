import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@/pages/search/ui/search-page";

export const Route = createFileRoute("/$slug/_dashboard/search")({
   beforeLoad: () => ({
      breadcrumb: "Busca",
   }),
   component: RouteComponent,
});

function RouteComponent() {
   return <SearchPage />;
}
