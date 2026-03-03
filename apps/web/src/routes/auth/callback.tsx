import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { orpc } from "@/integrations/orpc/client";
import { useSafeLocalStorage } from "@/hooks/use-local-storage";

const PENDING_INVITATION_KEY = "montte_pending_invitation_id";

export const Route = createFileRoute("/auth/callback")({
   component: AuthCallbackPage,
});

function AuthCallbackPage() {
   const [pendingInvitation, setPendingInvitation] =
      useSafeLocalStorage<string | null>(PENDING_INVITATION_KEY, null);
   const router = useRouter();
   const queryClient = useQueryClient();

   useEffect(() => {
      // useSafeLocalStorage syncs via useLayoutEffect, which runs before useEffect,
      // so pendingInvitation already holds the real localStorage value here.
      if (pendingInvitation) {
         setPendingInvitation(null);
         router.navigate({
            to: "/callback/organization/invitation/$invitationId",
            params: { invitationId: pendingInvitation },
         });
         return;
      }

      const run = async () => {
         const organizations = await queryClient.fetchQuery(
            orpc.organization.getOrganizations.queryOptions(),
         );

         const firstOrg = organizations[0];

         if (!firstOrg || !firstOrg.onboardingCompleted) {
            router.navigate({ to: "/onboarding" });
            return;
         }

         let teams: { id: string; slug: string }[] = [];
         try {
            teams = await queryClient.fetchQuery(
               orpc.organization.getOrganizationTeams.queryOptions(),
            );
         } catch {
            router.navigate({ to: "/onboarding" });
            return;
         }

         const fallbackTeam = teams[0];

         if (fallbackTeam) {
            router.navigate({
               to: "/$slug/$teamSlug/home",
               params: {
                  slug: firstOrg.slug,
                  teamSlug: fallbackTeam.slug,
               },
            });
            return;
         }

         router.navigate({ to: "/onboarding" });
      };

      run();
   }, [pendingInvitation, setPendingInvitation, queryClient, router]);

   return null;
}
