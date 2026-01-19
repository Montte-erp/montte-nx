import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useDuplicateDashboard({
   onSuccess,
   onError,
}: {
   onSuccess?: () => void;
   onError?: () => void;
}) {
   const trpc = useTRPC();

   const duplicateDashboardMutation = useMutation(
      trpc.dashboards.duplicate.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao duplicar dashboard");
            onError?.();
         },
         onSuccess: () => {
            toast.success("Dashboard duplicado com sucesso");
            onSuccess?.();
         },
      }),
   );

   return duplicateDashboardMutation;
}
