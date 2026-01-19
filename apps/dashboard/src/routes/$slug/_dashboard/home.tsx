import { createFileRoute, redirect } from "@tanstack/react-router";
import { getQueryClient, trpc } from "@/integrations/clients";

export const Route = createFileRoute("/$slug/_dashboard/home")({
   beforeLoad: async ({ params }) => {
      const queryClient = getQueryClient();

      try {
         // Fetch the default dashboard (creates one if it doesn't exist)
         const defaultDashboard = await queryClient.fetchQuery(
            trpc.dashboards.getDefault.queryOptions(),
         );

         if (defaultDashboard?.id) {
            // Redirect to the default dashboard
            throw redirect({
               params: { slug: params.slug, dashboardId: defaultDashboard.id },
               replace: true,
               to: "/$slug/dashboards/$dashboardId",
            });
         }

         // Fallback to dashboards list if no default dashboard
         throw redirect({
            params: { slug: params.slug },
            replace: true,
            to: "/$slug/dashboards",
         });
      } catch (error) {
         // Re-throw redirects
         if (
            error instanceof Response ||
            (typeof error === "object" &&
               error !== null &&
               "isRedirect" in error)
         ) {
            throw error;
         }

         // On error, redirect to dashboards list
         throw redirect({
            params: { slug: params.slug },
            replace: true,
            to: "/$slug/dashboards",
         });
      }
   },
   component: () => null, // Never rendered due to redirect
   staticData: {
      breadcrumb: "Home",
   },
});
