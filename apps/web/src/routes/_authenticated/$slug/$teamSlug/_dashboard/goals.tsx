import type { BudgetGoalWithProgress } from "@core/database/repositories/budget-goals-repository";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
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
   Loader2,
   MoreHorizontal,
   Pencil,
   Plus,
   Target,
   Trash2,
} from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { BudgetGoalDialogStack } from "@/features/budget-goals/ui/budget-goal-dialog-stack";
import { buildBudgetGoalColumns } from "@/features/budget-goals/ui/budget-goals-columns";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDialogStack } from "@/hooks/use-dialog-stack";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/goals",
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

// =============================================================================
// Summary
// =============================================================================

function GoalsSummary({ goals }: { goals: BudgetGoalWithProgress[] }) {
   const totalLimit = goals.reduce((sum, g) => sum + Number(g.limitAmount), 0);
   const totalSpent = goals.reduce((sum, g) => sum + Number(g.spentAmount), 0);
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
            tooltip="Anterior"
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
            tooltip="Próximo"
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
}

function GoalsList({ month, year }: GoalsListProps) {
   const { openDialogStack, closeDialogStack } = useDialogStack();
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
         openDialogStack({
            children: (
               <BudgetGoalDialogStack
                  goal={goal}
                  mode="edit"
                  month={goal.month}
                  onSuccess={closeDialogStack}
                  year={goal.year}
               />
            ),
         });
      },
      [openDialogStack, closeDialogStack],
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

   const columns = useMemo(() => buildBudgetGoalColumns(), []);

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

   return (
      <div className="space-y-4">
         <GoalsSummary goals={goals} />
         <DataTable
            columns={columns}
            data={goals}
            getRowId={(row) => row.id}
            renderActions={({ row }) => (
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="outline">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Ações</span>
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                        <Pencil className="size-4" />
                        Editar
                     </DropdownMenuItem>
                     <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(row.original)}
                     >
                        <Trash2 className="size-4" />
                        Excluir
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
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
   const { openDialogStack, closeDialogStack } = useDialogStack();

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
      openDialogStack({
         children: (
            <BudgetGoalDialogStack
               mode="create"
               month={monthYear.month}
               onSuccess={closeDialogStack}
               year={monthYear.year}
            />
         ),
      });
   }, [openDialogStack, closeDialogStack, monthYear]);

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
                     tooltip="Copiar mês anterior"
                     variant="outline"
                  >
                     {copyMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                     ) : (
                        <Copy className="size-4" />
                     )}
                  </Button>
                  <Button onClick={handleCreate}>
                     <Plus className="size-4 mr-1" />
                     Nova Meta
                  </Button>
               </div>
            }
            description="Defina limites de gasto mensais por categoria"
            title="Metas"
         />
         <MonthNavigation
            month={monthYear.month}
            onChange={setMonthYear}
            year={monthYear.year}
         />
         <Suspense fallback={<GoalsSkeleton />}>
            <GoalsList month={monthYear.month} year={monthYear.year} />
         </Suspense>
      </main>
   );
}
