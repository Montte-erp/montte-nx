import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { CookieConsentBanner } from "@/features/cookie-consent/cookie-consent-banner";
import { getQueryClient, reservedRoutes, trpc } from "@/integrations/clients";
import { DashboardLayout } from "@/layout/dashboard-layout";

export const Route = createFileRoute("/$slug/_dashboard")({
   beforeLoad: async ({ location, params }) => {
      const queryClient = getQueryClient();
      const isOnboardingPage = location.pathname.endsWith("/onboarding");

      try {
         // Fetch all critical data in PARALLEL instead of sequentially
         // This reduces initial load time from 3 sequential calls to 1 parallel batch
         const [session, organizations, onboardingStatus] = await Promise.all([
            queryClient.fetchQuery(trpc.session.getSession.queryOptions()),
            queryClient.fetchQuery(
               trpc.organization.getOrganizations.queryOptions(),
            ),
            // Skip onboarding check if already on onboarding page
            isOnboardingPage
               ? Promise.resolve(null)
               : queryClient.fetchQuery({
                    ...trpc.onboarding.getOnboardingStatus.queryOptions(),
                    staleTime: 30 * 1000, // Cache for 30s instead of always refetching
                 }),
         ]);

         // Validate session
         if (!session) {
            throw redirect({
               replace: true,
               search: location.search,
               to: "/auth/sign-in",
            });
         }

         // Validate organization access (moved from $slug.tsx)
         const firstSlug = organizations[0]?.slug;
         const isReservedSlug = reservedRoutes.includes(params.slug);
         const hasOrganization = organizations.some(
            (org) => org.slug === params.slug,
         );

         if ((isReservedSlug || !hasOrganization) && firstSlug) {
            throw redirect({
               params: { slug: firstSlug },
               search: location.search,
               to: "/$slug/home",
            });
         }

         // Check onboarding status
         if (!isOnboardingPage && onboardingStatus?.needsOnboarding) {
            throw redirect({
               params,
               to: "/$slug/onboarding",
            });
         }
      } catch (error) {
         if (
            error instanceof Response ||
            (typeof error === "object" &&
               error !== null &&
               "isRedirect" in error)
         ) {
            throw error;
         }

         throw redirect({ to: "/auth/sign-in" });
      }
   },
   component: RouteComponent,
   wrapInSuspense: true,
});

function RouteComponent() {
   return (
      <DashboardLayout>
         <CookieConsentBanner />
         <div className="h-full w-full [view-transition-name:main-content]">
            <Outlet />
         </div>
      </DashboardLayout>
   );
}
