import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import {
   GitBranch,
   LayoutDashboard,
   Lightbulb,
   Plus,
   RotateCcw,
} from "lucide-react";
import { Suspense, useMemo } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { orpc } from "@/integrations/orpc/client";
import type { SubSidebarSection } from "../hooks/use-sidebar-store";
import { SubSidebarContextMenu } from "./sub-sidebar-context-menu";

interface SubSidebarItemListProps {
   section: SubSidebarSection;
   searchQuery: string;
   onItemClick?: () => void;
}

export function SubSidebarItemList({
   section,
   searchQuery,
   onItemClick,
}: SubSidebarItemListProps) {
   return (
      <ErrorBoundary
         fallbackRender={({ error }) => (
            <div className="flex-1 flex items-center justify-center p-4">
               <p className="text-sm text-destructive text-center">
                  Erro ao carregar lista: {(error as Error).message}
               </p>
            </div>
         )}
      >
         <Suspense fallback={<ItemListSkeleton />}>
            <ItemListContent
               onItemClick={onItemClick}
               searchQuery={searchQuery}
               section={section}
            />
         </Suspense>
      </ErrorBoundary>
   );
}

function ItemListSkeleton() {
   return (
      <div className="flex-1 flex flex-col gap-1 p-2">
         {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
               className="h-8 w-full rounded-md"
               key={`sidebar-skeleton-${i + 1}`}
            />
         ))}
      </div>
   );
}

function ItemListContent({
   section,
   searchQuery,
   onItemClick,
}: SubSidebarItemListProps) {
   if (section === "dashboards") {
      return (
         <DashboardList onItemClick={onItemClick} searchQuery={searchQuery} />
      );
   }
   return <InsightList onItemClick={onItemClick} searchQuery={searchQuery} />;
}

const INSIGHT_ICONS: Record<string, typeof Lightbulb> = {
   trends: Lightbulb,
   funnels: GitBranch,
   retention: RotateCcw,
};

function getInsightIcon(type: string) {
   return INSIGHT_ICONS[type] ?? Lightbulb;
}

function DashboardList({
   searchQuery,
   onItemClick,
}: {
   searchQuery: string;
   onItemClick?: () => void;
}) {
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });

   const { data: dashboards } = useSuspenseQuery(
      orpc.dashboards.list.queryOptions({}),
   );

   const filtered = useMemo(() => {
      if (!searchQuery.trim()) return dashboards;
      const query = searchQuery.toLowerCase();
      return dashboards.filter((d) => d.name.toLowerCase().includes(query));
   }, [dashboards, searchQuery]);

   if (filtered.length === 0) {
      return (
         <EmptyState
            hasSearchQuery={searchQuery.trim().length > 0}
            section="dashboards"
            slug={slug}
         />
      );
   }

   return (
      <div className="flex-1 overflow-y-auto p-1">
         <ul className="flex flex-col gap-0.5">
            {filtered.map((dashboard) => (
               <li className="group" key={dashboard.id}>
                  <div
                     className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        "text-foreground hover:bg-accent",
                     )}
                  >
                     <Link
                        className="flex items-center gap-2 min-w-0 flex-1"
                        onClick={onItemClick}
                        params={{
                           slug,
                           teamSlug,
                           dashboardId: dashboard.id,
                        }}
                        to={
                           "/$slug/$teamSlug/analytics/dashboards/$dashboardId"
                        }
                     >
                        <LayoutDashboard className="size-4 flex-shrink-0" />
                        <span className="truncate">{dashboard.name}</span>
                     </Link>
                     <SubSidebarContextMenu
                        item={{
                           id: dashboard.id,
                           name: dashboard.name,
                        }}
                        section="dashboards"
                     />
                  </div>
               </li>
            ))}
         </ul>
      </div>
   );
}

function InsightList({
   searchQuery,
   onItemClick,
}: {
   searchQuery: string;
   onItemClick?: () => void;
}) {
   const { slug, teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });

   const { data: insights } = useSuspenseQuery(
      orpc.insights.list.queryOptions({}),
   );

   const filtered = useMemo(() => {
      if (!searchQuery.trim()) return insights;
      const query = searchQuery.toLowerCase();
      return insights.filter((i) => i.name.toLowerCase().includes(query));
   }, [insights, searchQuery]);

   if (filtered.length === 0) {
      return (
         <EmptyState
            hasSearchQuery={searchQuery.trim().length > 0}
            section="insights"
            slug={slug}
         />
      );
   }

   return (
      <div className="flex-1 overflow-y-auto p-1">
         <ul className="flex flex-col gap-0.5">
            {filtered.map((insight) => {
               const Icon = getInsightIcon(insight.type);
               return (
                  <li className="group" key={insight.id}>
                     <div
                        className={cn(
                           "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                           "text-foreground hover:bg-accent",
                        )}
                     >
                        <Link
                           className="flex items-center gap-2 min-w-0 flex-1"
                           onClick={onItemClick}
                           params={{
                              slug,
                              teamSlug,
                              insightId: insight.id,
                           }}
                           to={"/$slug/$teamSlug/analytics/insights/$insightId"}
                        >
                           <Icon className="size-4 flex-shrink-0" />
                           <span className="truncate">{insight.name}</span>
                        </Link>
                        <SubSidebarContextMenu
                           item={{
                              id: insight.id,
                              name: insight.name,
                           }}
                           section="insights"
                        />
                     </div>
                  </li>
               );
            })}
         </ul>
      </div>
   );
}

function EmptyState({
   section,
   hasSearchQuery,
   slug,
}: {
   section: SubSidebarSection;
   hasSearchQuery: boolean;
   slug: string;
}) {
   const label = section === "dashboards" ? "dashboard" : "insight";
   const Icon = section === "dashboards" ? LayoutDashboard : Lightbulb;
   const { teamSlug } = useParams({
      from: "/_authenticated/$slug/$teamSlug/_dashboard",
   });
   const teamSegment = teamSlug ? `/${teamSlug}` : "";
   const listRoute =
      section === "dashboards"
         ? `/${slug}${teamSegment}/analytics/dashboards`
         : `/${slug}${teamSegment}/analytics/insights`;

   return (
      <Empty>
         <EmptyHeader>
            <EmptyMedia variant="icon">
               <Icon />
            </EmptyMedia>
            <EmptyTitle>
               {hasSearchQuery
                  ? section === "dashboards"
                     ? "Nenhum dashboard encontrado"
                     : "Nenhum insight encontrado"
                  : section === "dashboards"
                    ? "Nenhum dashboard ainda"
                    : "Nenhum insight ainda"}
            </EmptyTitle>
         </EmptyHeader>
         {!hasSearchQuery && (
            <EmptyContent>
               <Button asChild variant="outline" size="sm">
                  <Link to={listRoute}>
                     <Plus className="size-3.5" />
                     Novo {label}
                  </Link>
               </Button>
            </EmptyContent>
         )}
      </Empty>
   );
}
