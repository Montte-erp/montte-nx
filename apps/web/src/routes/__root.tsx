import { Toaster } from "@packages/ui/components/sonner";
import { ThemeProvider } from "@packages/ui/lib/theme-provider";
import type { Theme } from "@packages/ui/lib/theme-provider";
import appCss from "@tooling/css/globals.css?url";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
   ClientOnly,
   createRootRouteWithContext,
   HeadContent,
   Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { GlobalAlertDialog } from "@/hooks/use-alert-dialog";
import { GlobalCommandDialog } from "@/hooks/use-command-dialog";
import { GlobalCredenza } from "@/hooks/use-credenza";
import { GlobalSelectionToolbar } from "@/hooks/use-selection-toolbar";
import { GlobalSurveyModal } from "@/hooks/use-survey-modal";
import { PostHogWrapper } from "@/integrations/posthog/client";
import {
   devtoolsConfig,
   devtoolsEventBusConfig,
   devtoolsPlugins,
} from "../integrations/devtools/config";
import type { RouterContext } from "../integrations/tanstack-query/root-provider";

const getThemeFromCookie = createServerFn({ method: "GET" }).handler(() => {
   const request = getRequest();
   const cookieHeader = request?.headers.get("cookie") ?? "";
   const match = cookieHeader.match(/(?:^|;\s*)theme=(\w+)/);
   const theme = match?.[1];
   if (theme === "dark" || theme === "light" || theme === "system")
      return theme as Theme;
   return "system" as Theme;
});

export const Route = createRootRouteWithContext<RouterContext>()({
   staleTime: Infinity,
   loader: async ({ context }) => {
      await context.queryClient
         .ensureQueryData(context.orpc.session.getSession.queryOptions())
         .catch(() => null);
      const theme = await getThemeFromCookie();
      return { theme };
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
   const { theme } = Route.useLoaderData();
   const { publicEnv } = Route.useRouteContext();
   return (
      <html
         lang="pt-BR"
         suppressHydrationWarning
         className={theme !== "system" ? theme : undefined}
      >
         <head>
            <HeadContent />
         </head>
         <body>
            <PostHogWrapper env={publicEnv}>
               <ThemeProvider
                  attribute="class"
                  defaultTheme={theme}
                  enableSystem
               >
                  {children}
                  <Toaster richColors />
                  <GlobalAlertDialog />
                  <ClientOnly>
                     <GlobalCredenza />
                     <GlobalCommandDialog />
                     <GlobalSelectionToolbar />
                  </ClientOnly>
                  <GlobalSurveyModal />
                  {import.meta.env.DEV && (
                     <ClientOnly>
                        <TanStackDevtools
                           config={devtoolsConfig}
                           eventBusConfig={devtoolsEventBusConfig}
                           plugins={devtoolsPlugins}
                        />
                     </ClientOnly>
                  )}
               </ThemeProvider>
            </PostHogWrapper>
            <Scripts />
         </body>
      </html>
   );
}
