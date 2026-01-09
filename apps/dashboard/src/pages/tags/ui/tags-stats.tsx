import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { Skeleton } from "@packages/ui/components/skeleton";
import { StatsCard } from "@packages/ui/components/stats-card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

function TagsStatsErrorFallback(props: FallbackProps) {
   return (
      <div className="grid gap-4 h-min">
         {createErrorFallback({
            errorDescription:
               "Failed to load tags stats. Please try again later.",
            errorTitle: "Error loading stats",
            retryText: "Retry",
         })(props)}
      </div>
   );
}

function TagsStatsSkeleton() {
   return (
      <div className="grid grid-cols-2 gap-4">
         {[1, 2].map((index) => (
            <Card
               className="col-span-1 h-full w-full"
               key={`stats-skeleton-card-${index + 1}`}
            >
               <CardHeader>
                  <CardTitle>
                     <Skeleton className="h-6 w-24" />
                  </CardTitle>
                  <CardDescription>
                     <Skeleton className="h-4 w-32" />
                  </CardDescription>
               </CardHeader>
               <CardContent>
                  <Skeleton className="h-10 w-16" />
               </CardContent>
            </Card>
         ))}
      </div>
   );
}

function TagsStatsContent() {
   const trpc = useTRPC();
   const { data: stats } = useSuspenseQuery(trpc.tags.getStats.queryOptions());

   return (
      <div className="grid grid-cols-2 gap-4">
         <StatsCard
            description="Número total de tags que você criou."
            title="Total de tags"
            value={stats.totalTags}
         />
         <StatsCard
            description="A tag com mais transações este mês."
            title="Tag mais utilizada"
            value={stats.tagWithMostTransactions || "N/A"}
         />
      </div>
   );
}

export function TagsStats() {
   return (
      <ErrorBoundary FallbackComponent={TagsStatsErrorFallback}>
         <Suspense fallback={<TagsStatsSkeleton />}>
            <TagsStatsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
