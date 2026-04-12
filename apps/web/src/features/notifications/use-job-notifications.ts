import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

export function useJobNotifications() {
   const queryClient = useQueryClient();

   const { data } = useQuery(
      orpc.notifications.subscribe.experimental_liveOptions({
         retry: true,
      }),
   );

   useEffect(() => {
      if (!data) return;

      toast(data.message);

      if (data.status === "completed") {
         queryClient.invalidateQueries({
            queryKey: orpc.categories.getAll.queryKey(),
         });
      }
   }, [data, queryClient]);
}
