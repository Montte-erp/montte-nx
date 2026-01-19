import { createFileRoute } from "@tanstack/react-router";
import { InsightViewerPage } from "@/pages/insights/ui/insight-viewer-page";

export const Route = createFileRoute("/$slug/_dashboard/insights/$insightId")({
   component: RouteComponent,
   staticData: {
      breadcrumb: "Insight",
   },
});

function RouteComponent() {
   const { insightId } = Route.useParams();
   return <InsightViewerPage insightId={insightId} />;
}
