import { Toaster } from "@packages/ui/components/sonner";
import { ThemeProvider } from "@packages/ui/lib/theme-provider";
import appCss from "@tooling/css/globals.css?url";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
   ClientOnly,
   createRootRouteWithContext,
   HeadContent,
   Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { GlobalAlertDialog } from "@/hooks/use-alert-dialog";
import { GlobalCredenza } from "@/hooks/use-credenza";
import { GlobalSelectionToolbar } from "@/hooks/use-selection-toolbar";
import { GlobalSurveyModal } from "@/hooks/use-survey-modal";
import { GlobalDialogStack } from "@/hooks/use-dialog-stack";
import { getPublicEnv } from "@/integrations/public-env";
import { PostHogWrapper } from "@/integrations/posthog/client";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import type { RouterContext } from "../integrations/tanstack-query/root-provider";

export const Route = createRootRouteWithContext<RouterContext>()({
   loader: async ({ context }) => {
      await context.queryClient
         .ensureQueryData(context.orpc.session.getSession.queryOptions())
         .catch(() => null);
      return { publicEnv: getPublicEnv() };
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
   const { publicEnv } = Route.useLoaderData();
   return (
      <html lang="pt-BR" suppressHydrationWarning>
         <head>
            <HeadContent />
            <script
               dangerouslySetInnerHTML={{
                  __html: `window.__env = ${JSON.stringify(publicEnv).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\//g, "\\u002f")}`,
               }}
            />
         </head>
         <body>
            <PostHogWrapper env={publicEnv}>
               <ThemeProvider
                  attribute="class"
                  defaultTheme="system"
                  enableSystem
               >
                  {children}
                  <Toaster richColors />
                  <GlobalAlertDialog />
                  <ClientOnly>
                     <GlobalCredenza />
                     <GlobalSelectionToolbar />
                  </ClientOnly>
                  <GlobalSurveyModal />
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
