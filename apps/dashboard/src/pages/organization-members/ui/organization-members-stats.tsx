import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { StatsCard } from "@packages/ui/components/stats-card";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Shield, UserCheck, UserPlus, Users } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

function MembersStatsContent() {
   const trpc = useTRPC();

   const { data: membersData } = useSuspenseQuery(
      trpc.organization.getActiveOrganizationMembers.queryOptions(),
   );

   const stats = {
      active: membersData.filter((member) => member.createdAt).length,
      admins: membersData.filter((member) => member.role === "admin").length,
      members: membersData.filter((member) => member.role === "member").length,
      total: membersData.length,
   };

   const statCards = [
      {
         description: "Todos os membros da organização",
         icon: <Users className="size-4" />,
         title: "Total de Membros",
         value: stats.total,
         variant: "default" as const,
      },
      {
         description: "Membros ativos",
         icon: <UserCheck className="size-4" />,
         title: "Membros Ativos",
         value: stats.active,
         variant: "secondary" as const,
      },
      {
         description: "Usuários com função de Membro",
         icon: <UserPlus className="size-4" />,
         title: "Membros",
         value: stats.members,
         variant: "default" as const,
      },
      {
         description: "Membros administradores",
         icon: <Shield className="size-4" />,
         title: "Administradores",
         value: stats.admins,
         variant: "default" as const,
      },
   ];

   return (
      <div className="grid h-min grid-cols-2 gap-4">
         {statCards.map((stat) => (
            <StatsCard
               description={stat.description}
               key={stat.title}
               title={stat.title}
               value={stat.value}
            />
         ))}
      </div>
   );
}

function MembersStatsSkeleton() {
   return (
      <div className="grid h-min grid-cols-2 gap-4">
         {[1, 2, 3, 4].map((index) => (
            <Card
               className="col-span-1 h-full w-full"
               key={`members-stats-skeleton-card-${index + 1}`}
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

function MembersStatsErrorFallback({ error }: { error: Error }) {
   return (
      <Card className="w-full">
         <CardHeader>
            <CardTitle>Estatísticas de Membros</CardTitle>
            <CardDescription>
               Visão geral de todas as métricas de membros
            </CardDescription>
         </CardHeader>
         <CardContent>
            <div className="text-center py-4">
               <p className="text-sm text-muted-foreground">
                  Unable to load member statistics
               </p>
               <p className="text-xs text-muted-foreground mt-1">
                  {error.message}
               </p>
            </div>
         </CardContent>
      </Card>
   );
}

export function MembersStats() {
   return (
      <ErrorBoundary FallbackComponent={MembersStatsErrorFallback}>
         <Suspense fallback={<MembersStatsSkeleton />}>
            <MembersStatsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
