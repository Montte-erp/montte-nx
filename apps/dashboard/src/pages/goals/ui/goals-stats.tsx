"use client";

import { formatDecimalCurrency } from "@packages/money";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Target, TrendingUp } from "lucide-react";
import { useTRPC } from "@/integrations/clients";

export function GoalsStats() {
   const trpc = useTRPC();

   const { data: goals, isLoading } = useQuery(
      trpc.goals.getAll.queryOptions({}),
   );

   if (isLoading) {
      return <GoalsStatsSkeleton />;
   }

   const activeGoals = goals?.filter((g) => g.status === "active") ?? [];
   const completedGoals = goals?.filter((g) => g.status === "completed") ?? [];

   const totalTarget = activeGoals.reduce(
      (sum, g) => sum + Number(g.targetAmount),
      0,
   );
   const totalCurrent = activeGoals.reduce(
      (sum, g) => sum + g.currentAmount,
      0,
   );
   const overallProgress =
      totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

   const goalsNearingDeadline = activeGoals.filter((g) => {
      if (!g.targetDate) return false;
      const daysRemaining = Math.ceil(
         (new Date(g.targetDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
      );
      return daysRemaining <= 30 && daysRemaining > 0;
   });

   const stats = [
      {
         title: "Metas Ativas",
         value: activeGoals.length.toString(),
         description: `${completedGoals.length} concluidas`,
         icon: Target,
         color: "text-blue-500",
      },
      {
         title: "Progresso Total",
         value: `${overallProgress}%`,
         description: formatDecimalCurrency(totalCurrent),
         icon: TrendingUp,
         color: "text-green-500",
      },
      {
         title: "Valor Alvo Total",
         value: formatDecimalCurrency(totalTarget),
         description: "Soma de todas as metas ativas",
         icon: CheckCircle2,
         color: "text-purple-500",
      },
      {
         title: "Prazos Proximos",
         value: goalsNearingDeadline.length.toString(),
         description: "Metas com prazo em 30 dias",
         icon: Clock,
         color: "text-orange-500",
      },
   ];

   return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         {stats.map((stat) => {
            const Icon = stat.icon;
            return (
               <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                     <CardTitle className="text-sm font-medium">
                        {stat.title}
                     </CardTitle>
                     <Icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                     <div className="text-2xl font-bold">{stat.value}</div>
                     <p className="text-xs text-muted-foreground">
                        {stat.description}
                     </p>
                  </CardContent>
               </Card>
            );
         })}
      </div>
   );
}

function GoalsStatsSkeleton() {
   return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
         {Array.from({ length: 4 }).map((_, i) => (
            <Card key={`stats-skeleton-${i + 1}`}>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
               </CardHeader>
               <CardContent>
                  <Skeleton className="h-8 w-16 mb-1" />
                  <Skeleton className="h-3 w-32" />
               </CardContent>
            </Card>
         ))}
      </div>
   );
}
