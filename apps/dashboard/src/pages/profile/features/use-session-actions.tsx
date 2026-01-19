import { toast } from "@packages/ui/components/sonner";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/integrations/clients";

export function useSessionActions() {
   const trpc = useTRPC();

   const revokeOtherSessionsMutation = useMutation(
      trpc.session.revokeOtherSessions.mutationOptions({
         onError: () => {
            toast.error("Falha ao revogar outras sessões.");
         },
         onSuccess: () => {
            toast.success("Outras sessões foram revogadas com sucesso.");
         },
      }),
   );

   const revokeAllSessionsMutation = useMutation(
      trpc.session.revokeSessions.mutationOptions({
         onError: () => {
            toast.error("Falha ao revogar todas as sessões.");
         },
         onSuccess: () => {
            toast.success("Todas as sessões foram revogadas com sucesso.");
         },
      }),
   );

   return {
      revokeAllSessions: revokeAllSessionsMutation.mutateAsync,
      revokeOtherSessions: revokeOtherSessionsMutation.mutateAsync,
   };
}
