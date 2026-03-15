import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { DashboardLayout } from "@/layout/dashboard/ui/dashboard-layout";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard",
)({
   ssr: "data-only",
   beforeLoad: async ({ context }) => {
      const status = await context.queryClient.fetchQuery(
         context.orpc.onboarding.getOnboardingStatus.queryOptions(),
      );

      if (
         !status.organization.onboardingCompleted ||
         !status.project.onboardingCompleted
      ) {
         throw redirect({ to: "/onboarding" });
      }
   },
   loader: async ({ context }) => {
      await context.queryClient.prefetchQuery(
         context.orpc.earlyAccess.getEnrolledFeatures.queryOptions(),
      );
   },
   component: DashboardLayoutRoute,
});

function DashboardLayoutRoute() {
   return (
      <DashboardLayout>
         <Outlet />
      </DashboardLayout>
   );
}
