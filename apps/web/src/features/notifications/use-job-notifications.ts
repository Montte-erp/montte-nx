import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { NOTIFICATION_TYPES } from "@packages/notifications/types";

const TOAST_ID = "job-notifications";

export function useJobNotifications() {
   const queryClient = useQueryClient();

   const { data } = useQuery(
      orpc.notifications.subscribe.experimental_liveOptions({
         retry: true,
      }),
   );

   useEffect(() => {
      if (!data) return;

      if (data.status === "started" || data.status === "progress") {
         toast.loading(data.message, { id: TOAST_ID });
         return;
      }

      if (data.status === "failed") {
         toast.error(data.message, { id: TOAST_ID });
         return;
      }

      toast.info(data.message, { id: TOAST_ID });
      if (
         data.type === NOTIFICATION_TYPES.AI_KEYWORD_DERIVED ||
         data.type === NOTIFICATION_TYPES.CRON_KEYWORDS_BACKFILL ||
         (data.type === NOTIFICATION_TYPES.IMPORT_BATCH &&
            data.status === "completed")
      ) {
         queryClient.invalidateQueries({
            queryKey: orpc.categories.getAll.queryKey(),
         });
      }
      if (data.type === NOTIFICATION_TYPES.AI_TRANSACTION_CATEGORIZED) {
         queryClient.invalidateQueries({
            queryKey: orpc.transactions.getAll.queryKey(),
         });
      }
   }, [data, queryClient]);
}
