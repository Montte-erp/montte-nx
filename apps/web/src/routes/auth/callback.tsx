import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute("/auth/callback")({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         context.orpc.organization.getOrganizations.queryOptions(),
      );
   },
   component: AuthCallbackPage,
});

function AuthCallbackPage() {
   const router = useRouter();
   const { data: organizations } = useSuspenseQuery(
      orpc.organization.getOrganizations.queryOptions(),
   );

   useIsomorphicLayoutEffect(() => {
      const firstOrg = organizations[0];
      if (!firstOrg || !firstOrg.onboardingCompleted) {
         router.navigate({ to: "/onboarding" });
         return;
      }
   }, [organizations, router]);

   const firstOrg = organizations[0];
   if (!firstOrg || !firstOrg.onboardingCompleted) {
      return null;
   }

   return <TeamResolver orgSlug={firstOrg.slug} />;
}

function TeamResolver({ orgSlug }: { orgSlug: string }) {
   const router = useRouter();

   const { data: teams } = useSuspenseQuery(
      orpc.organization.getOrganizationTeams.queryOptions(),
   );

   useIsomorphicLayoutEffect(() => {
      const fallbackTeam = teams[0];

      if (fallbackTeam) {
         router.navigate({
            to: "/$slug/$teamSlug/inbox",
            params: {
               slug: orgSlug,
               teamSlug: fallbackTeam.slug,
            },
         });
         return;
      }

      router.navigate({ to: "/onboarding" });
   }, [teams, orgSlug, router]);

   return null;
}
