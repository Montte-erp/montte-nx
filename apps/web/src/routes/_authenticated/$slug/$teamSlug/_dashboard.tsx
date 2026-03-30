import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import posthog from "posthog-js";
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
   onEnter: async ({ context }) => {
      const userId = context.session.user.id
      const organizationId = context.session.session?.activeOrganizationId;
      if (userId) {
         posthog.identify(userId, {
            email: userId ?? undefined,
            name: userId ?? undefined,
         });
         if (organizationId) {
            posthog.group("organization", organizationId);
         }
      }

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
