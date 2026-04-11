import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { NOTIFICATION_TYPES, getPayload } from "@packages/notifications/types";

export function useJobNotifications() {
   const queryClient = useQueryClient();

   const { data } = useQuery(
      orpc.notifications.subscribe.experimental_liveOptions({
         retry: true,
      }),
   );

   useEffect(() => {
      if (!data) return;

      if (data.status === "failed") {
         toast.error("Não foi possível gerar palavras-chave.", {
            description:
               "Tente novamente ou adicione manualmente nas configurações da categoria.",
         });
         return;
      }

      if (data.type === NOTIFICATION_TYPES.AI_KEYWORD_DERIVED) {
         const p = getPayload(
            NOTIFICATION_TYPES.AI_KEYWORD_DERIVED,
            data.payload,
         );
         queryClient.invalidateQueries({
            queryKey: orpc.categories.getAll.queryKey(),
         });
         toast.success(
            `Palavras-chave geradas para ${p?.categoryName ?? "categoria"}.`,
         );
         return;
      }

      if (data.type === NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL) {
         const p = getPayload(
            NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL,
            data.payload,
         );
         queryClient.invalidateQueries({
            queryKey: orpc.categories.getAll.queryKey(),
         });
         toast.success(
            `Palavras-chave configuradas para ${p?.count ?? 0} categorias.`,
         );
         return;
      }
   }, [data, queryClient]);
}
