import type { BudgetGoalWithProgress } from "@packages/database/repositories/budget-goals-repository";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   ChevronLeft,
   ChevronRight,
   Copy,
   LayoutGrid,
   LayoutList,
   Loader2,
   Plus,
   Target,
} from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { BudgetGoalCard } from "@/features/budget-goals/ui/budget-goal-card";
import { BudgetGoalCredenza } from "@/features/budget-goals/ui/budget-goal-credenza";
import { buildBudgetGoalColumns } from "@/features/budget-goals/ui/budget-goals-columns";
import type { ViewConfig } from "@/features/view-switch/hooks/use-view-switch";
import { useViewSwitch } from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/finance/goals",
)({
   loader: ({ context }) => {
      const now = new Date();
      context.queryClient.prefetchQuery(
         orpc.budgetGoals.getAll.queryOptions({
            input: { month: now.getMonth() + 1, year: now.getFullYear() },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
   },
   component: GoalsPage,
});

const GOAL_VIEWS = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
] as const satisfies [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
];

// =============================================================================
// Summary
// =============================================================================

function GoalsSummary({ goals }: { goals: BudgetGoalWithProgress[] }) {
   const totalLimit = goals.reduce(
      (sum, g) => sum + Number(g.limitAmount),
      0,
   );
   const totalSpent = goals.reduce((sum, g) => sum + g.spentAmount, 0);
   const totalRemaining = totalLimit - totalSpent;
   const atAlertCount = goals.filter(
      (g) => g.alertThreshold != null && g.percentUsed >= g.alertThreshold,
   ).length;
   const overBudgetCount = goals.filter((g) => g.percentUsed >= 100).length;

   const fmt = (v: number) =>
      new Intl.NumberFormat("pt-BR", {
         style: "currency",
         currency: "BRL",
      }).format(v);

   return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
         <div className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total orçado</p>
            <p className="text-lg font-semibold tabular-nums">
               {fmt(totalLimit)}
            </p>
         </div>
         <div className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Total gasto</p>
            <p className="text-lg font-semibold tabular-nums text-destructive">
               {fmt(totalSpent)}
            </p>
         </div>
         <div className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Disponível</p>
            <p
               className={`text-lg font-semibold tabular-nums ${
                  totalRemaining >= 0
                     ? "text-emerald-600 dark:text-emerald-500"
                     : "text-destructive"
               }`}
            >
               {fmt(totalRemaining)}
            </p>
         </div>
         <div className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Em alerta</p>
            <p className="text-lg font-semibold tabular-nums text-amber-500">
               {atAlertCount}
               {overBudgetCount > 0 && (
                  <span className="text-destructive text-base ml-1">
                     ({overBudgetCount} excedida
                     {overBudgetCount !== 1 ? "s" : ""})
                  </span>
               )}
            </p>
         </div>
      </div>
   );
}

// =============================================================================
// Skeleton
// =============================================================================

function GoalsSkeleton() {
   return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
         {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton
               className="h-32 w-full rounded-lg"
               key={`goal-skeleton-${i + 1}`}
            />
         ))}
      </div>
   );
}

// =============================================================================
// Month Navigation
// =============================================================================

function MonthNavigation({
   month,
   year,
   onChange,
}: {
   month: number;
   year: number;
   onChange: (v: { month: number; year: number }) => void;
}) {
   const monthName = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
   });
   const label = monthName.charAt(0).toUpperCase() + monthName.slice(1);

   const prev = () => {
      if (month === 1) onChange({ month: 12, year: year - 1 });
      else onChange({ month: month - 1, year });
   };
   const next = () => {
      if (month === 12) onChange({ month: 1, year: year + 1 });
      else onChange({ month: month + 1, year });
   };

   return (
      <div className="flex items-center gap-2">
         <Button
            className="size-8"
            onClick={prev}
            size="icon"
            variant="outline"
         >
            <ChevronLeft className="size-4" />
         </Button>
         <span className="text-sm font-medium min-w-[140px] text-center">
            {label}
         </span>
         <Button
            className="size-8"
            onClick={next}
            size="icon"
            variant="outline"
         >
            <ChevronRight className="size-4" />
         </Button>
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

interface GoalsListProps {
   month: number;
   year: number;
   view: "table" | "card";
}

function GoalsList({ month, year, view }: GoalsListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: goals } = useSuspenseQuery(
      orpc.budgetGoals.getAll.queryOptions({ input: { month, year } }),
   );

   const deleteMutation = useMutation(
      orpc.budgetGoals.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Meta excluída com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir meta.");
         },
      }),
   );

   const handleEdit = useCallback(
      (goal: BudgetGoalWithProgress) => {
         openCredenza({
            children: (
               <BudgetGoalCredenza
                  goal={goal}
                  mode="edit"
                  month={goal.month}
                  onSuccess={closeCredenza}
                  year={goal.year}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (goal: BudgetGoalWithProgress) => {
         openAlertDialog({
            title: "Excluir meta",
            description:
               "Tem certeza que deseja excluir esta meta? Esta ação não pode ser desfeita.",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: goal.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo(
      () => buildBudgetGoalColumns(handleEdit, handleDelete),
      [handleEdit, handleDelete],
   );

   if (goals.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <Target className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhuma meta</EmptyTitle>
               <EmptyDescription>
                  Defina limites de gasto por categoria para controlar suas
                  finanças.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   if (view === "card") {
      return (
         <div className="space-y-4">
            <GoalsSummary goals={goals} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
               {goals.map((goal) => (
                  <BudgetGoalCard
                     goal={goal}
                     key={goal.id}
                     onDelete={handleDelete}
                     onEdit={handleEdit}
                  />
               ))}
            </div>
         </div>
      );
   }

   return (
      <div className="space-y-4">
         <GoalsSummary goals={goals} />
         <DataTable
            columns={columns}
            data={goals}
            getRowId={(row) => row.id}
            renderMobileCard={({ row }) => (
               <BudgetGoalCard
                  goal={row.original}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
               />
            )}
         />
      </div>
   );
}

// =============================================================================
// Page
// =============================================================================

function GoalsPage() {
   const [monthYear, setMonthYear] = useState({
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
   });
   const { currentView, setView, views } = useViewSwitch(
      "finance:goals:view",
      GOAL_VIEWS,
   );
   const { openCredenza, closeCredenza } = useCredenza();

   const copyMutation = useMutation(
      orpc.budgetGoals.copyFromPreviousMonth.mutationOptions({
         onSuccess: ({ count }) => {
            if (count === 0) {
               toast.info("Nenhuma meta encontrada no mês anterior.");
            } else {
               toast.success(
                  `${count} ${count === 1 ? "meta copiada" : "metas copiadas"} do mês anterior.`,
               );
            }
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao copiar metas.");
         },
      }),
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         children: (
            <BudgetGoalCredenza
               mode="create"
               month={monthYear.month}
               onSuccess={closeCredenza}
               year={monthYear.year}
            />
         ),
      });
   }, [openCredenza, closeCredenza, monthYear]);

   const handleCopyPreviousMonth = useCallback(() => {
      copyMutation.mutate({ month: monthYear.month, year: monthYear.year });
   }, [copyMutation, monthYear]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <div className="flex items-center gap-2">
                  <Button
                     disabled={copyMutation.isPending}
                     onClick={handleCopyPreviousMonth}
                     size="sm"
                     variant="outline"
                  >
                     {copyMutation.isPending ? (
                        <Loader2 className="size-4 mr-1 animate-spin" />
                     ) : (
                        <Copy className="size-4 mr-1" />
                     )}
                     Copiar mês anterior
                  </Button>
                  <Button onClick={handleCreate} size="sm">
                     <Plus className="size-4 mr-1" />
                     Nova Meta
                  </Button>
               </div>
            }
            description="Defina limites de gasto mensais por categoria"
            title="Metas"
            viewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
         />
         <MonthNavigation
            month={monthYear.month}
            onChange={setMonthYear}
            year={monthYear.year}
         />
         <Suspense fallback={<GoalsSkeleton />}>
            <GoalsList
               month={monthYear.month}
               view={currentView}
               year={monthYear.year}
            />
         </Suspense>
      </main>
   );
}
