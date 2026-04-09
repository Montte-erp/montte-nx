import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { QueryBoundary } from "@/components/query-boundary";
import { DashboardView } from "@/features/analytics/ui/dashboard-view";
import { QuickStartChecklist } from "./-home/quick-start-checklist";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/home/",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.analytics.getDefaultDashboard.queryOptions(),
      );
   },
   pendingMs: 300,
   pendingComponent: HomePageSkeleton,
   head: () => ({
      meta: [{ title: "Dashboard — Montte" }],
   }),
   component: HomePage,
});

function HomePageSkeleton() {
   return (
      <main className="flex flex-col gap-0">
         <div className="flex flex-col gap-2 pb-3">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Skeleton className="size-5 rounded" />
                  <Skeleton className="h-7 w-64" />
               </div>
               <Skeleton className="h-8 w-28" />
            </div>
            <Skeleton className="h-4 w-96" />
         </div>
         <div className="flex items-center gap-2 border-t border-b py-2 mb-4">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-7 w-16" />
         </div>
         <div className="grid grid-cols-12 gap-4">
            <Skeleton className="h-[300px] col-span-12 md:col-span-6" />
            <Skeleton className="h-[300px] col-span-12 md:col-span-6" />
            <Skeleton className="h-[300px] col-span-12 md:col-span-6" />
            <Skeleton className="h-[300px] col-span-12 md:col-span-6" />
         </div>
      </main>
   );
}

// Main Content

function HomePageContent() {
   const { data: dashboard } = useSuspenseQuery(
      orpc.analytics.getDefaultDashboard.queryOptions(),
   );

   return (
      <DashboardView dashboard={dashboard}>
         <QuickStartChecklist />
      </DashboardView>
   );
}

function HomePage() {
   return (
      <QueryBoundary
         fallback={<HomePageSkeleton />}
         errorTitle="Erro ao carregar dashboard"
         errorDescription="Não foi possível carregar o dashboard"
         retryText="Tentar novamente"
      >
         <HomePageContent />
      </QueryBoundary>
   );
}
