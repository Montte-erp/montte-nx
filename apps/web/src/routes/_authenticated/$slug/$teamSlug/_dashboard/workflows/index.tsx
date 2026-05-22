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
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { PageFilterSelect } from "@/components/page-filters/page-filter-select";
import { PageFilters } from "@/components/page-filters/page-filters";
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
   type WorkflowTemplateRow,
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
import {
   buildWorkflowsColumns,
   type WorkflowRow,
} from "../-workflows/workflows-columns";

type WorkflowColumnFilter = {
   id: string;
   value: unknown;
};

type WorkflowGraph = WorkflowRow["graph"];
type WorkflowScheduleNode = Extract<
   WorkflowGraph["nodes"][number],
   { type: "scheduleTrigger" }
>;
type WorkflowReportNode = Extract<
   WorkflowGraph["nodes"][number],
   { type: "createReport" }
>;

function getWorkflowScheduleNode(
   graph: WorkflowGraph,
): WorkflowScheduleNode | null {
   return (
      graph.nodes.find(
         (node): node is WorkflowScheduleNode =>
            node.type === "scheduleTrigger",
      ) ?? null
   );
}

function getWorkflowReportNode(
   graph: WorkflowGraph,
): WorkflowReportNode | null {
   return (
      graph.nodes.find(
         (node): node is WorkflowReportNode => node.type === "createReport",
      ) ?? null
   );
}

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

function isBlankWorkflowStub(workflow: WorkflowRow) {
   const scheduleNode = getWorkflowScheduleNode(workflow.graph);
   const reportNode = getWorkflowReportNode(workflow.graph);
   if (!scheduleNode || !reportNode) return false;

   return (
      workflow.templateId === "blank" &&
      scheduleNode.data.cron === "0 9 1 * *" &&
      scheduleNode.data.timezone === "America/Sao_Paulo" &&
      scheduleNode.data.humanLabel === "Todo dia 1 às 09:00" &&
      reportNode.data.reportType === "dre" &&
      reportNode.data.period.kind === "previous-month" &&
      reportNode.data.nameTemplate === "Workflow vazio"
   );
}

function getStringFilterValue(
   filters: WorkflowColumnFilter[],
   id: string,
   fallback: string,
) {
   const value = filters.find((filter) => filter.id === id)?.value;
   return typeof value === "string" ? value : fallback;
}

function updateStringFilterValue(
   filters: WorkflowColumnFilter[],
   id: string,
   value: string,
   emptyValue = "all",
) {
   const next = filters.filter((filter) => filter.id !== id);
   return value === emptyValue ? next : [...next, { id, value }];
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
            description="Liste workflows, acompanhe execuções e crie novas automações."
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
   const { queryClient } = Route.useRouteContext();
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
   const templateRows = useMemo<WorkflowTemplateRow[]>(
      () => templates.map((template) => template),
      [templates],
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
         templateRows.map((template) => [template.id, template.name]),
      );
      labels.set("blank", "Em branco");
      return labels;
   }, [templateRows]);

   const statusFilter = getStringFilterValue(columnFilters, "status", "all");
   const templateFilter = getStringFilterValue(
      columnFilters,
      "templateId",
      "all",
   );
   const tableColumnFilters = useMemo(
      () =>
         columnFilters.filter(
            (filter) => filter.id !== "status" && filter.id !== "templateId",
         ),
      [columnFilters],
   );

   const filteredWorkflows = useMemo(() => {
      const query = search.trim().toLowerCase();
      return workflows.filter((workflow) => {
         if (statusFilter !== "all" && workflow.status !== statusFilter) {
            return false;
         }
         if (
            templateFilter !== "all" &&
            workflow.templateId !== templateFilter
         ) {
            return false;
         }
         const templateName = templateLabels.get(workflow.templateId) ?? "";
         if (!query) return true;
         return [workflow.name, templateName].some((value) =>
            value.toLowerCase().includes(query),
         );
      });
   }, [search, statusFilter, templateFilter, templateLabels, workflows]);

   const openWorkflow = useCallback(
      (workflow: WorkflowRow) =>
         navigate({
            to: "/$slug/$teamSlug/workflows/$workflowId",
            params: { slug, teamSlug, workflowId: workflow.id },
         }),
      [navigate, slug, teamSlug],
   );

   const openCreateWorkflow = useCallback(() => {
      openCredenza({
         className:
            "max-h-[90vh] flex flex-col overflow-hidden p-0 sm:max-h-[85vh] sm:max-w-[1200px]",
         renderChildren: () => (
            <WorkflowCreateCredenza
               collection={workflowsCollection}
               templates={templateRows}
            />
         ),
      });
   }, [openCredenza, templateRows, workflowsCollection]);

   const handleRemove = useCallback(
      (workflow: WorkflowRow) => {
         openAlertDialog({
            title: "Excluir workflow",
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
                     getErrorMessage(result.error, "Erro ao excluir workflow."),
                  );
                  return;
               }
               toast.success("Workflow excluído.");
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
               toast.success("Workflow atualizado.");
            },
            (error: unknown) => {
               toast.error(
                  getErrorMessage(error, "Erro ao atualizar workflow."),
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
            () => toast.success("Workflow pausado."),
            (error: unknown) =>
               toast.error(getErrorMessage(error, "Erro ao pausar workflow.")),
         );
      },
      [workflowsCollection],
   );

   const handleActivate = useCallback(
      (workflow: WorkflowRow) => {
         const activate = activateWorkflowAction(workflowsCollection);
         const transaction = activate({ id: workflow.id });
         void transaction.isPersisted.promise.then(
            () => toast.success("Workflow ativado."),
            (error: unknown) =>
               toast.error(getErrorMessage(error, "Erro ao ativar workflow.")),
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
               getErrorMessage(result.error, "Erro ao ativar workflows."),
            );
            return false;
         }
         toast.success(
            ids.length === 1 ? "Workflow ativado." : "Workflows ativados.",
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
               getErrorMessage(result.error, "Erro ao pausar workflows."),
            );
            return false;
         }
         toast.success(
            ids.length === 1 ? "Workflow pausado." : "Workflows pausados.",
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
               getErrorMessage(result.error, "Erro ao excluir workflows."),
            );
            return false;
         }
         toast.success(
            ids.length === 1 ? "Workflow excluído." : "Workflows excluídos.",
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

   const handleStatusFilterChange = useCallback(
      (value: string) =>
         routeNavigate({
            search: (prev) => ({
               ...prev,
               columnFilters: updateStringFilterValue(
                  prev.columnFilters,
                  "status",
                  value,
               ),
               page: 1,
            }),
            replace: true,
         }),
      [routeNavigate],
   );
   const handleTemplateFilterChange = useCallback(
      (value: string) =>
         routeNavigate({
            search: (prev) => ({
               ...prev,
               columnFilters: updateStringFilterValue(
                  prev.columnFilters,
                  "templateId",
                  value,
               ),
               page: 1,
            }),
            replace: true,
         }),
      [routeNavigate],
   );
   const templateFilterOptions = useMemo(
      () => [
         { value: "all", label: "Todos" },
         ...templateRows.map((template) => ({
            value: template.id,
            label: template.name,
         })),
      ],
      [templateRows],
   );
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
                     title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "workflow" : "workflows"}`,
                     description:
                        "Tem certeza que deseja excluir os workflows selecionados? Esta ação não pode ser desfeita.",
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
               aria-label="Buscar workflow por nome..."
               className="max-w-sm"
               onChange={(event) => searchInput.onChange(event.target.value)}
               placeholder="Buscar workflow por nome..."
               value={searchInput.value}
            />
            <div className="flex flex-wrap items-center gap-2">
               <PageFilters>
                  <PageFilterSelect
                     group="Status"
                     id="status"
                     label="Status"
                     onChange={handleStatusFilterChange}
                     options={[
                        { value: "all", label: "Todos" },
                        { value: "active", label: "Ativos" },
                        { value: "paused", label: "Pausados" },
                     ]}
                     value={statusFilter}
                  />
                  <PageFilterSelect
                     group="Template"
                     id="templateId"
                     label="Template"
                     onChange={handleTemplateFilterChange}
                     options={templateFilterOptions}
                     value={templateFilter}
                  />
               </PageFilters>
               <DataTableColumnVisibility table={table} />
               <Button
                  onClick={openCreateWorkflow}
                  size="icon-sm"
                  tooltip="Novo workflow"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo workflow</span>
               </Button>
            </div>
         </div>
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
                           ? "Nenhum workflow criado"
                           : "Nenhum workflow encontrado"}
                     </EmptyTitle>
                     <EmptyDescription>
                        {workflows.length === 0
                           ? "Crie o primeiro workflow para automatizar relatórios do espaço atual."
                           : "Ajuste a busca ou crie um novo workflow."}
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            )}
         </ScrollArea>
      </div>
   );
}
