import { clientEnv } from "@packages/environment/client";
import { NotFoundComponent } from "@/default/not-found";
import { QueryProvider, useTRPC } from "@/integrations/clients";
import { ThemeProvider } from "@/layout/theme-provider";
import { PostHogWrapper, PosthogRouterTracker } from "@packages/posthog/client";
import { Toaster } from "@packages/ui/components/sonner";
import { useQuery } from "@tanstack/react-query";
import {
   createRootRoute,
   HeadContent,
   Outlet,
   redirect,
   useLocation,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Lazy load devtools - excluded from production bundle
const TanStackRouterDevtools = import.meta.env.PROD
   ? () => null
   : lazy(() =>
      import("@tanstack/react-router-devtools").then((m) => ({
         default: m.TanStackRouterDevtools,
      })),
   );

import { GlobalAlertDialog } from "@/hooks/use-alert-dialog";
import { GlobalCredenza } from "@/hooks/use-credenza";
import { GlobalSheet } from "@/hooks/use-sheet";

declare module "@tanstack/react-router" {
   interface StaticDataRouteOption {
      breadcrumb?: string;
   }
}
export const Route = createRootRoute({
   component: RootComponent,
   head: () => ({
      links: [
         {
            href: "/favicon.svg",
            rel: "icon",
         },
      ],
      meta: [
         {
            content: "Gestão financeira completa para você e seus negócios. Simples, transparente e Open Source.",
            name: "description",
         },
         {
            title: "Montte",
         },
      ],
   }),
   loader: async ({ location }: { location: { href: string } }) => {
      if (location.href === "/") {
         throw redirect({ to: "/auth/sign-in" });
      }
   },
   notFoundComponent: () => (
      <div className="h-screen w-screen">
         <NotFoundComponent />
      </div>
   ),
   staticData: {
      breadcrumb: "Home",
   },
   wrapInSuspense: true,
});

function TelemetryAwarePostHogWrapper({
   children,
}: {
   children: React.ReactNode;
}) {
   const trpc = useTRPC();
   const location = useLocation();
   // Use non-blocking query with optimistic default (true = allow tracking initially)
   // This prevents the entire app from suspending while waiting for consent status
   const { data: hasConsent = true } = useQuery(
      trpc.session.getTelemetryConsent.queryOptions(undefined, {
         meta: { skipGlobalInvalidation: true },
         staleTime: 5 * 60 * 1000, // Cache consent for 5 minutes
      }),
   );

   return (
      <PostHogWrapper env={clientEnv} hasConsent={hasConsent}>
         <PosthogRouterTracker location={location} />
         {children}
      </PostHogWrapper>
   );
}

function RootComponent() {
   return (
      <>
         <HeadContent />
         <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <QueryProvider>
               <TelemetryAwarePostHogWrapper>
                  <GlobalAlertDialog />
                  <GlobalCredenza />
                  <GlobalSheet />
                  <Toaster />
                  <Outlet />
                  <Suspense fallback={null}>
                     {/* <TanStackRouterDevtools position="bottom-left" /> */}
                  </Suspense>
               </TelemetryAwarePostHogWrapper>
            </QueryProvider>
         </ThemeProvider>
      </>
   );
}
