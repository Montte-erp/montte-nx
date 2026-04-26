import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

const TOAST_ID = "job-notifications";

export function useJobNotifications() {
   const { data } = useQuery(
      orpc.notifications.subscribe.experimental_liveOptions({
         retry: true,
      }),
   );

   useEffect(() => {
      if (!data) return;

      if (data.status === "started") {
         toast.loading(data.message, { id: TOAST_ID });
         return;
      }

      if (data.status === "failed") {
         toast.error(data.message, { id: TOAST_ID });
         return;
      }

      toast.info(data.message, { id: TOAST_ID });
   }, [data]);
}
