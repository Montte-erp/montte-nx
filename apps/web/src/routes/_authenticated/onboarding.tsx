import { createFileRoute, redirect } from "@tanstack/react-router";
import { OnboardingWizard } from "./-onboarding/onboarding-wizard";

export const Route = createFileRoute("/_authenticated/onboarding")({
   beforeLoad: async ({ context }) => {
      // biome-ignore lint/suspicious/noImplicitAnyLet: assigned inside try-catch
      let session;

      try {
         session = await context.queryClient.fetchQuery(
            context.orpc.session.getSession.queryOptions({}),
         );
      } catch {
         throw redirect({ to: "/auth/sign-in" });
      }

      if (!session?.user?.id) {
         throw redirect({ to: "/auth/sign-in" });
      }

      const organizations = await context.queryClient.fetchQuery(
         context.orpc.organization.getOrganizations.queryOptions(),
      );

      // Find active org or first org
      const activeOrg =
         organizations.find(
            (org) => org.id === session.session.activeOrganizationId,
         ) ?? organizations[0];

      // If the user already has an org, fix any stale onboarding flags so the
      // dashboard guards won't loop them back here.
      if (activeOrg) {
         let fixed: { orgSlug: string; teamSlug: string } | null = null;

         try {
            fixed = await context.queryClient.fetchQuery(
               context.orpc.onboarding.fixOnboarding.queryOptions({
                  input: { organizationId: activeOrg.id },
               }),
            );
         } catch {
            // No team found or other error — fall through and let the wizard handle it.
         }

         // If onboarding state was fixed AND profile is already set, the wizard
         // has nothing left to do — redirect straight to the dashboard.
         if (fixed && session.user.name) {
            throw redirect({
               to: "/$slug/$teamSlug/home",
               params: { slug: fixed.orgSlug, teamSlug: fixed.teamSlug },
            });
         }
      }

      return {
         session,
         organizations,
         activeOrg: activeOrg ?? null,
      };
   },
   component: OnboardingPage,
});

function OnboardingPage() {
   const { session, organizations, activeOrg } = Route.useRouteContext();

   return (
      <OnboardingWizard
         activeOrg={activeOrg}
         organizations={organizations}
         session={session}
      />
   );
}
