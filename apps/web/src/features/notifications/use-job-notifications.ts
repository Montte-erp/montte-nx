import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { consumeEventIterator } from "@orpc/client";
import { toast } from "sonner";
import { orpc, client } from "@/integrations/orpc/client";
import { NOTIFICATION_TYPES, getPayload } from "@packages/notifications/types";

export function useJobNotifications() {
   const queryClient = useQueryClient();

   useEffect(() => {
      const cancel = consumeEventIterator(client.notifications.subscribe(), {
         onEvent: (notification) => {
            if (notification.status === "failed") {
               toast.error("Não foi possível gerar palavras-chave.", {
                  description:
                     "Tente novamente ou adicione manualmente nas configurações da categoria.",
               });
               return;
            }

            if (notification.type === NOTIFICATION_TYPES.AI_KEYWORD_DERIVED) {
               const p = getPayload(
                  NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
                  notification.payload,
               );
               queryClient.invalidateQueries({
                  queryKey: orpc.categories.getAll.queryKey(),
               });
               toast.success(
                  `Palavras-chave geradas para ${p?.categoryName ?? "categoria"}.`,
               );
               return;
            }

            if (
               notification.type === NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL
            ) {
               const p = getPayload(
                  NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL,
                  notification.payload,
               );
               queryClient.invalidateQueries({
                  queryKey: orpc.categories.getAll.queryKey(),
               });
               toast.success(
                  `Palavras-chave configuradas para ${p?.count ?? 0} categorias.`,
               );
               return;
            }
         },
         onError: () => {},
      });

      return () => {
         cancel();
      };
   }, [queryClient]);
}
