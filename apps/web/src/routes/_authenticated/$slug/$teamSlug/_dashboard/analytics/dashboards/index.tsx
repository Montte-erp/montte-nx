import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import { DataTable } from "@packages/ui/components/data-table";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import {
   Home,
   LayoutDashboard,
   LayoutGrid,
   LayoutList,
   Plus,
} from "lucide-react";
import { Suspense, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { DashboardListCard } from "@/features/analytics/ui/dashboard-list-card";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { ContextPanelAction } from "@/features/context-panel/context-panel-info";
import { useContextPanelInfo } from "@/features/context-panel/use-context-panel";
import { setChatMode } from "@/features/teco-chat/stores/chat-context-store";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { orpc } from "@/integrations/orpc/client";

const ANALYTICS_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Analytics Avançado",
   message: "Esta funcionalidade está em fase beta.",
   ctaLabel: "Deixar feedback",
   stage: "beta",
   icon: LayoutDashboard,
   bullets: [
      "Crie dashboards personalizados com seus insights financeiros e operacionais",
      "Acompanhe fluxo de caixa, metas e desempenho em tempo real",
      "Seu feedback nos ajuda a melhorar",
   ],
};

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/analytics/dashboards/",
)({
   loader: ({ context }) => {
      setChatMode("analytics");
      context.queryClient.prefetchQuery(orpc.dashboards.list.queryOptions({}));
   },
   component: DashboardsPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardRow {
   id: string;
   name: string;
   description?: string | null;
   tiles: unknown;
   updatedAt: Date | string;
   isDefault?: boolean;
}

// ---------------------------------------------------------------------------
// View config
// ---------------------------------------------------------------------------

const DASHBOARD_VIEWS: [
   ViewConfig<"card" | "table">,
   ViewConfig<"card" | "table">,
] = [
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
];

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DashboardsPageSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton className="h-14 w-full" key={`dash-skeleton-${i + 1}`} />
         ))}
      </div>
   );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

interface DashboardsListProps {
   view: "card" | "table";
}

function DashboardsList({ view }: DashboardsListProps) {
   const { slug, teamSlug } = Route.useParams();
   const queryClient = useQueryClient();

   const { data: dashboards } = useSuspenseQuery(
      orpc.dashboards.list.queryOptions({}),
   );

   const setAsHomeMutation = useMutation(
      orpc.dashboards.setAsHome.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: orpc.dashboards.list.queryKey({}),
            });
            queryClient.invalidateQueries({
               queryKey: orpc.analytics.getDefaultDashboard.queryKey(),
            });
         },
      }),
   );

   const columns = useMemo<ColumnDef<DashboardRow>[]>(
      () => [
         {
            id: "name",
            header: "Nome",
            cell: ({ row }) => {
               const d = row.original;
               return (
                  <Link
                     className="flex items-center gap-3"
                     params={{ slug, teamSlug, dashboardId: d.id }}
                     to="/$slug/$teamSlug/analytics/dashboards/$dashboardId"
                  >
                     <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <LayoutDashboard className="size-4 text-primary" />
                     </div>
                     <div className="min-w-0">
                        <div className="flex items-center gap-2">
                           <span className="font-medium truncate">{d.name}</span>
                           {d.isDefault && (
                              <Badge
                                 className="gap-1 shrink-0"
                                 variant="secondary"
                              >
                                 <Home className="size-3" />
                                 Home
                              </Badge>
                           )}
                        </div>
                        {d.description && (
                           <p className="text-xs text-muted-foreground truncate">
                              {d.description}
                           </p>
                        )}
                     </div>
                  </Link>
               );
            },
         },
         {
            id: "tileCount",
            header: "Tiles",
            cell: ({ row }) => (
               <span className="text-sm text-muted-foreground">
                  {Array.isArray(row.original.tiles)
                     ? row.original.tiles.length
                     : 0}{" "}
                  tiles
               </span>
            ),
         },
         {
            id: "updatedAt",
            header: "Atualizado",
            cell: ({ row }) => (
               <span className="text-sm text-muted-foreground">
                  {new Date(row.original.updatedAt).toLocaleDateString("pt-BR")}
               </span>
            ),
         },
         {
            id: "actions",
            header: "",
            cell: ({ row }) => {
               const d = row.original;
               if (d.isDefault) return null;
               return (
                  <div className="flex items-center justify-end gap-1">
                     <Button
                        disabled={setAsHomeMutation.isPending}
                        onClick={() => setAsHomeMutation.mutate({ id: d.id })}
                        size="icon"
                        variant="ghost"
                     >
                        <Home className="size-4" />
                        <span className="sr-only">Definir como Home</span>
                     </Button>
                  </div>
               );
            },
         },
      ],
      [slug, teamSlug, setAsHomeMutation],
   );

   if (dashboards.length === 0) {
      return (
         <div className="flex flex-col items-center justify-center py-16 text-center">
            <LayoutDashboard className="size-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">
               Nenhum dashboard ainda
            </h2>
            <p className="text-muted-foreground mb-4 max-w-md">
               Crie seu primeiro dashboard para organizar seus insights em um
               painel visual.
            </p>
            <Button>
               <Plus className="size-4 mr-1" />
               Novo dashboard
            </Button>
         </div>
      );
   }

   if (view === "table") {
      return (
         <DataTable
            columns={columns}
            data={dashboards as DashboardRow[]}
            getRowId={(row) => row.id}
            renderMobileCard={({ row }) => {
               const d = row.original as DashboardRow;
               return (
                  <Card>
                     <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                           <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <LayoutDashboard className="size-4 text-primary" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                 <p className="font-medium truncate">{d.name}</p>
                                 {d.isDefault && (
                                    <Badge
                                       className="gap-1 shrink-0"
                                       variant="secondary"
                                    >
                                       <Home className="size-3" />
                                       Home
                                    </Badge>
                                 )}
                              </div>
                              {d.description && (
                                 <p className="text-xs text-muted-foreground truncate">
                                    {d.description}
                                 </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                 {Array.isArray(d.tiles) ? d.tiles.length : 0}{" "}
                                 tiles
                                 {" · "}
                                 {new Date(d.updatedAt).toLocaleDateString(
                                    "pt-BR",
                                 )}
                              </p>
                           </div>
                           {!d.isDefault && (
                              <Button
                                 disabled={setAsHomeMutation.isPending}
                                 onClick={() =>
                                    setAsHomeMutation.mutate({ id: d.id })
                                 }
                                 size="icon"
                                 variant="ghost"
                              >
                                 <Home className="size-4" />
                                 <span className="sr-only">
                                    Definir como Home
                                 </span>
                              </Button>
                           )}
                        </div>
                     </CardContent>
                  </Card>
               );
            }}
         />
      );
   }

   return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
         {dashboards.map((dashboard) => (
            <DashboardListCard
               description={dashboard.description}
               id={dashboard.id}
               isDefault={dashboard.isDefault}
               key={dashboard.id}
               name={dashboard.name}
               slug={slug}
               teamSlug={teamSlug}
               tileCount={
                  Array.isArray(dashboard.tiles) ? dashboard.tiles.length : 0
               }
               updatedAt={dashboard.updatedAt.toString()}
            />
         ))}
      </div>
   );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardsPage() {
   const { currentView, setView, views } = useViewSwitch(
      "analytics:dashboards:view",
      DASHBOARD_VIEWS,
   );

   useContextPanelInfo(
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Ações</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent>
            <ContextPanelAction
               icon={Plus}
               label="Novo dashboard"
               onClick={() => {
                  // TODO: Wire to create dashboard action
               }}
            />
         </ContextPanelContent>
      </ContextPanel>,
   );

   return (
      <main className="flex flex-col gap-4">
         <PageHeader
            actions={
               <Button>
                  <Plus className="size-4 mr-1" />
                  Novo dashboard
               </Button>
            }
            description="Painéis personalizados com seus insights"
            panelViewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
            title="Dashboards"
         />
         <EarlyAccessBanner template={ANALYTICS_BANNER} />
         <Suspense fallback={<DashboardsPageSkeleton />}>
            <DashboardsList view={currentView} />
         </Suspense>
      </main>
   );
}
