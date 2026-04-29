import { createFileRoute, redirect } from "@tanstack/react-router";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { OnboardingWizard } from "./-onboarding/onboarding-wizard";

export const Route = createFileRoute("/_authenticated/onboarding")({
   validateSearch: z.object({
      new: z.boolean().catch(false).default(false),
   }),
   beforeLoad: async ({ context, search }) => {
      const sessionResult = await fromPromise(
         context.queryClient.fetchQuery(
            context.orpc.session.getSession.queryOptions({}),
         ),
         () => null,
      );

      if (sessionResult.isErr() || !sessionResult.value?.user?.id) {
         throw redirect({ to: "/auth/sign-in" });
      }

      const session = sessionResult.value;

      const organizations = await context.queryClient.fetchQuery(
         context.orpc.organization.getOrganizations.queryOptions(),
      );

      if (search.new) {
         return { session, organizations, activeOrg: null };
      }

      const activeOrg =
         organizations.find(
            (org) => org.id === session.session.activeOrganizationId,
         ) ?? organizations[0];

      if (activeOrg) {
         const fixedResult = await fromPromise(
            context.queryClient.fetchQuery(
               context.orpc.onboarding.fixOnboarding.queryOptions({
                  input: { organizationId: activeOrg.id },
               }),
            ),
            () => null,
         );

         if (fixedResult.isOk() && fixedResult.value && session.user.name) {
            throw redirect({
               to: "/$slug/$teamSlug/home",
               params: {
                  slug: fixedResult.value.orgSlug,
                  teamSlug: fixedResult.value.teamSlug,
               },
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
