import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createClientOnlyFn } from "@tanstack/react-start";
import type { QueryClient } from "@tanstack/react-query";
import posthog from "posthog-js";
import { authClient } from "@/integrations/better-auth/auth-client";
import type { orpc as orpcClient } from "@/integrations/orpc/client";
import { DashboardLayout } from "./-layout/dashboard-layout";

const ensureActiveTeam = createClientOnlyFn(
   async (queryClient: QueryClient, orpc: typeof orpcClient) => {
      const session = await queryClient.fetchQuery(
         orpc.session.getSession.queryOptions({}),
      );
      if (session?.session.activeTeamId) return;

      const teams = await queryClient.fetchQuery(
         orpc.organization.getOrganizationTeams.queryOptions({}),
      );
      const firstTeamId = teams[0]?.id;
      if (!firstTeamId) return;

      await authClient.organization.setActiveTeam({ teamId: firstTeamId });
      await queryClient.invalidateQueries({
         queryKey: orpc.session.getSession.queryKey({}),
      });
   },
);

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

      await ensureActiveTeam(context.queryClient, context.orpc);
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
