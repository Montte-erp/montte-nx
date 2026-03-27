import { env } from "@core/environment/web";
import { Toaster } from "@packages/ui/components/sonner";
import { ThemeProvider } from "@packages/ui/lib/theme-provider";
import appCss from "@tooling/css/globals.css?url";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
   ClientOnly,
   createRootRouteWithContext,
   HeadContent,
   Scripts,
   useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { GlobalAlertDialog } from "@/hooks/use-alert-dialog";
import { GlobalDialogStack } from "@/hooks/use-dialog-stack";
import {
   PostHogWrapper,
   PosthogRouterTracker,
} from "@/integrations/posthog/client";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import type { RouterContext } from "../integrations/tanstack-query/root-provider";

export const Route = createRootRouteWithContext<RouterContext>()({
   loader: async ({ context }) => {
      await context.queryClient
         .ensureQueryData(context.orpc.session.getSession.queryOptions())
         .catch(() => null);
   },
   head: () => ({
      meta: [
         {
            charSet: "utf-8",
         },
         {
            name: "viewport",
            content: "width=device-width, initial-scale=1",
         },
         {
            title: "Montte",
         },
      ],
      links: [
         {
            href: "/favicon.svg",
            rel: "icon",
         },

         {
            rel: "stylesheet",
            href: appCss,
            precedence: "default",
         },
      ],
   }),

   shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
   const routerState = useRouterState();

   return (
      <html lang="pt-BR" suppressHydrationWarning>
         <head>
            <HeadContent />
         </head>
         <body>
            <PostHogWrapper env={env}>
               <ThemeProvider
                  attribute="class"
                  defaultTheme="system"
                  enableSystem
               >
                  {children}
                  <PosthogRouterTracker
                     location={{
                        href:
                           typeof window !== "undefined"
                              ? window.location.href
                              : "",
                        pathname: routerState.location.pathname,
                        search: routerState.location.search,
                     }}
                  />
                  <Toaster richColors />
                  <GlobalAlertDialog />
                  <GlobalDialogStack />
                  <ClientOnly>
                     <TanStackDevtools
                        config={{
                           position: "top-right",
                        }}
                        plugins={[
                           {
                              name: "Tanstack Router",
                              render: <TanStackRouterDevtoolsPanel />,
                           },
                           TanStackQueryDevtools,
                        ]}
                     />
                  </ClientOnly>
               </ThemeProvider>
            </PostHogWrapper>
            <Scripts />
         </body>
      </html>
   );
}
