import { createSlug } from "@core/utils/text";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

export function useCreateMeterFromName() {
   const queryClient = useQueryClient();
   const mutation = useMutation(
      orpc.meters.createMeter.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );
   return useCallback(
      async (name: string) => {
         const created = await mutation.mutateAsync({
            name,
            eventName: createSlug(name).replace(/-/g, "_") || "evento",
            aggregation: "sum",
            filters: {},
         });
         await queryClient.invalidateQueries({
            queryKey: orpc.meters.getMeters.queryKey({}),
         });
         toast.success(`Medidor "${name}" criado.`);
         return created.id;
      },
      [mutation, queryClient],
   );
}
