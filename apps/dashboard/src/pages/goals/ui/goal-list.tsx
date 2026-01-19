import { Card, CardContent } from "@packages/ui/components/card";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { useRouter } from "@tanstack/react-router";
import type { RowSelectionState } from "@tanstack/react-table";
import { Target, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { ManageGoalForm } from "../features/manage-goal-form";
import { useDeleteGoal } from "../features/use-delete-goal";
import { GoalMobileCard } from "./goal-mobile-card";
import { createGoalColumns, type Goal } from "./goal-table-columns";

type GoalListProps = {
   goals: Goal[];
   pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      pageSize: number;
      onPageChange: (page: number) => void;
      onPageSizeChange?: (size: number) => void;
   };
   emptyStateTitle?: string;
   emptyStateDescription?: string;
   statusFilter: string | null;
};

export function GoalList({
   goals,
   pagination,
   emptyStateTitle,
   emptyStateDescription,
   statusFilter,
}: GoalListProps) {
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();
   const { openSheet } = useSheet();
   const { openAlertDialog } = useAlertDialog();
   const { deleteGoal, deleteGoalWithTag } = useDeleteGoal();
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const handleView = (goal: Goal) => {
      router.navigate({
         params: { slug: activeOrganization.slug, goalId: goal.id },
         to: "/$slug/goals/$goalId",
      });
   };

   const handleEdit = (goal: Goal) => {
      openSheet({ children: <ManageGoalForm goal={goal} /> });
   };

   const handleDelete = (goal: Goal) => {
      deleteGoal(goal.id, goal.name, goal.tag.name);
   };

   const handleDeleteWithTag = (goal: Goal) => {
      deleteGoalWithTag(goal.id, goal.name, goal.tag.name);
   };

   const columns = useMemo(
      () =>
         createGoalColumns({
            onView: handleView,
            onEdit: handleEdit,
            onDelete: handleDelete,
            onDeleteWithTag: handleDeleteWithTag,
         }),
      [activeOrganization.slug],
   );

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const handleBulkDelete = () => {
      openAlertDialog({
         actionLabel: "Excluir metas",
         cancelLabel: "Cancelar",
         description: `Tem certeza que deseja excluir ${selectedIds.length} metas? As tags associadas serao mantidas.`,
         onAction: async () => {
            for (const id of selectedIds) {
               const goal = goals.find((g) => g.id === id);
               if (goal) {
                  deleteGoal(goal.id, goal.name, goal.tag.name);
               }
            }
            setRowSelection({});
         },
         title: "Confirmar Exclusao",
         variant: "destructive",
      });
   };

   if (goals.length === 0) {
      return (
         <Card>
            <CardContent className="pt-6">
               <Empty>
                  <EmptyContent>
                     <EmptyMedia variant="icon">
                        <Target className="size-12 text-muted-foreground" />
                     </EmptyMedia>
                     <EmptyTitle>
                        {emptyStateTitle ?? "Nenhuma meta encontrada"}
                     </EmptyTitle>
                     <EmptyDescription>
                        {emptyStateDescription ??
                           (statusFilter
                              ? "Nenhuma meta com o status selecionado."
                              : "Crie sua primeira meta para comecar a acompanhar seu progresso financeiro.")}
                     </EmptyDescription>
                  </EmptyContent>
               </Empty>
            </CardContent>
         </Card>
      );
   }

   return (
      <>
         <Card>
            <CardContent className="space-y-4">
               <DataTable
                  columns={columns}
                  data={goals}
                  enableRowSelection
                  getRowId={(row) => row.id}
                  onRowSelectionChange={setRowSelection}
                  pagination={{
                     currentPage: pagination.currentPage,
                     onPageChange: pagination.onPageChange,
                     onPageSizeChange: pagination.onPageSizeChange,
                     pageSize: pagination.pageSize,
                     totalCount: pagination.totalCount,
                     totalPages: pagination.totalPages,
                  }}
                  renderMobileCard={(props) => (
                     <GoalMobileCard
                        {...props}
                        onDelete={handleDelete}
                        onDeleteWithTag={handleDeleteWithTag}
                        onEdit={handleEdit}
                        onView={handleView}
                     />
                  )}
                  rowSelection={rowSelection}
               />
            </CardContent>
         </Card>

         <SelectionActionBar
            onClear={handleClearSelection}
            selectedCount={selectedIds.length}
         >
            <SelectionActionButton
               icon={<Trash2 className="size-3.5" />}
               onClick={handleBulkDelete}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}
