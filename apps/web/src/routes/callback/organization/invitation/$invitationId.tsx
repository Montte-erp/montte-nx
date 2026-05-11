import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { authClient } from "@/integrations/better-auth/auth-client";
import { client } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/callback/organization/invitation/$invitationId",
)({
   ssr: false,
   head: () => ({ meta: [{ title: "Aceitar Convite — Montte" }] }),
   beforeLoad: async ({ context, params, location }) => {
      const session = await context.queryClient
         .fetchQuery(context.orpc.session.getSession.queryOptions({}))
         .catch(() => null);
      if (!session?.user?.id) {
         throw redirect({
            to: "/auth/sign-in",
            search: { redirect: location.href },
         });
      }

      const accepted = await authClient.organization.acceptInvitation({
         invitationId: params.invitationId,
      });
      const organizationId = accepted.data?.invitation?.organizationId;
      if (!organizationId) throw redirect({ to: "/auth/callback" });

      await authClient.organization.setActive({ organizationId });
      const [orgs, teams] = await Promise.all([
         client.organization.getOrganizations(),
         client.organization.getOrganizationTeams(),
      ]);
      const org = orgs.find((o) => o.id === organizationId);
      const firstTeam = teams[0];
      if (!org || !firstTeam) throw redirect({ to: "/auth/callback" });

      await authClient.organization.setActiveTeam({ teamId: firstTeam.id });
      throw redirect({
         to: "/$slug/$teamSlug/inbox",
         params: { slug: org.slug, teamSlug: firstTeam.slug },
      });
   },
   component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
   return (
      <div className="flex min-h-screen items-center justify-center bg-background">
         <div className="flex flex-col gap-4 text-center">
            <div className="flex justify-center">
               <Loader2 className="size-8 animate-spin text-primary" />
            </div>
            <p className="text-muted-foreground text-sm">
               Aceitando convite...
            </p>
         </div>
      </div>
   );
}
