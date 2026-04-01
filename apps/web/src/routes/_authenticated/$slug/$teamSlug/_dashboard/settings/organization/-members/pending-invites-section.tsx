import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { authClient } from "@/integrations/better-auth/auth-client";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS, formatDate } from "./members-columns";

type PendingInvite = {
   id: string;
   email: string;
   role: string;
   createdAt: Date;
};

export function PendingInvitesSection({
   organizationId,
}: {
   organizationId: string;
}) {
   const queryClient = useQueryClient();

   const { data: invitesData } = useSuspenseQuery({
      queryKey: ["pending-invites", organizationId],
      queryFn: async () => {
         const result = await authClient.organization.listInvitations({
            query: { organizationId },
         });
         if (result.error) {
            throw new Error(
               result.error.message ?? "Erro ao carregar convites",
            );
         }
         return result.data as PendingInvite[] | null;
      },
   });

   const cancelMutation = useMutation({
      mutationFn: async (invitationId: string) => {
         const result = await authClient.organization.cancelInvitation({
            invitationId,
         });
         if (result.error) {
            throw new Error(result.error.message ?? "Erro ao cancelar convite");
         }
         return result.data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({
            queryKey: ["pending-invites"],
         });
         toast.success("Convite cancelado");
      },
      onError: (error) => {
         toast.error(error.message);
      },
   });

   const invites = invitesData ?? [];

   return (
      <section className="flex flex-col gap-4">
         <div>
            <h2 className="text-lg font-medium">Convites pendentes</h2>
            <p className="text-sm text-muted-foreground mt-1">
               Convites enviados que ainda não foram aceitos.
            </p>
         </div>

         {invites.length === 0 ? (
            <Empty>
               <EmptyMedia>
                  <Mail className="size-8 text-muted-foreground" />
               </EmptyMedia>
               <EmptyHeader>
                  <EmptyTitle>Nenhum convite pendente</EmptyTitle>
                  <EmptyDescription>
                     Quando você convidar novos membros, os convites pendentes
                     aparecerão aqui.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         ) : (
            <div className="rounded-md border">
               <div className="divide-y">
                  {invites.map((invite) => (
                     <div
                        className="flex items-center justify-between px-4 py-3"
                        key={invite.id}
                     >
                        <div className="flex items-center gap-3 min-w-0">
                           <Mail className="size-4 text-muted-foreground shrink-0" />
                           <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                 {invite.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                 {ROLE_LABELS[invite.role] ?? invite.role}{" "}
                                 &middot; Enviado em{" "}
                                 {formatDate(invite.createdAt)}
                              </p>
                           </div>
                        </div>
                        <Button
                           disabled={cancelMutation.isPending}
                           onClick={() => cancelMutation.mutate(invite.id)}
                           variant="ghost"
                        >
                           Cancelar
                        </Button>
                     </div>
                  ))}
               </div>
            </div>
         )}
      </section>
   );
}
