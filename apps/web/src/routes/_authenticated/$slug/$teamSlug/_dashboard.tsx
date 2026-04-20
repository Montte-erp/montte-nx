import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { z } from "zod";
import posthog from "posthog-js";
import { DashboardLayout } from "@/layout/dashboard/ui/dashboard-layout";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard",
)({
   validateSearch: z.object({
      sidebarTab: z
         .enum(["navegar", "assistente"])
         .catch("navegar")
         .default("navegar"),
   }),
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
   onEnter: ({ context }) => {
      const { user, session } = context.session;
      posthog.identify(user.id, {
         email: user.email ?? undefined,
         name: user.name ?? undefined,
      });
      const organizationId = session?.activeOrganizationId;
      if (organizationId) {
         posthog.group("organization", organizationId);
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
