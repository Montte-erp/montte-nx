import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
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
import { Home, LayoutDashboard, Plus } from "lucide-react";
import { Suspense, useCallback, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { ContextPanelAction } from "@/features/context-panel/context-panel-info";
import { useContextPanelInfo } from "@/features/context-panel/use-context-panel";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { CreateDashboardForm } from "./-dashboards/create-dashboard-form";

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
      context.queryClient.prefetchQuery(orpc.dashboards.list.queryOptions({}));
   },
   pendingMs: 300,
   pendingComponent: DashboardsPageSkeleton,
   head: () => ({
      meta: [{ title: "Dashboards — Montte" }],
   }),
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

function DashboardsList() {
   const { openCredenza, closeCredenza } = useCredenza();
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
                           <span className="font-medium truncate">
                              {d.name}
                           </span>
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
      ],
      [slug, teamSlug],
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
            <Button
               onClick={() =>
                  openCredenza({
                     renderChildren: () => (
                        <CreateDashboardForm onSuccess={closeCredenza} />
                     ),
                  })
               }
            >
               <Plus className="size-4" />
               Novo dashboard
            </Button>
         </div>
      );
   }

   return (
      <DataTable
         columns={columns}
         data={dashboards as DashboardRow[]}
         getRowId={(row) => row.id}
         renderActions={({ row }) => {
            const d = row.original;
            if (d.isDefault) return null;
            return (
               <Button
                  disabled={setAsHomeMutation.isPending}
                  onClick={() => setAsHomeMutation.mutate({ id: d.id })}
                  size="icon"
                  variant="ghost"
               >
                  <Home className="size-4" />
                  <span className="sr-only">Definir como Home</span>
               </Button>
            );
         }}
      />
   );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DashboardsPage() {
   const { openCredenza, closeCredenza } = useCredenza();

   const handleCreateDashboard = useCallback(() => {
      openCredenza({
         renderChildren: () => (
            <CreateDashboardForm onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   useContextPanelInfo(() => (
      <ContextPanel>
         <ContextPanelHeader>
            <ContextPanelTitle>Ações</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent>
            <ContextPanelAction
               icon={Plus}
               label="Novo dashboard"
               onClick={handleCreateDashboard}
            />
         </ContextPanelContent>
      </ContextPanel>
   ));

   return (
      <main className="flex flex-col gap-4">
         <PageHeader
            actions={
               <Button onClick={handleCreateDashboard}>
                  <Plus className="size-4" />
                  Novo dashboard
               </Button>
            }
            description="Painéis personalizados com seus insights"
            title="Dashboards"
         />
         <EarlyAccessBanner template={ANALYTICS_BANNER} />
         <Suspense fallback={<DashboardsPageSkeleton />}>
            <DashboardsList />
         </Suspense>
      </main>
   );
}
