import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocalStorage } from "foxact/use-local-storage";
import { toast } from "sonner";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { PENDING_INVITATION_KEY } from "@/features/organization/constants";

export const Route = createFileRoute(
   "/callback/organization/invitation/$invitationId",
)({
   head: () => ({ meta: [{ title: "Aceitar Convite — Montte" }] }),
   component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
   const { invitationId } = Route.useParams();
   const router = useRouter();
   const queryClient = useQueryClient();
   const [, setPendingInvitation] = useLocalStorage<string | null>(
      PENDING_INVITATION_KEY,
      null,
   );

   useEffect(() => {
      const run = async () => {
         const session = await queryClient
            .fetchQuery(orpc.session.getSession.queryOptions())
            .catch(() => null);

         if (!session?.user?.id) {
            setPendingInvitation(invitationId);
            router.navigate({
               search: {
                  redirect: `/callback/organization/invitation/${invitationId}`,
               },
               to: "/auth/sign-in",
            });
            return;
         }

         const { data, error: err } =
            await authClient.organization.acceptInvitation({ invitationId });

         if (err) {
            toast.error(err.message ?? "Convite inválido ou expirado.");
            const isRecipientMismatch =
               err.status === 403 ||
               /recipient|destinatário/i.test(err.message ?? "");
            if (isRecipientMismatch) {
               setPendingInvitation(invitationId);
               await authClient.signOut();
               router.navigate({
                  search: {
                     redirect: `/callback/organization/invitation/${invitationId}`,
                  },
                  to: "/auth/sign-in",
               });
               return;
            }
            router.navigate({ to: "/auth/callback" });
            return;
         }

         if (data?.invitation?.organizationId) {
            await authClient.organization.setActive({
               organizationId: data.invitation.organizationId,
            });
            const teams = await authClient.organization.listTeams({
               query: { organizationId: data.invitation.organizationId },
            });
            const firstTeam = teams.data?.[0];
            if (firstTeam) {
               await authClient.organization.setActiveTeam({
                  teamId: firstTeam.id,
               });
            }
         }

         router.navigate({ to: "/auth/callback" });
      };

      run();
   }, [invitationId, queryClient, router, setPendingInvitation]);

   return (
      <div className="flex min-h-screen items-center justify-center bg-background">
         <div className="text-center flex flex-col gap-4">
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
