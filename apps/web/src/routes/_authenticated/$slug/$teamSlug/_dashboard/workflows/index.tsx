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
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
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
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import { orpc } from "@/integrations/orpc/client";
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
   const scheduleNode = workflow.graph.nodes[0];
   const reportNode = workflow.graph.nodes[1];

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
   return (
      target instanceof Element &&
      Boolean(target.closest("button,input,select,textarea,a,[role='button']"))
   );
}

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/workflows/",
)({
   validateSearch: searchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.workflows.list.queryOptions());
      context.queryClient.prefetchQuery(
         orpc.workflows.templates.list.queryOptions(),
      );
   },
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
   const queryClient = useQueryClient();
   const layout = useDataTableLayout("workflows");

   const { data: workflows } = useSuspenseQuery(
      orpc.workflows.list.queryOptions(),
   );
   const { data: templates } = useSuspenseQuery(
      orpc.workflows.templates.list.queryOptions(),
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

   const pauseMutation = useMutation(
      orpc.workflows.pause.mutationOptions({
         onSuccess: async () => {
            toast.success("Workflow pausado.");
            await queryClient.invalidateQueries(
               orpc.workflows.list.queryOptions(),
            );
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const activateMutation = useMutation(
      orpc.workflows.activate.mutationOptions({
         onSuccess: async () => {
            toast.success("Workflow ativado.");
            await queryClient.invalidateQueries(
               orpc.workflows.list.queryOptions(),
            );
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const removeMutation = useMutation(
      orpc.workflows.remove.mutationOptions({
         onSuccess: async () => {
            toast.success("Workflow excluído.");
            await queryClient.invalidateQueries(
               orpc.workflows.list.queryOptions(),
            );
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const updateMutation = useMutation(
      orpc.workflows.update.mutationOptions({
         onSuccess: async () => {
            toast.success("Workflow atualizado.");
            await queryClient.invalidateQueries(
               orpc.workflows.list.queryOptions(),
            );
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const bulkPauseMutation = useMutation(
      orpc.workflows.bulkPause.mutationOptions({
         onSuccess: async (result) => {
            toast.success(
               result.updated === 1
                  ? "Workflow pausado."
                  : "Workflows pausados.",
            );
            await queryClient.invalidateQueries(
               orpc.workflows.list.queryOptions(),
            );
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const bulkActivateMutation = useMutation(
      orpc.workflows.bulkActivate.mutationOptions({
         onSuccess: async (result) => {
            toast.success(
               result.updated === 1
                  ? "Workflow ativado."
                  : "Workflows ativados.",
            );
            await queryClient.invalidateQueries(
               orpc.workflows.list.queryOptions(),
            );
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const bulkRemoveMutation = useMutation(
      orpc.workflows.bulkRemove.mutationOptions({
         onSuccess: async (result) => {
            toast.success(
               result.deleted === 1
                  ? "Workflow excluído."
                  : "Workflows excluídos.",
            );
            await queryClient.invalidateQueries(
               orpc.workflows.list.queryOptions(),
            );
         },
         onError: (error) => toast.error(error.message),
      }),
   );

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
         renderChildren: () => <WorkflowCreateCredenza templates={templates} />,
      });
   }, [openCredenza, templates]);

   const handleRemove = useCallback(
      (workflow: WorkflowRow) => {
         openAlertDialog({
            title: "Excluir workflow",
            description: `Tem certeza que deseja excluir "${workflow.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await removeMutation.mutateAsync({ id: workflow.id });
            },
         });
      },
      [openAlertDialog, removeMutation],
   );

   const handleRename = useCallback(
      async (workflow: WorkflowRow, name: string) => {
         const nextName = name.trim();
         if (!nextName || nextName === workflow.name) return;
         await updateMutation.mutateAsync({
            id: workflow.id,
            name: nextName,
            graph: workflow.graph,
         });
      },
      [updateMutation],
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
            onPause: (workflow) => pauseMutation.mutate({ id: workflow.id }),
            onActivate: (workflow) =>
               activateMutation.mutate({ id: workflow.id }),
            isActivationBlocked: isBlankWorkflowStub,
            onRemove: handleRemove,
            onRename: handleRename,
         }),
      ];
   }, [
      activateMutation,
      handleRemove,
      handleRename,
      openWorkflow,
      pauseMutation,
   ]);

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
         ...templates.map((template) => ({
            value: template.id,
            label: template.name,
         })),
      ],
      [templates],
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
               disabled={
                  selectedActivatableIds.length === 0 ||
                  bulkActivateMutation.isPending
               }
               icon={<Play className="size-4" />}
               onClick={async () => {
                  await bulkActivateMutation.mutateAsync({
                     ids: selectedActivatableIds,
                  });
                  table.resetRowSelection();
               }}
            >
               Ativar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={
                  selectedActiveIds.length === 0 || bulkPauseMutation.isPending
               }
               icon={<Pause className="size-4" />}
               onClick={async () => {
                  await bulkPauseMutation.mutateAsync({
                     ids: selectedActiveIds,
                  });
                  table.resetRowSelection();
               }}
            >
               Pausar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={bulkRemoveMutation.isPending}
               icon={<Trash2 className="size-4" />}
               onClick={() => {
                  openAlertDialog({
                     title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "workflow" : "workflows"}`,
                     description:
                        "Tem certeza que deseja excluir os workflows selecionados? Esta ação não pode ser desfeita.",
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     variant: "destructive",
                     onAction: async () => {
                        await bulkRemoveMutation.mutateAsync({
                           ids: selectedIds,
                        });
                        table.resetRowSelection();
                     },
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
