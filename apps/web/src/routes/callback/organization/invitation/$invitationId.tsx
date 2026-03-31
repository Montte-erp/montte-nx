import { Button } from "@packages/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocalStorage } from "foxact/use-local-storage";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { PENDING_INVITATION_KEY } from "@/features/organization/constants";

export const Route = createFileRoute(
   "/callback/organization/invitation/$invitationId",
)({
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
   const [error, setError] = useState<string | null>(null);

   useEffect(() => {
      const run = async () => {
         const session = await queryClient
            .fetchQuery(orpc.session.getSession.queryOptions())
            .catch(() => null);

         if (!session?.user?.id) {
            setPendingInvitation(invitationId);
            router.navigate({ to: "/auth/sign-in" });
            return;
         }

         const { error: err } = await authClient.organization.acceptInvitation({
            invitationId,
         });

         if (err) {
            setError(err.message ?? "Convite inválido ou expirado.");
            return;
         }

         router.navigate({ to: "/auth/callback" });
      };

      run();
   }, [invitationId, queryClient, router, setPendingInvitation]);

   if (error) {
      return (
         <div className="flex min-h-screen items-center justify-center bg-background">
            <div className="text-center flex flex-col gap-4 max-w-sm px-4">
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
