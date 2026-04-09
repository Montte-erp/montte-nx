import { createRouter, Link } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";
import type { PublicEnv } from "./integrations/public-env";
import { routeTree } from "./routeTree.gen";

function NotFound() {
   return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
         <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
         <p className="text-lg text-gray-600 mb-6">Page not found</p>
         <Link
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            to="/"
         >
            Go Home
         </Link>
      </div>
   );
}

export const getRouter = () => {
   const rqContext = TanstackQuery.getContext();

   const router = createRouter({
      routeTree,
      context: {
         ...rqContext,
      },
      dehydrate: (): { publicEnv: PublicEnv | undefined } => ({
         publicEnv: router.options.context.publicEnv,
      }),
      hydrate: (dehydrated: { publicEnv: PublicEnv | undefined }) => {
         router.options.context.publicEnv = dehydrated.publicEnv;
      },
      defaultPreload: "intent",
      defaultPreloadStaleTime: 0,
      scrollRestoration: true,
      defaultStructuralSharing: true,
      defaultNotFoundComponent: NotFound,
   });

   setupRouterSsrQueryIntegration({
      router,
      queryClient: rqContext.queryClient,
   });

   return router;
};

declare module "@tanstack/react-router" {
   interface Register {
      router: ReturnType<typeof getRouter>;
   }
}
