import { SidebarContent, useSidebar } from "@packages/ui/components/sidebar";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Crosshair, Target, Wallet } from "lucide-react";
import { useDashboardTabs } from "@/features/custom-dashboard/hooks/use-dashboard-tabs";
import { usePlanningData } from "./hooks/use-submenu-data";
import { useSubmenu } from "./sidebar-submenu-context";
import {
   CollapsibleSection,
   EmptyState,
   ItemRow,
   LoadingSkeleton,
   PanelHeader,
   SearchHeader,
} from "./sidebar-panel-shared";

export function SidebarPlanningPanel() {
   const { panelState, setSearch, setSort, toggleSection, closeSubmenu } =
      useSubmenu();
   const { setOpenMobile } = useSidebar();
   const { pathname } = useLocation();
   const navigate = useNavigate();
   const { openGoalTab, openBudgetTab } = useDashboardTabs();

   const slug = pathname.split("/")[1] || "";

   const { goals, budgets, isLoading, totalGoals, totalBudgets } = usePlanningData({
      search: panelState.search,
      sortBy: panelState.sortBy,
      sortDirection: panelState.sortDirection,
      enabled: true,
   });

   const isActive = (type: "goal" | "budget", id: string) => {
      if (type === "goal") {
         return pathname === `/${slug}/goals/${id}`;
      }
      return pathname === `/${slug}/budgets/${id}`;
   };

   const handleItemClick = () => {
      setOpenMobile(false);
      closeSubmenu();
   };

   const handleCreateGoal = () => {
      navigate({ to: "/$slug/goals", params: { slug } });
      handleItemClick();
   };

   const handleCreateBudget = () => {
      navigate({ to: "/$slug/budgets", params: { slug } });
      handleItemClick();
   };

   const hasNoResults = !isLoading && goals.length === 0 && budgets.length === 0;

   return (
      <div className="flex flex-col h-full">
         {/* Panel Header with title and create dropdown */}
         <PanelHeader
            title="Planejamento"
            icon={Target}
            createOptions={[
               {
                  icon: Crosshair,
                  label: "Nova Meta",
                  onClick: handleCreateGoal,
               },
               {
                  icon: Wallet,
                  label: "Novo Orçamento",
                  onClick: handleCreateBudget,
               },
            ]}
         />

         <SearchHeader
            search={panelState.search}
            onSearchChange={setSearch}
            sortBy={panelState.sortBy}
            sortDirection={panelState.sortDirection}
            onSortChange={setSort}
            placeholder="Buscar..."
         />

         <SidebarContent>
            {isLoading ? (
               <LoadingSkeleton />
            ) : hasNoResults ? (
               <EmptyState search={panelState.search} />
            ) : (
               <div className="py-2">
                  {/* Goals Section */}
                  <CollapsibleSection
                     title="Metas"
                     count={totalGoals}
                     isExpanded={panelState.expandedSections.includes("goals")}
                     onToggle={() => toggleSection("goals")}
                     action={
                        <Link
                           to="/$slug/goals"
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
                     {goals.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhuma meta encontrada
                        </p>
                     ) : (
                        goals.map((goal) => (
                           <ItemRow
                              key={`goal-${goal.id}`}
                              id={goal.id}
                              name={goal.name}
                              url={`/${slug}/goals/${goal.id}`}
                              icon={Crosshair}
                              timestamp={goal.updatedAt}
                              isActive={isActive("goal", goal.id)}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 openGoalTab(goal.id, goal.name);
                                 navigate({
                                    to: "/$slug/goals",
                                    params: { slug },
                                 });
                              }}
                              badge={
                                 goal.status && goal.status !== "active" ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                       {goal.status === "completed"
                                          ? "Concluída"
                                          : goal.status === "paused"
                                            ? "Pausada"
                                            : "Cancelada"}
                                    </span>
                                 ) : undefined
                              }
                           />
                        ))
                     )}
                  </CollapsibleSection>

                  {/* Budgets Section */}
                  <CollapsibleSection
                     title="Orçamentos"
                     count={totalBudgets}
                     isExpanded={panelState.expandedSections.includes("budgets")}
                     onToggle={() => toggleSection("budgets")}
                     action={
                        <Link
                           to="/$slug/budgets"
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
                     {budgets.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhum orçamento encontrado
                        </p>
                     ) : (
                        budgets.map((budget) => (
                           <ItemRow
                              key={`budget-${budget.id}`}
                              id={budget.id}
                              name={budget.name}
                              url={`/${slug}/budgets/${budget.id}`}
                              icon={Wallet}
                              timestamp={budget.updatedAt}
                              isActive={isActive("budget", budget.id)}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 openBudgetTab(budget.id, budget.name);
                                 navigate({
                                    to: "/$slug/budgets/$budgetId",
                                    params: { slug, budgetId: budget.id },
                                 });
                              }}
                              badge={
                                 budget.isActive === false ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                       Inativo
                                    </span>
                                 ) : undefined
                              }
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
