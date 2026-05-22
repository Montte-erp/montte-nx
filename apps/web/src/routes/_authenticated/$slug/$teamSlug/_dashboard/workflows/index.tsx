import { Button } from "@packages/ui/components/button";
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
import { Plus, Workflow } from "lucide-react";
import { useCallback, useMemo } from "react";
import { z } from "zod";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import { DefaultHeader } from "../../-layout/default-header";
import { WorkflowCreateCredenza } from "../-workflows/workflow-create-credenza";
import {
   buildWorkflowsColumns,
   type WorkflowRow,
} from "../-workflows/workflows-columns";

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

const EMPTY_TEMPLATE_LABELS = new Map<string, string>();
const skeletonColumns = buildWorkflowsColumns({
   templateLabels: EMPTY_TEMPLATE_LABELS,
});

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

   const templateLabels = useMemo<Map<string, string>>(
      () =>
         new Map<string, string>(
            templates.map((template) => [template.id, template.name]),
         ),
      [templates],
   );

   const filteredWorkflows = useMemo(() => {
      const query = search.trim().toLowerCase();
      if (!query) return workflows;
      return workflows.filter((workflow) => {
         const templateName = templateLabels.get(workflow.templateId) ?? "";
         return [workflow.name, templateName].some((value) =>
            value.toLowerCase().includes(query),
         );
      });
   }, [search, templateLabels, workflows]);

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
         className: "overflow-hidden p-0 sm:max-w-[1200px]",
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

   const columns = useMemo<ColumnDef<WorkflowRow>[]>(() => {
      return buildWorkflowsColumns({
         templateLabels,
         onOpen: openWorkflow,
         onPause: (workflow) => pauseMutation.mutate({ id: workflow.id }),
         onActivate: (workflow) => activateMutation.mutate({ id: workflow.id }),
         onRemove: handleRemove,
      });
   }, [
      activateMutation,
      handleRemove,
      openWorkflow,
      pauseMutation,
      templateLabels,
   ]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
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
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
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
                        key={row.id}
                        onClick={() => openWorkflow(row.original)}
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
