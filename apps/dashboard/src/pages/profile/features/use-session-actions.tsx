import { toast } from "@packages/ui/components/sonner";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";

export function useRevokeOtherSessions() {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const revokeOtherSessionsMutation = useMutation(
      trpc.session.revokeOtherSessions.mutationOptions({
         onError: () => {
            toast.error("Failed to revoke other sessions.");
         },
         onSuccess: () => {
            toast.success("Other sessions have been revoked successfully.");
         },
      }),
   );

   const revokeOtherSessions = useCallback(() => {
      openAlertDialog({
         actionLabel: "Revogar outras sessões",
         cancelLabel: "Cancelar",
         description: "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await revokeOtherSessionsMutation.mutateAsync();
         },
         title: "Confirmar Exclusão",
         variant: "destructive",
      });
   }, [openAlertDialog, revokeOtherSessionsMutation]);

   return {
      isRevoking: revokeOtherSessionsMutation.isPending,
      revokeOtherSessions,
   };
}

export function useRevokeAllSessions() {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();

   const revokeAllSessionsMutation = useMutation(
      trpc.session.revokeSessions.mutationOptions({
         onError: () => {
            toast.error("Failed to revoke all sessions.");
         },
         onSuccess: () => {
            toast.success("All sessions have been revoked successfully.");
         },
      }),
   );

   const revokeAllSessions = useCallback(() => {
      openAlertDialog({
         actionLabel: "Revogar todas as sessões",
         cancelLabel: "Cancelar",
         description: "Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.",
         onAction: async () => {
            await revokeAllSessionsMutation.mutateAsync();
         },
         title: "Confirmar Exclusão",
         variant: "destructive",
      });
   }, [openAlertDialog, revokeAllSessionsMutation]);

   return {
      isRevoking: revokeAllSessionsMutation.isPending,
      revokeAllSessions,
   };
}
