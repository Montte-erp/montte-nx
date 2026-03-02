import { formatAmount, fromMinorUnits } from "@f-o-t/money";
import { Badge } from "@packages/ui/components/badge";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Calendar, DollarSign, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { orpc } from "@/integrations/orpc/client";

// =============================================================================
// StatCard
// =============================================================================

interface StatCardProps {
   label: string;
   value: string | number;
   icon: ReactNode;
   children?: ReactNode;
}

function StatCard({ label, value, icon, children }: StatCardProps) {
   return (
      <div className="rounded-lg border bg-card p-4 space-y-2">
         <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {icon}
            <span>{label}</span>
         </div>
         <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {value}
         </p>
         {children}
      </div>
   );
}

// =============================================================================
// AnalyticsContent
// =============================================================================

function AnalyticsContent() {
   const { data: activeSubscriptions } = useSuspenseQuery(
      orpc.services.getAllSubscriptions.queryOptions({
         input: { status: "active" },
      }),
   );

   const { data: expiringSoon } = useSuspenseQuery(
      orpc.services.getExpiringSoon.queryOptions({}),
   );

   const mrr = activeSubscriptions.reduce(
      (sum, sub) => sum + sub.negotiatedPrice,
      0,
   );

   const mrrFormatted = formatAmount(fromMinorUnits(mrr, "BRL"), "pt-BR");

   const activeCount = activeSubscriptions.length;
   const expiringCount = expiringSoon.length;

   const expiringBadges = expiringSoon.slice(0, 3);

   return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
         <StatCard
            icon={<DollarSign className="size-4" />}
            label="Receita mensal ativa"
            value={mrrFormatted}
         />

         <StatCard
            icon={<Users className="size-4" />}
            label="Assinaturas ativas"
            value={activeCount}
         />

         <StatCard
            icon={<Calendar className="size-4" />}
            label="Vencem em 30 dias"
            value={expiringCount}
         >
            {expiringCount > 0 && (
               <div className="flex flex-wrap gap-1">
                  {expiringBadges.map((sub) => (
                     <Badge key={sub.id} variant="outline">
                        {sub.endDate
                           ? new Date(sub.endDate).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                             })
                           : "—"}
                     </Badge>
                  ))}
               </div>
            )}
         </StatCard>
      </div>
   );
}

// =============================================================================
// ServicesAnalyticsHeader
// =============================================================================

export function ServicesAnalyticsHeader() {
   return (
      <Suspense
         fallback={
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
               {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton
                     className="h-20 w-full"
                     key={`stat-skeleton-${i + 1}`}
                  />
               ))}
            </div>
         }
      >
         <AnalyticsContent />
      </Suspense>
   );
}
