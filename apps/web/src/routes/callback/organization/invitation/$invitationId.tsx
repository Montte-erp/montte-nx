import { Button } from "@packages/ui/components/button";
import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { authClient } from "@/integrations/better-auth/auth-client";

const PENDING_INVITATION_KEY = "montte_pending_invitation_id";

export const Route = createFileRoute(
   "/callback/organization/invitation/$invitationId",
)({
   beforeLoad: async ({ context, params }) => {
      const session = await context.queryClient
         .fetchQuery(context.orpc.session.getSession.queryOptions())
         .catch(() => null);

      if (!session?.user?.id) {
         window.localStorage.setItem(PENDING_INVITATION_KEY, params.invitationId);
         throw redirect({ to: "/auth/sign-in" });
      }
   },
   component: AcceptInvitationPage,
});

function AcceptInvitationPage() {
   const { invitationId } = Route.useParams();
   const router = useRouter();
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      authClient.organization
         .acceptInvitation({ invitationId })
         .then(({ error: err }) => {
            if (err) {
               setError(err.message ?? "Convite inválido ou expirado.");
               return;
            }
            router.navigate({ to: "/auth/callback" });
         });
   }, [invitationId, router]);

   if (error) {
      return (
         <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center space-y-4 max-w-sm px-4">
               <div className="flex justify-center">
                  <AlertCircle className="size-12 text-destructive" />
               </div>
               <h1 className="text-xl font-semibold">Convite inválido</h1>
               <p className="text-muted-foreground text-sm">{error}</p>
               <Button asChild variant="outline">
                  <Link to="/auth/sign-in">Ir para o login</Link>
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="flex min-h-screen items-center justify-center bg-background">
         <div className="text-center space-y-3">
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
