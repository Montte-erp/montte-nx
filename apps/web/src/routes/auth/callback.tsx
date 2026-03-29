import { useIsomorphicLayoutEffect } from "foxact/use-isomorphic-layout-effect";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSafeLocalStorage } from "@/hooks/use-local-storage";
import { orpc } from "@/integrations/orpc/client";

const PENDING_INVITATION_KEY = "montte_pending_invitation_id";

export const Route = createFileRoute("/auth/callback")({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         context.orpc.organization.getOrganizations.queryOptions(),
      );
   },
   component: AuthCallbackPage,
});

function AuthCallbackPage() {
   const [pendingInvitation, setPendingInvitation] = useSafeLocalStorage<
      string | null
   >(PENDING_INVITATION_KEY, null);
   const router = useRouter();

   const { data: organizations } = useSuspenseQuery(
      orpc.organization.getOrganizations.queryOptions(),
   );

   useIsomorphicLayoutEffect(() => {
      if (pendingInvitation) {
         setPendingInvitation(null);
         router.navigate({
            to: "/callback/organization/invitation/$invitationId",
            params: { invitationId: pendingInvitation },
         });
         return;
      }

      const firstOrg = organizations[0];

      if (!firstOrg || !firstOrg.onboardingCompleted) {
         router.navigate({ to: "/onboarding" });
         return;
      }

      // Organization exists and onboarding is complete — need to fetch teams
      // This is handled by the child suspense boundary below
   }, [pendingInvitation, setPendingInvitation, organizations, router]);

   const firstOrg = organizations[0];

   // Don't render team resolver if no org or pending invitation
   if (!firstOrg || !firstOrg.onboardingCompleted || pendingInvitation) {
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
            to: "/$slug/$teamSlug/home",
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
