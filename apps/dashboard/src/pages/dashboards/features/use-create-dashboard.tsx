import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

export function useCreateDashboard({
   onSuccess,
   onError,
}: {
   onSuccess?: () => void;
   onError?: () => void;
}) {
   const trpc = useTRPC();

   const createDashboardMutation = useMutation(
      trpc.dashboards.create.mutationOptions({
         onError: (_error) => {
            toast.error("Falha ao criar dashboard");
            onError?.();
         },
         onSuccess: () => {
            toast.success("Dashboard criado com sucesso");
            onSuccess?.();
         },
      }),
   );

   return createDashboardMutation;
}
