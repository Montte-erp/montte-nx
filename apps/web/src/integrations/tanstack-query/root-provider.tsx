import {
   MutationCache,
   QueryCache,
   QueryClient,
   QueryClientProvider,
} from "@tanstack/react-query";
import { toast } from "@packages/ui/hooks/use-toast";
import { setQueryClient } from "../better-auth/query-bridge";
import { orpc } from "../orpc/client";
import { getPublicEnv } from "@/integrations/public-env";
import type { PublicEnv } from "@/integrations/public-env";

export type RouterContext = {
   queryClient: QueryClient;
   orpc: typeof orpc;
   publicEnv: PublicEnv | undefined;
};

function getErrorMessage(error: unknown, fallback: string) {
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length > 0
   ) {
      return error.message;
   }
   return fallback;
}

export function getContext(): RouterContext {
   const queryClient = new QueryClient({
      queryCache: new QueryCache({
         onError: (error, query) => {
            if (typeof document === "undefined") return;
            if (query.state.data === undefined) return;
            if (query.meta?.notifyOnError !== true) return;

            const fallback =
               typeof query.meta.errorMessage === "string"
                  ? query.meta.errorMessage
                  : "Não foi possível sincronizar os dados. Tente novamente.";

            toast.error(getErrorMessage(error, fallback), {
               id: `query-error:${query.queryHash}`,
            });
         },
      }),
      mutationCache: new MutationCache({
         onSuccess: (_data, _variables, _context, mutation) => {
            if (mutation.meta?.skipGlobalInvalidation) return;
            // Invalidate all queries on any successful mutation
            // This ensures cache stays fresh after oRPC mutations
            queryClient.invalidateQueries();
         },
      }),
      defaultOptions: {
         queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
            gcTime: 10 * 60 * 1000, // 10 minutes - garbage collection
            refetchOnWindowFocus: false, // Don't refetch on tab focus
            retry: 1, // Retry failed requests once
         },
      },
   });

   // Set up Better Auth to invalidate queries on success
   setQueryClient(queryClient);

   return {
      queryClient,
      orpc,
      publicEnv: typeof document === "undefined" ? getPublicEnv() : undefined,
   };
}

export function Provider({
   children,
   queryClient,
}: {
   children: React.ReactNode;
   queryClient: QueryClient;
}) {
   return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
   );
}
