import { cn } from "@packages/ui/lib/utils";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Button } from "@packages/ui/components/button";
import {
   SidebarContent,
   SidebarInput,
   SidebarMenuAction,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
   ArrowDownAZ,
   ArrowUpAZ,
   ChartArea,
   FolderKanban,
   MoreHorizontal,
   Search,
   Sparkles,
   SortAsc,
   Copy,
   ExternalLink,
   PanelTop,
} from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";
import { useDashboardTabs } from "@/features/custom-dashboard/hooks/use-dashboard-tabs";
import { useSubmenu } from "./sidebar-submenu-context";
import { useSubmenuData } from "./hooks/use-submenu-data";
import {
   CollapsibleSection,
   EmptyState,
   getRelativeTime,
   LoadingSkeleton,
   PanelHeader,
   SORT_OPTIONS,
} from "./sidebar-panel-shared";

type ReportItemRowProps = {
   id: string;
   name: string;
   type: "dashboard" | "insight";
   timestamp?: Date;
   isActive: boolean;
   onClick: () => void;
   slug: string;
};

function ReportItemRow({ id, name, type, timestamp, isActive, onClick, slug }: ReportItemRowProps) {
   const trpc = useTRPC();
   const navigate = useNavigate();
   const { openDashboardTab, openInsightTab } = useDashboardTabs();
   const Icon = type === "dashboard" ? FolderKanban : Sparkles;
   const url = type === "dashboard" ? `/${slug}/dashboards/${id}` : `/${slug}/insights/${id}`;

   const recordAccessMutation = useMutation(
      trpc.dashboards.recordAccess.mutationOptions(),
   );

   const handleClick = () => {
      recordAccessMutation.mutate({
         itemType: type,
         itemId: id,
         itemName: name,
      });
      onClick();
   };

   const handleOpenInNewTab = () => {
      if (type === "dashboard") {
         openDashboardTab(id, name);
         navigate({
            to: "/$slug/dashboards/$dashboardId",
            params: { slug, dashboardId: id },
         });
      } else {
         openInsightTab(id, name);
         navigate({
            to: "/$slug/insights/$insightId",
            params: { slug, insightId: id },
         });
      }
   };

   const handleOpenBrowserTab = () => {
      window.open(url, "_blank");
   };

   const handleCopyLink = async () => {
      try {
         const fullUrl = `${window.location.origin}${url}`;
         await navigator.clipboard.writeText(fullUrl);
         toast.success("Link copiado");
      } catch {
         toast.error("Falha ao copiar o link");
      }
   };

   return (
      <SidebarMenuItem>
         <SidebarMenuButton
            asChild
            isActive={isActive}
            className={cn(isActive && "bg-primary/10 text-primary")}
         >
            <Link to={url} onClick={handleClick}>
               <Icon className="size-4 shrink-0" />
               <span className="flex-1 truncate">{name}</span>
               {timestamp && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                     {getRelativeTime(timestamp)}
                  </span>
               )}
            </Link>
         </SidebarMenuButton>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <SidebarMenuAction showOnHover>
                  <MoreHorizontal className="size-4" />
                  <span className="sr-only">Mais opções</span>
               </SidebarMenuAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="min-w-48">
               <DropdownMenuItem onClick={handleOpenInNewTab}>
                  <PanelTop className="size-4 mr-2" />
                  Abrir em nova aba
               </DropdownMenuItem>
               <DropdownMenuItem onClick={handleOpenBrowserTab}>
                  <ExternalLink className="size-4 mr-2" />
                  Abrir em nova janela
               </DropdownMenuItem>
               <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="size-4 mr-2" />
                  Copiar link
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </SidebarMenuItem>
   );
}

export function SidebarReportsPanel() {
   const { panelState, setSearch, setSort, toggleSection, closeSubmenu } =
      useSubmenu();
   const { setOpenMobile } = useSidebar();
   const { pathname } = useLocation();
   const navigate = useNavigate();

   const slug = pathname.split("/")[1] || "";

   const { dashboards, insights, recents, isLoading, totalDashboards, totalInsights } =
      useSubmenuData({
         search: panelState.search,
         sortBy: panelState.sortBy,
         sortDirection: panelState.sortDirection,
         enabled: true,
      });

   const isActive = (type: "dashboard" | "insight", id: string) => {
      if (type === "dashboard") {
         return pathname === `/${slug}/dashboards/${id}`;
      }
      return pathname === `/${slug}/insights/${id}`;
   };

   const handleItemClick = () => {
      setOpenMobile(false);
      closeSubmenu();
   };

   const handleCreateDashboard = () => {
      navigate({ to: "/$slug/dashboards", params: { slug } });
      handleItemClick();
   };

   const handleCreateInsight = () => {
      navigate({ to: "/$slug/insights", params: { slug } });
      handleItemClick();
   };

   const hasNoResults =
      !isLoading &&
      recents.length === 0 &&
      dashboards.length === 0 &&
      insights.length === 0;

   return (
      <div className="flex flex-col h-full">
         {/* Panel Header with title and create dropdown */}
         <PanelHeader
            title="Análises"
            icon={ChartArea}
            createOptions={[
               {
                  icon: FolderKanban,
                  label: "Novo Dashboard",
                  onClick: handleCreateDashboard,
               },
               {
                  icon: Sparkles,
                  label: "Novo Insight",
                  onClick: handleCreateInsight,
               },
            ]}
         />

         {/* Header with search and sort */}
         <div className="h-14 flex items-center gap-2 px-3 border-b border-sidebar-border">
            <div className="relative flex-1">
               <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
               <SidebarInput
                  type="text"
                  placeholder="Buscar..."
                  value={panelState.search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
               />
            </div>
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8 shrink-0">
                     <SortAsc className="size-4" />
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="w-48">
                  {SORT_OPTIONS.map((option) => {
                     const Icon = option.icon;
                     const isSelected = panelState.sortBy === option.value;
                     return (
                        <DropdownMenuItem
                           key={option.value}
                           onClick={() => setSort(option.value)}
                           className={cn(isSelected && "bg-accent")}
                        >
                           <Icon className="size-4 mr-2" />
                           {option.label}
                           {isSelected && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                 {panelState.sortDirection === "asc" ? "A-Z" : "Z-A"}
                              </span>
                           )}
                        </DropdownMenuItem>
                     );
                  })}
                  <DropdownMenuItem
                     onClick={() =>
                        setSort(
                           panelState.sortBy,
                           panelState.sortDirection === "asc" ? "desc" : "asc",
                        )
                     }
                  >
                     {panelState.sortDirection === "asc" ? (
                        <ArrowDownAZ className="size-4 mr-2" />
                     ) : (
                        <ArrowUpAZ className="size-4 mr-2" />
                     )}
                     {panelState.sortDirection === "asc"
                        ? "Ordem decrescente"
                        : "Ordem crescente"}
                  </DropdownMenuItem>
               </DropdownMenuContent>
            </DropdownMenu>
         </div>

         {/* Content area with tree view */}
         <SidebarContent>
            {isLoading ? (
               <LoadingSkeleton />
            ) : hasNoResults ? (
               <EmptyState search={panelState.search} />
            ) : (
               <div className="py-2">
                  {/* Recents Section */}
                  {recents.length > 0 && !panelState.search && (
                     <CollapsibleSection
                        title="Recentes"
                        isExpanded={panelState.expandedSections.includes("recents")}
                        onToggle={() => toggleSection("recents")}
                     >
                        {recents.map((item) => (
                           <ReportItemRow
                              key={`recent-${item.id}`}
                              id={item.itemId}
                              name={item.itemName}
                              type={item.itemType}
                              timestamp={item.accessedAt}
                              isActive={isActive(item.itemType, item.itemId)}
                              onClick={handleItemClick}
                              slug={slug}
                           />
                        ))}
                     </CollapsibleSection>
                  )}

                  {/* Dashboards Section */}
                  <CollapsibleSection
                     title="Dashboards"
                     count={totalDashboards}
                     isExpanded={panelState.expandedSections.includes("dashboards")}
                     onToggle={() => toggleSection("dashboards")}
                     action={
                        <Link
                           to="/$slug/dashboards"
                           params={{ slug }}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                           Ver todos
                        </Link>
                     }
                  >
                     {dashboards.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhum dashboard encontrado
                        </p>
                     ) : (
                        dashboards.map((dashboard) => (
                           <ReportItemRow
                              key={`dashboard-${dashboard.id}`}
                              id={dashboard.id}
                              name={dashboard.name}
                              type="dashboard"
                              timestamp={dashboard.updatedAt}
                              isActive={isActive("dashboard", dashboard.id)}
                              onClick={handleItemClick}
                              slug={slug}
                           />
                        ))
                     )}
                  </CollapsibleSection>

                  {/* Insights Section */}
                  <CollapsibleSection
                     title="Insights"
                     count={totalInsights}
                     isExpanded={panelState.expandedSections.includes("insights")}
                     onToggle={() => toggleSection("insights")}
                     action={
                        <Link
                           to="/$slug/insights"
                           params={{ slug }}
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                           Ver todos
                        </Link>
                     }
                  >
                     {insights.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhum insight encontrado
                        </p>
                     ) : (
                        insights.map((insight) => (
                           <ReportItemRow
                              key={`insight-${insight.id}`}
                              id={insight.id}
                              name={insight.name}
                              type="insight"
                              timestamp={insight.updatedAt}
                              isActive={isActive("insight", insight.id)}
                              onClick={handleItemClick}
                              slug={slug}
                           />
                        ))
                     )}
                  </CollapsibleSection>
               </div>
            )}
         </SidebarContent>
      </div>
   );
}
