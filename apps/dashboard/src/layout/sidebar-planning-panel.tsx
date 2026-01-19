import { SidebarContent, useSidebar } from "@packages/ui/components/sidebar";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Crosshair, Target, Wallet } from "lucide-react";
import { useDashboardTabs } from "@/features/custom-dashboard/hooks/use-dashboard-tabs";
import { usePlanningData } from "./hooks/use-submenu-data";
import {
   CollapsibleSection,
   EmptyState,
   ItemRow,
   LoadingSkeleton,
   PanelHeader,
   SearchHeader,
} from "./sidebar-panel-shared";
import { useSubmenu } from "./sidebar-submenu-context";

export function SidebarPlanningPanel() {
   const { panelState, setSearch, setSort, toggleSection, closeSubmenu } =
      useSubmenu();
   const { setOpenMobile } = useSidebar();
   const { pathname } = useLocation();
   const navigate = useNavigate();
   const { openGoalTab, openBudgetTab } = useDashboardTabs();

   const slug = pathname.split("/")[1] || "";

   const { goals, budgets, isLoading, totalGoals, totalBudgets } =
      usePlanningData({
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

   const hasNoResults =
      !isLoading && goals.length === 0 && budgets.length === 0;

   return (
      <div className="flex flex-col h-full">
         {/* Panel Header with title and create dropdown */}
         <PanelHeader
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
            icon={Target}
            title="Planejamento"
         />

         <SearchHeader
            onSearchChange={setSearch}
            onSortChange={setSort}
            placeholder="Buscar..."
            search={panelState.search}
            sortBy={panelState.sortBy}
            sortDirection={panelState.sortDirection}
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
                     action={
                        <Link
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           params={{ slug }}
                           to="/$slug/goals"
                        >
                           Ver todos
                        </Link>
                     }
                     count={totalGoals}
                     isExpanded={panelState.expandedSections.includes("goals")}
                     onToggle={() => toggleSection("goals")}
                     title="Metas"
                  >
                     {goals.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhuma meta encontrada
                        </p>
                     ) : (
                        goals.map((goal) => (
                           <ItemRow
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
                              icon={Crosshair}
                              id={goal.id}
                              isActive={isActive("goal", goal.id)}
                              key={`goal-${goal.id}`}
                              name={goal.name}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 openGoalTab(goal.id, goal.name);
                                 navigate({
                                    to: "/$slug/goals",
                                    params: { slug },
                                 });
                              }}
                              timestamp={goal.updatedAt}
                              url={`/${slug}/goals/${goal.id}`}
                           />
                        ))
                     )}
                  </CollapsibleSection>

                  {/* Budgets Section */}
                  <CollapsibleSection
                     action={
                        <Link
                           className="text-[10px] text-muted-foreground hover:text-foreground"
                           onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick();
                           }}
                           params={{ slug }}
                           to="/$slug/budgets"
                        >
                           Ver todos
                        </Link>
                     }
                     count={totalBudgets}
                     isExpanded={panelState.expandedSections.includes(
                        "budgets",
                     )}
                     onToggle={() => toggleSection("budgets")}
                     title="Orçamentos"
                  >
                     {budgets.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                           Nenhum orçamento encontrado
                        </p>
                     ) : (
                        budgets.map((budget) => (
                           <ItemRow
                              badge={
                                 budget.isActive === false ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                       Inativo
                                    </span>
                                 ) : undefined
                              }
                              icon={Wallet}
                              id={budget.id}
                              isActive={isActive("budget", budget.id)}
                              key={`budget-${budget.id}`}
                              name={budget.name}
                              onClick={handleItemClick}
                              onOpenInDashboardTab={() => {
                                 openBudgetTab(budget.id, budget.name);
                                 navigate({
                                    to: "/$slug/budgets/$budgetId",
                                    params: { slug, budgetId: budget.id },
                                 });
                              }}
                              timestamp={budget.updatedAt}
                              url={`/${slug}/budgets/${budget.id}`}
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
