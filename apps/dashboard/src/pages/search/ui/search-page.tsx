import { Input } from "@packages/ui/components/input";
import { Separator } from "@packages/ui/components/separator";
import { cn } from "@packages/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Gauge, Loader2, Plus, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
   openDashboardTab,
   openInsightTab,
   useDashboardTabs,
} from "@/features/custom-dashboard/hooks/use-dashboard-tabs";
import { formatRelativeTime } from "@/features/custom-dashboard/hooks/use-insight-data";
import { useRoutes } from "@/features/custom-dashboard/hooks/use-routes";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";

export function SearchPage() {
   const { activeOrganization } = useActiveOrganization();
   const slug = activeOrganization?.slug;
   const navigate = useNavigate();
   const trpc = useTRPC();
   const { openDashboardTab: openDashboardTabHook } = useDashboardTabs();
   const { availableRoutes } = useRoutes();
   const [search, setSearch] = useState("");
   const inputRef = useRef<HTMLInputElement>(null);

   // Fetch dashboards
   const { data: dashboards, isLoading: isLoadingDashboards } = useQuery(
      trpc.dashboards.getAll.queryOptions(undefined, {
         staleTime: 30000,
      }),
   );

   // Fetch saved insights
   const { data: savedInsights, isLoading: isLoadingInsights } = useQuery(
      trpc.dashboards.getAllSavedInsights.queryOptions(
         { search: search || undefined },
         {
            staleTime: 30000,
         },
      ),
   );

   // Fetch recents
   const { data: recents, isLoading: isLoadingRecents } = useQuery(
      trpc.dashboards.getRecents.queryOptions(
         { limit: 10 },
         {
            staleTime: 30000,
         },
      ),
   );

   // Record access mutation for recents tracking
   const recordAccessMutation = useMutation(
      trpc.dashboards.recordAccess.mutationOptions(),
   );

   // Create dashboard mutation
   const createDashboardMutation = useMutation(
      trpc.dashboards.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Dashboard criado");
            openDashboardTabHook(data.id, data.name);
            if (slug) {
               navigate({
                  to: "/$slug/dashboards/$dashboardId",
                  params: { dashboardId: data.id, slug },
               });
            }
         },
         onError: (error) => {
            toast.error(error.message || "Falha ao criar dashboard");
         },
      }),
   );

   // Auto-focus search input on mount
   useEffect(() => {
      inputRef.current?.focus();
   }, []);

   // Keyboard shortcut to focus search (Cmd+K)
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if ((e.metaKey || e.ctrlKey) && e.key === "k") {
            e.preventDefault();
            inputRef.current?.focus();
         }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
   }, []);

   const handleOpenDashboard = useCallback(
      (dashboardId: string, name: string) => {
         // Record access for recents
         recordAccessMutation.mutate({
            itemType: "dashboard",
            itemId: dashboardId,
            itemName: name,
         });

         openDashboardTab(dashboardId, name);
         if (slug) {
            navigate({
               to: "/$slug/dashboards/$dashboardId",
               params: { dashboardId, slug },
            });
         }
      },
      [navigate, slug, recordAccessMutation],
   );

   const handleOpenInsight = useCallback(
      (insightId: string, name: string) => {
         recordAccessMutation.mutate({
            itemType: "insight",
            itemId: insightId,
            itemName: name,
         });

         openInsightTab(insightId, name);
         if (slug) {
            navigate({
               to: "/$slug/insights/$insightId",
               params: { insightId, slug },
            });
         }
      },
      [navigate, slug, recordAccessMutation],
   );

   const handleCreateDashboard = useCallback(() => {
      createDashboardMutation.mutate({
         name: "Novo Dashboard",
      });
   }, [createDashboardMutation]);

   const handleNavigateTo = useCallback(
      (route: string) => {
         if (slug) {
            navigate({
               to: route,
               params: { slug },
            });
         }
      },
      [navigate, slug],
   );

   // Filter items based on search
   const filteredDashboards = dashboards?.filter((d) =>
      d.name.toLowerCase().includes(search.toLowerCase()),
   );

   const filteredSavedInsights = savedInsights?.filter((insight) =>
      insight.name.toLowerCase().includes(search.toLowerCase()),
   );

   // Filter navigation items based on search and feature gates
   const filteredNavItems = useMemo(() => {
      // Filter out the search route itself and only include routes with sections
      const routes = availableRoutes.filter(
         (r) => r.section && r.key !== "search",
      );
      if (!search) return routes;
      return routes.filter((item) =>
         item.name.toLowerCase().includes(search.toLowerCase()),
      );
   }, [search, availableRoutes]);

   const isLoading =
      isLoadingDashboards || isLoadingInsights || isLoadingRecents;

   if (!slug) return null;

   return (
      <div className="flex flex-col h-full">
         {/* Search Header */}
         <div className="sticky top-0 z-10 bg-background border-b p-4">
            <div className="relative max-w-2xl mx-auto">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
               <Input
                  className="pl-10 h-11"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Pesquisar ou fazer uma pergunta à IA"
                  ref={inputRef}
                  value={search}
               />
               <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
               </kbd>
            </div>
         </div>

         {/* Content */}
         <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-4 space-y-6">
               {isLoading && (
                  <div className="flex items-center justify-center py-8">
                     <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
               )}

               {!isLoading && (
                  <>
                     {/* RECENTS Section */}
                     {!search && recents && recents.length > 0 && (
                        <section>
                           <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                              Recentes
                           </h3>
                           <div className="space-y-1">
                              {recents.map((item) => (
                                 <button
                                    className={cn(
                                       "flex items-center gap-3 w-full p-2 rounded-lg text-left",
                                       "hover:bg-accent transition-colors",
                                    )}
                                    key={item.id}
                                    onClick={() => {
                                       if (item.itemType === "dashboard") {
                                          handleOpenDashboard(
                                             item.itemId,
                                             item.itemName,
                                          );
                                       } else if (item.itemType === "insight") {
                                          handleOpenInsight(
                                             item.itemId,
                                             item.itemName,
                                          );
                                       }
                                    }}
                                    type="button"
                                 >
                                    <div
                                       className={cn(
                                          "flex items-center justify-center size-6 rounded",
                                          item.itemType === "dashboard"
                                             ? "bg-purple-500/15"
                                             : "bg-blue-500/15",
                                       )}
                                    >
                                       {item.itemType === "dashboard" ? (
                                          <Gauge className="size-3.5 text-purple-600 dark:text-purple-400" />
                                       ) : (
                                          <Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
                                       )}
                                    </div>
                                    <span className="flex-1 text-sm truncate">
                                       {item.itemName}
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                       {formatRelativeTime(item.accessedAt)}
                                    </span>
                                 </button>
                              ))}
                           </div>
                           <Separator className="mt-4" />
                        </section>
                     )}

                     {/* NAVIGATE Section - All routes */}
                     {filteredNavItems.length > 0 && (
                        <section>
                           <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                              Navegar
                           </h3>
                           <div className="space-y-1">
                              {filteredNavItems.map((item) => {
                                 const Icon = item.icon;
                                 return (
                                    <button
                                       className={cn(
                                          "flex items-center gap-3 w-full p-2 rounded-lg text-left",
                                          "hover:bg-accent transition-colors",
                                       )}
                                       key={item.key}
                                       onClick={() =>
                                          handleNavigateTo(item.url)
                                       }
                                       type="button"
                                    >
                                       <div
                                          className={cn(
                                             "flex items-center justify-center size-6 rounded",
                                             item.iconBg,
                                          )}
                                       >
                                          <Icon
                                             className={cn(
                                                "size-3.5",
                                                item.iconColor,
                                             )}
                                          />
                                       </div>
                                       <span className="flex-1 text-sm">
                                          {item.name}
                                       </span>
                                    </button>
                                 );
                              })}
                           </div>
                           <Separator className="mt-4" />
                        </section>
                     )}

                     {/* DASHBOARDS Section */}
                     <section>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                           Dashboards
                        </h3>
                        <div className="space-y-1">
                           {/* New Dashboard option */}
                           {!search && (
                              <button
                                 className={cn(
                                    "flex items-center gap-3 w-full p-2 rounded-lg text-left",
                                    "hover:bg-accent transition-colors",
                                 )}
                                 onClick={handleCreateDashboard}
                                 type="button"
                              >
                                 <div className="flex items-center justify-center size-6 rounded bg-purple-500/15">
                                    <Plus className="size-3.5 text-purple-600 dark:text-purple-400" />
                                 </div>
                                 <span className="flex-1 text-sm text-muted-foreground">
                                    Novo Dashboard
                                 </span>
                              </button>
                           )}

                           {/* Existing dashboards */}
                           {filteredDashboards?.map((dashboard) => (
                              <button
                                 className={cn(
                                    "flex items-center gap-3 w-full p-2 rounded-lg text-left",
                                    "hover:bg-accent transition-colors",
                                 )}
                                 key={dashboard.id}
                                 onClick={() =>
                                    handleOpenDashboard(
                                       dashboard.id,
                                       dashboard.name,
                                    )
                                 }
                                 type="button"
                              >
                                 <div className="flex items-center justify-center size-6 rounded bg-purple-500/15">
                                    <Gauge className="size-3.5 text-purple-600 dark:text-purple-400" />
                                 </div>
                                 <span className="flex-1 text-sm truncate">
                                    {dashboard.name}
                                 </span>
                                 <span className="text-xs text-muted-foreground shrink-0">
                                    {formatRelativeTime(dashboard.updatedAt)}
                                 </span>
                              </button>
                           ))}

                           {/* Empty state for dashboards */}
                           {(!filteredDashboards ||
                              filteredDashboards.length === 0) &&
                              search && (
                                 <p className="text-sm text-muted-foreground py-2">
                                    Nenhum dashboard encontrado
                                 </p>
                              )}
                        </div>
                        <Separator className="mt-4" />
                     </section>

                     {/* INSIGHTS Section */}
                     <section>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                           Insights
                        </h3>
                        <div className="space-y-1">
                           {/* New Insight option */}
                           {!search && (
                              <button
                                 className={cn(
                                    "flex items-center gap-3 w-full p-2 rounded-lg text-left",
                                    "hover:bg-accent transition-colors",
                                 )}
                                 onClick={() =>
                                    toast.info(
                                       "Crie um dashboard primeiro, depois adicione insights por lá",
                                    )
                                 }
                                 type="button"
                              >
                                 <div className="flex items-center justify-center size-6 rounded bg-blue-500/15">
                                    <Plus className="size-3.5 text-blue-600 dark:text-blue-400" />
                                 </div>
                                 <span className="flex-1 text-sm text-muted-foreground">
                                    Novo Insight
                                 </span>
                              </button>
                           )}

                           {/* Existing insights */}
                           {filteredSavedInsights
                              ?.slice(0, 10)
                              .map((insight) => (
                                 <button
                                    className={cn(
                                       "flex items-center gap-3 w-full p-2 rounded-lg text-left",
                                       "hover:bg-accent transition-colors",
                                    )}
                                    key={insight.id}
                                    onClick={() =>
                                       handleOpenInsight(
                                          insight.id,
                                          insight.name,
                                       )
                                    }
                                    type="button"
                                 >
                                    <div className="flex items-center justify-center size-6 rounded bg-blue-500/15">
                                       <Sparkles className="size-3.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                       <span className="text-sm truncate block">
                                          {insight.name}
                                       </span>
                                       {insight.description && (
                                          <span className="text-xs text-muted-foreground truncate block">
                                             {insight.description}
                                          </span>
                                       )}
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                       {formatRelativeTime(insight.updatedAt)}
                                    </span>
                                 </button>
                              ))}

                           {/* Empty state for insights */}
                           {(!filteredSavedInsights ||
                              filteredSavedInsights.length === 0) &&
                              search && (
                                 <p className="text-sm text-muted-foreground py-2">
                                    Nenhum insight encontrado
                                 </p>
                              )}
                        </div>
                     </section>

                     {/* Empty state when searching and no results */}
                     {search &&
                        filteredNavItems.length === 0 &&
                        (!filteredDashboards ||
                           filteredDashboards.length === 0) &&
                        (!filteredSavedInsights ||
                           filteredSavedInsights.length === 0) && (
                           <div className="text-center py-8">
                              <p className="text-muted-foreground">
                                 Nenhum resultado encontrado para "{search}"
                              </p>
                           </div>
                        )}
                  </>
               )}
            </div>
         </div>
      </div>
   );
}
