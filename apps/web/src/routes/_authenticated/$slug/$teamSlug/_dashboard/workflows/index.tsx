import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table, TableCell, TableRow } from "@packages/ui/components/table";
import { toast } from "@packages/ui/hooks/use-toast";
import { cn } from "@packages/ui/lib/utils";
import { createCollection, useLiveQuery } from "@tanstack/react-db";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
   flexRender,
   getCoreRowModel,
   getFilteredRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
} from "@tanstack/react-table";
import { Pause, Play, Plus, Trash2, Workflow } from "lucide-react";
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { Result } from "better-result";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableFilterChips } from "@/blocks/data-table/data-table-filter-chips";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { QueryBoundary } from "@/components/query-boundary";
import { useActiveTeam } from "@/hooks/use-active-team";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import {
   type WorkflowRow,
   activateWorkflowAction,
   bulkActivateWorkflowsAction,
   bulkDeleteWorkflowsAction,
   bulkPauseWorkflowsAction,
   deleteWorkflowAction,
   pauseWorkflowAction,
   updateWorkflowAction,
   workflowTemplatesCollectionOptions,
   workflowsCollectionOptions,
} from "@/integrations/tanstack-db/workflows";
import { DefaultHeader } from "../../-layout/default-header";
import { WorkflowCreateCredenza } from "../-workflows/workflow-create-credenza";
import { isBlankWorkflowStub } from "../-workflows/workflow-model";
import { buildWorkflowsColumns } from "../-workflows/workflows-columns";

type WorkflowColumnFilter = {
   id: string;
   value: unknown;
};

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().max(100).catch("").default(""),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().min(1).catch(20).default(20),
});

const skeletonColumns = buildWorkflowsColumns({});

function getStringFilterValue(
   filters: WorkflowColumnFilter[],
   id: string,
   fallback: string,
) {
   const value = filters.find((filter) => filter.id === id)?.value;
   return typeof value === "string" ? value : fallback;
}

function isInteractiveEventTarget(target: EventTarget | null) {
   if (target == null || typeof target !== "object") return false;
   const closest = Reflect.get(target, "closest");
   return (
      typeof closest === "function" &&
      Boolean(
         closest.call(target, "button,input,select,textarea,a,[role='button']"),
      )
   );
}

function getErrorMessage(error: unknown, fallback: string) {
   if (typeof error !== "object" || error == null) return fallback;
   const message = Reflect.get(error, "message");
   return typeof message === "string" ? message : fallback;
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/workflows/",
)({
   ssr: false,
   validateSearch: searchSchema,
   pendingMs: 300,
   pendingComponent: WorkflowIndexSkeleton,
   head: () => ({
      meta: [{ title: "Automações - Montte" }],
   }),
   component: WorkflowsIndexPage,
});

function WorkflowIndexSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function WorkflowsIndexPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Agende relatórios, acompanhe execuções e tire tarefas recorrentes da rotina manual."
            title="Automações"
         />
         <div className="flex min-h-0 flex-1 flex-col">
            <QueryBoundary
               fallback={<WorkflowIndexSkeleton />}
               errorTitle="Erro ao carregar automações"
            >
               <WorkflowsIndexContent />
            </QueryBoundary>
         </div>
      </main>
   );
}

function WorkflowsIndexContent() {
   const routeNavigate = Route.useNavigate();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const { slug, teamSlug } = useDashboardSlugs();
   const navigate = useNavigate();
   const { openCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const { activeTeamId } = useActiveTeam();
   const { queryClient, session } = Route.useRouteContext();
   const layout = useDataTableLayout("workflows");

   const workflowsCollection = useMemo(
      () =>
         createCollection(
            workflowsCollectionOptions({
               queryClient,
               teamId: activeTeamId ?? "no-team",
            }),
         ),
      [activeTeamId, queryClient],
   );
   const workflowTemplatesCollection = useMemo(
      () =>
         createCollection(workflowTemplatesCollectionOptions({ queryClient })),
      [queryClient],
   );

   const { data: workflows } = useLiveQuery(
      (q) =>
         q
            .from({ workflow: workflowsCollection })
            .select(({ workflow }) => workflow),
      [workflowsCollection],
   );
   const { data: templates } = useLiveQuery(
      (q) =>
         q
            .from({ template: workflowTemplatesCollection })
            .select(({ template }) => template),
      [workflowTemplatesCollection],
   );
   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         routeNavigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const templateLabels = useMemo<Map<string, string>>(() => {
      const labels = new Map<string, string>(
         templates.map((template) => [template.id, template.name]),
      );
      labels.set("blank", "Em branco");
      return labels;
   }, [templates]);

   const statusFilter = getStringFilterValue(columnFilters, "status", "all");
   const tableColumnFilters = useMemo(
      () => columnFilters.filter((filter) => filter.id !== "templateId"),
      [columnFilters],
   );

   const filteredWorkflows = useMemo(() => {
      const query = search.trim().toLowerCase();
      return workflows.filter((workflow) => {
         if (statusFilter !== "all" && workflow.status !== statusFilter) {
            return false;
         }
         const templateName = templateLabels.get(workflow.templateId) ?? "";
         if (!query) return true;
         return [workflow.name, templateName].some((value) =>
            value.toLowerCase().includes(query),
         );
      });
   }, [search, statusFilter, templateLabels, workflows]);

   const openWorkflow = useCallback(
      (workflow: WorkflowRow) =>
         navigate({
            to: "/$slug/$teamSlug/workflows/$workflowId",
            params: { slug, teamSlug, workflowId: workflow.id },
         }),
      [navigate, slug, teamSlug],
   );

   const openCreateWorkflow = useCallback(() => {
      if (!activeTeamId) {
         toast.error("Não foi possível identificar o projeto ativo.");
         return;
      }

      openCredenza({
         className:
            "max-h-[90vh] flex flex-col overflow-hidden p-0 sm:max-h-[85vh] sm:max-w-[1200px]",
         renderChildren: () => (
            <WorkflowCreateCredenza
               collection={workflowsCollection}
               createdBy={session.user.id}
               teamId={activeTeamId}
               templates={templates}
            />
         ),
      });
   }, [
      activeTeamId,
      openCredenza,
      session.user.id,
      templates,
      workflowsCollection,
   ]);

   const handleRemove = useCallback(
      (workflow: WorkflowRow) => {
         openAlertDialog({
            title: "Excluir automação",
            description: `Tem certeza que deseja excluir "${workflow.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const remove = deleteWorkflowAction(workflowsCollection);
               const transaction = remove({ id: workflow.id });
               const result = await Result.tryPromise({
                  try: () => transaction.isPersisted.promise,
                  catch: (error) => error,
               });
               if (Result.isError(result)) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir automação.",
                     ),
                  );
                  return;
               }
               toast.success("Automação excluída.");
            },
         });
      },
      [openAlertDialog, workflowsCollection],
   );

   const handleRename = useCallback(
      (workflow: WorkflowRow, name: string) => {
         const nextName = name.trim();
         if (!nextName || nextName === workflow.name) return Promise.resolve();
         const update = updateWorkflowAction(workflowsCollection);
         const transaction = update({
            id: workflow.id,
            patch: {
               name: nextName,
               graph: workflow.graph,
            },
         });
         return transaction.isPersisted.promise.then(
            () => {
               toast.success("Automação atualizada.");
            },
            (error: unknown) => {
               toast.error(
                  getErrorMessage(error, "Erro ao atualizar automação."),
               );
            },
         );
      },
      [workflowsCollection],
   );

   const handlePause = useCallback(
      (workflow: WorkflowRow) => {
         const pause = pauseWorkflowAction(workflowsCollection);
         const transaction = pause({ id: workflow.id });
         void transaction.isPersisted.promise.then(
            () => toast.success("Automação pausada."),
            (error: unknown) =>
               toast.error(getErrorMessage(error, "Erro ao pausar automação.")),
         );
      },
      [workflowsCollection],
   );

   const handleActivate = useCallback(
      (workflow: WorkflowRow) => {
         const activate = activateWorkflowAction(workflowsCollection);
         const transaction = activate({ id: workflow.id });
         void transaction.isPersisted.promise.then(
            () => toast.success("Automação ativada."),
            (error: unknown) =>
               toast.error(getErrorMessage(error, "Erro ao ativar automação.")),
         );
      },
      [workflowsCollection],
   );

   const handleBulkActivate = useCallback(
      async (ids: string[]) => {
         const activate = bulkActivateWorkflowsAction(workflowsCollection);
         const transaction = activate({ ids });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao ativar automações."),
            );
            return false;
         }
         toast.success(
            ids.length === 1 ? "Automação ativada." : "Automações ativadas.",
         );
         return true;
      },
      [workflowsCollection],
   );

   const handleBulkPause = useCallback(
      async (ids: string[]) => {
         const pause = bulkPauseWorkflowsAction(workflowsCollection);
         const transaction = pause({ ids });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao pausar automações."),
            );
            return false;
         }
         toast.success(
            ids.length === 1 ? "Automação pausada." : "Automações pausadas.",
         );
         return true;
      },
      [workflowsCollection],
   );

   const handleBulkRemove = useCallback(
      async (ids: string[]) => {
         const remove = bulkDeleteWorkflowsAction(workflowsCollection);
         const transaction = remove({ ids });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao excluir automações."),
            );
            return false;
         }
         toast.success(
            ids.length === 1 ? "Automação excluída." : "Automações excluídas.",
         );
         return true;
      },
      [workflowsCollection],
   );

   const columns = useMemo<ColumnDef<WorkflowRow>[]>(() => {
      const selectColumn: ColumnDef<WorkflowRow> = {
         id: "__select",
         size: 48,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true },
         header: ({ table }) => (
            <Checkbox
               aria-label="Selecionar todos"
               checked={
                  table.getIsAllPageRowsSelected()
                     ? true
                     : table.getIsSomePageRowsSelected()
                       ? "indeterminate"
                       : false
               }
               onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(Boolean(value))
               }
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onClick={(event) => event.stopPropagation()}
               onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            />
         ),
      };

      return [
         selectColumn,
         ...buildWorkflowsColumns({
            onOpen: openWorkflow,
            onPause: handlePause,
            onActivate: handleActivate,
            isActivationBlocked: isBlankWorkflowStub,
            onRemove: handleRemove,
            onRename: handleRename,
         }),
      ];
   }, [handleActivate, handleRemove, handleRename, handlePause, openWorkflow]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters: tableColumnFilters, page, pageSize },
      onUpdate: (next) =>
         routeNavigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
      totalRows: filteredWorkflows.length,
   });

   const table = useReactTable({
      data: filteredWorkflows,
      columns,
      getRowId: (row) => row.id,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: { ...urlState.state, ...layout.state },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
   });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((row) => row.original.id);
   const selectedActiveIds = selectedRows
      .filter((row) => row.original.status === "active")
      .map((row) => row.original.id);
   const selectedActivatableIds = selectedRows
      .filter(
         (row) =>
            row.original.status !== "active" &&
            !isBlankWorkflowStub(row.original),
      )
      .map((row) => row.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <>
            <SelectionActionButton
               disabled={selectedActivatableIds.length === 0}
               icon={<Play className="size-4" />}
               onClick={() => {
                  void handleBulkActivate(selectedActivatableIds).then(
                     (success) => {
                        if (success) table.resetRowSelection();
                     },
                  );
               }}
            >
               Ativar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={selectedActiveIds.length === 0}
               icon={<Pause className="size-4" />}
               onClick={() => {
                  void handleBulkPause(selectedActiveIds).then((success) => {
                     if (success) table.resetRowSelection();
                  });
               }}
            >
               Pausar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Trash2 className="size-4" />}
               onClick={() => {
                  openAlertDialog({
                     title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "automação" : "automações"}`,
                     description:
                        "Tem certeza que deseja excluir as automações selecionadas? Esta ação não pode ser desfeita.",
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     variant: "destructive",
                     onAction: () =>
                        handleBulkRemove(selectedIds).then((success) => {
                           if (success) table.resetRowSelection();
                        }),
                  });
               }}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </>
      ),
   });

   return (
      <div className="flex flex-1 min-h-0 flex-col gap-4">
         <div className="flex flex-wrap items-center justify-between gap-2">
            <SearchInput
               aria-label="Buscar automação por nome..."
               className="max-w-sm"
               onChange={(event) => searchInput.onChange(event.target.value)}
               placeholder="Buscar automação por nome..."
               value={searchInput.value}
            />
            <div className="flex flex-wrap items-center gap-2">
               <DataTableColumnVisibility table={table} />
               <Button
                  onClick={openCreateWorkflow}
                  size="icon-sm"
                  tooltip="Nova automação"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Nova automação</span>
               </Button>
            </div>
         </div>
         <DataTableFilterChips table={table} />
         <ScrollArea className="bg-card flex-1 min-h-0 rounded-md border">
            <Table>
               <DataTableHeader table={table} />
               <DataTableBody<WorkflowRow>
                  renderRow={({ row }) => (
                     <TableRow
                        className="hover:bg-muted/50 cursor-pointer"
                        aria-selected={row.getIsSelected()}
                        data-selected={row.getIsSelected()}
                        data-state={
                           row.getIsSelected() ? "selected" : undefined
                        }
                        key={row.id}
                        onClick={(event) => {
                           if (isInteractiveEventTarget(event.target)) return;
                           openWorkflow(row.original);
                        }}
                        onKeyDown={(event) => {
                           if (event.target !== event.currentTarget) return;
                           if (event.key !== "Enter" && event.key !== " ") {
                              return;
                           }
                           event.preventDefault();
                           openWorkflow(row.original);
                        }}
                        role="row"
                        tabIndex={0}
                     >
                        {row.getVisibleCells().map((cell) => {
                           const col = cell.column;
                           const align = col.columnDef.meta?.align ?? "left";
                           return (
                              <TableCell
                                 className={cn(
                                    align === "right" && "text-right",
                                 )}
                                 key={cell.id}
                                 style={{ width: col.getSize() }}
                              >
                                 {flexRender(
                                    col.columnDef.cell,
                                    cell.getContext(),
                                 )}
                              </TableCell>
                           );
                        })}
                     </TableRow>
                  )}
                  table={table}
               />
            </Table>
            {table.getRowCount() === 0 && (
               <Empty>
                  <EmptyMedia>
                     <Workflow className="size-10" />
                  </EmptyMedia>
                  <EmptyHeader>
                     <EmptyTitle>
                        {workflows.length === 0
                           ? "Nenhuma automação criada"
                           : "Nenhuma automação encontrada"}
                     </EmptyTitle>
                     <EmptyDescription>
                        {workflows.length === 0
                           ? "Crie a primeira automação para gerar relatórios recorrentes neste projeto."
                           : "Ajuste a busca ou crie uma nova automação."}
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            )}
         </ScrollArea>
      </div>
   );
}
