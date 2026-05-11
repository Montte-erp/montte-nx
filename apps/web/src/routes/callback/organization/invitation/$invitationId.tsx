import { createFileRoute, redirect } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { client } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/callback/organization/invitation/$invitationId",
)({
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

      const accepted = await fromPromise(
         client.organization.acceptInvitation({
            invitationId: params.invitationId,
         }),
         (e) => e,
      );

      if (accepted.isErr()) {
         throw redirect({ to: "/auth/callback" });
      }

      const value = accepted.value;
      if (value.teamSlug) {
         throw redirect({
            to: "/$slug/$teamSlug/inbox",
            params: {
               slug: value.organizationSlug,
               teamSlug: value.teamSlug,
            },
         });
      }

      throw redirect({ to: "/auth/callback" });
   },
   component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
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
