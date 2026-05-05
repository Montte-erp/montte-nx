import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
   GitBranch,
   LayoutDashboard,
   Lightbulb,
   type LucideIcon,
   Plus,
   RotateCcw,
} from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import type { SubSidebarSection } from "./hooks/use-sidebar-store";
import { SubSidebarContextMenu } from "./sub-sidebar-context-menu";

interface SubSidebarItemListProps {
   section: SubSidebarSection;
   searchQuery: string;
   onItemClick?: () => void;
}

const INSIGHT_ICONS: Record<string, LucideIcon> = {
   trends: Lightbulb,
   funnels: GitBranch,
   retention: RotateCcw,
};

export function SubSidebarItemList(props: SubSidebarItemListProps) {
   return (
      <QueryBoundary
         errorTitle="Erro ao carregar lista"
         fallback={<ItemListSkeleton />}
      >
         <ItemListContent {...props} />
      </QueryBoundary>
   );
}

function ItemListSkeleton() {
   return (
      <div className="flex flex-1 flex-col gap-2 p-2">
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

function DashboardList({
   searchQuery,
   onItemClick,
}: {
   searchQuery: string;
   onItemClick?: () => void;
}) {
   const { slug, teamSlug } = useDashboardSlugs();
   const { data: dashboards } = useSuspenseQuery(
      orpc.dashboards.list.queryOptions({}),
   );

   const query = searchQuery.trim().toLowerCase();
   const filtered = query
      ? dashboards.filter((d) => d.name.toLowerCase().includes(query))
      : dashboards;

   if (filtered.length === 0) {
      return (
         <EmptyState
            hasSearchQuery={query.length > 0}
            section="dashboards"
            slug={slug}
            teamSlug={teamSlug}
         />
      );
   }

   return (
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
         {filtered.map((dashboard) => (
            <li className="group flex items-center gap-2" key={dashboard.id}>
               <Link
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 text-sm hover:bg-accent"
                  onClick={onItemClick}
                  params={{ slug, teamSlug, dashboardId: dashboard.id }}
                  to="/$slug/$teamSlug/analytics/dashboards/$dashboardId"
               >
                  <LayoutDashboard className="size-4 shrink-0" />
                  <span className="truncate">{dashboard.name}</span>
               </Link>
               <SubSidebarContextMenu
                  item={{ id: dashboard.id, name: dashboard.name }}
                  section="dashboards"
               />
            </li>
         ))}
      </ul>
   );
}

function InsightList({
   searchQuery,
   onItemClick,
}: {
   searchQuery: string;
   onItemClick?: () => void;
}) {
   const { slug, teamSlug } = useDashboardSlugs();
   const { data: insights } = useSuspenseQuery(
      orpc.insights.list.queryOptions({}),
   );

   const query = searchQuery.trim().toLowerCase();
   const filtered = query
      ? insights.filter((i) => i.name.toLowerCase().includes(query))
      : insights;

   if (filtered.length === 0) {
      return (
         <EmptyState
            hasSearchQuery={query.length > 0}
            section="insights"
            slug={slug}
            teamSlug={teamSlug}
         />
      );
   }

   return (
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
         {filtered.map((insight) => {
            const Icon = INSIGHT_ICONS[insight.type] ?? Lightbulb;
            return (
               <li className="group flex items-center gap-2" key={insight.id}>
                  <Link
                     className="flex min-w-0 flex-1 items-center gap-2 rounded-md p-2 text-sm hover:bg-accent"
                     onClick={onItemClick}
                     params={{ slug, teamSlug, insightId: insight.id }}
                     to="/$slug/$teamSlug/analytics/insights/$insightId"
                  >
                     <Icon className="size-4 shrink-0" />
                     <span className="truncate">{insight.name}</span>
                  </Link>
                  <SubSidebarContextMenu
                     item={{ id: insight.id, name: insight.name }}
                     section="insights"
                  />
               </li>
            );
         })}
      </ul>
   );
}

function EmptyState({
   section,
   hasSearchQuery,
   slug,
   teamSlug,
}: {
   section: SubSidebarSection;
   hasSearchQuery: boolean;
   slug: string;
   teamSlug: string;
}) {
   const label = section === "dashboards" ? "dashboard" : "insight";
   const Icon = section === "dashboards" ? LayoutDashboard : Lightbulb;
   const title = hasSearchQuery
      ? `Nenhum ${label} encontrado`
      : `Nenhum ${label} ainda`;

   return (
      <Empty>
         <EmptyHeader>
            <EmptyMedia variant="icon">
               <Icon />
            </EmptyMedia>
            <EmptyTitle>{title}</EmptyTitle>
         </EmptyHeader>
         {!hasSearchQuery && (
            <EmptyContent>
               <Button asChild size="sm" variant="outline">
                  {section === "dashboards" ? (
                     <Link
                        params={{ slug, teamSlug }}
                        to="/$slug/$teamSlug/analytics/dashboards"
                     >
                        <Plus className="size-4" />
                        Novo dashboard
                     </Link>
                  ) : (
                     <Link
                        params={{ slug, teamSlug }}
                        to="/$slug/$teamSlug/analytics/insights"
                     >
                        <Plus className="size-4" />
                        Novo insight
                     </Link>
                  )}
               </Button>
            </EmptyContent>
         )}
      </Empty>
   );
}
