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
import { cn } from "@packages/ui/lib/utils";
import { createCollection, ilike, useLiveQuery } from "@tanstack/react-db";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
   flexRender,
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
} from "@tanstack/react-table";
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { fromPromise } from "neverthrow";
import { useCallback, useMemo } from "react";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { QueryBoundary } from "@/components/query-boundary";
import { useActiveTeam } from "@/hooks/use-active-team";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import { useSheet } from "@/hooks/use-sheet";
import {
   bulkRemoveReportAction,
   removeReportAction,
   reportsCollectionOptions,
} from "@/integrations/tanstack-db/reports";
import { ReportFormSheet } from "../-reports/report-form-sheet";
import { type SavedReport } from "../-reports/report-labels";
import { buildReportsColumns } from "../-reports/reports-columns";
import { DefaultHeader } from "../../-layout/default-header";
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

const skeletonColumns = buildReportsColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/reports/",
)({
   ssr: false,
   validateSearch: searchSchema,
   pendingMs: 300,
   pendingComponent: ReportsSkeleton,
   head: () => ({
      meta: [{ title: "Relatórios — Montte" }],
   }),
   component: ReportsPage,
});

function ReportsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function ReportsPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Crie relatórios salvos para visualizar e exportar"
            title="Relatórios"
         />
         <div className="flex min-h-0 flex-1 flex-col">
            <QueryBoundary
               fallback={<ReportsSkeleton />}
               errorTitle="Erro ao carregar relatórios"
            >
               <ReportsList />
            </QueryBoundary>
         </div>
      </main>
   );
}

function getErrorMessage(error: unknown, fallback: string) {
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length > 0
   ) {
      return error.message;
   }
   return fallback;
}

type ReportQuery<T> = {
   where: (callback: (refs: any) => unknown) => T;
   orderBy: (callback: (refs: any) => unknown, direction?: "asc" | "desc") => T;
};

function applyFiltersAndSorting<TQuery extends ReportQuery<TQuery>>(
   query: TQuery,
   baseSearch: string,
   sorting: Array<{ id: string; desc: boolean }>,
) {
   let filteredQuery: TQuery = query;

   if (baseSearch) {
      filteredQuery = filteredQuery.where(({ report }) =>
         ilike(report.name, `%${baseSearch}%`),
      );
   }

   for (const rule of sorting) {
      switch (rule.id) {
         case "name":
            filteredQuery = filteredQuery.orderBy(
               ({ report }) => report.name,
               rule.desc ? "desc" : "asc",
            );
            break;
         case "type":
            filteredQuery = filteredQuery.orderBy(
               ({ report }) => report.type,
               rule.desc ? "desc" : "asc",
            );
            break;
         case "createdAt":
            filteredQuery = filteredQuery.orderBy(
               ({ report }) => report.createdAt,
               rule.desc ? "desc" : "asc",
            );
            break;
      }
   }

   if (sorting.length === 0) {
      filteredQuery = filteredQuery.orderBy(
         ({ report }) => report.createdAt,
         "desc",
      );
   }

   return filteredQuery;
}

function ReportsList() {
   const { activeTeamId } = useActiveTeam();
   if (!activeTeamId) {
      return <ReportsSkeleton />;
   }
   return <ReportsListWithTeam teamId={activeTeamId} />;
}

function ReportsListWithTeam({ teamId }: { teamId: string }) {
   const navigate = useNavigate();
   const routeNavigate = Route.useNavigate();
   const { slug, teamSlug } = useDashboardSlugs();
   const { sorting, columnFilters, search, page, pageSize } = Route.useSearch();
   const { queryClient } = Route.useRouteContext();
   const { openSheet } = useSheet();
   const { openAlertDialog } = useAlertDialog();
   const layout = useDataTableLayout("reports");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         routeNavigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const reportsCollection = useMemo(
      () =>
         createCollection(
            reportsCollectionOptions({
               queryClient,
               teamId,
            }),
         ),
      [teamId, queryClient],
   );
   const baseSearch = search.trim();
   const { data: allReports } = useLiveQuery(
      (q) => {
         const baseQuery = applyFiltersAndSorting(
            q.from({ report: reportsCollection }),
            baseSearch,
            sorting,
         );
         return baseQuery.select(({ report }) => report);
      },
      [baseSearch, reportsCollection, sorting],
   );

   const { data: reports } = useLiveQuery(
      (q) => {
         const baseQuery = applyFiltersAndSorting(
            q.from({ report: reportsCollection }),
            baseSearch,
            sorting,
         );
         return baseQuery
            .limit(pageSize)
            .offset((page - 1) * pageSize)
            .select(({ report }) => report);
      },
      [baseSearch, page, pageSize, reportsCollection, sorting],
   );
   const removeReport = useMemo(
      () => removeReportAction(reportsCollection),
      [reportsCollection],
   );
   const bulkRemoveReport = useMemo(
      () => bulkRemoveReportAction(reportsCollection),
      [reportsCollection],
   );

   const handleDelete = useCallback(
      (report: SavedReport) => {
         openAlertDialog({
            title: "Excluir relatório",
            description: `Tem certeza que deseja excluir "${report.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const transaction = removeReport({ id: report.id });
               const result = await fromPromise(
                  transaction.isPersisted.promise,
                  (error) => error,
               );
               if (result.isErr()) {
                  toast.error(
                     getErrorMessage(
                        result.error,
                        "Erro ao excluir relatório.",
                     ),
                  );
                  return;
               }
               toast.success("Relatório excluído.");
            },
         });
      },
      [openAlertDialog, removeReport],
   );

   const handleOpenCreate = useCallback(() => {
      openSheet({
         renderChildren: () => (
            <ReportFormSheet collection={reportsCollection} teamId={teamId} />
         ),
      });
   }, [openSheet, reportsCollection, teamId]);

   const columns = useMemo<ColumnDef<SavedReport>[]>(() => {
      const selectColumn: ColumnDef<SavedReport> = {
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

      return [selectColumn, ...buildReportsColumns({ onRemove: handleDelete })];
   }, [handleDelete]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      onUpdate: (next) =>
         routeNavigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
      totalRows: allReports.length,
   });

   const table = useReactTable({
      data: reports,
      columns,
      getRowId: (row) => row.id,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      manualFiltering: true,
      manualSorting: true,
      manualPagination: true,
      state: { ...urlState.state, ...layout.state },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      pageCount: urlState.pageCount,
      getCoreRowModel: getCoreRowModel(),
   });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((row) => row.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <SelectionActionButton
            icon={<Trash2 className="size-4" />}
            onClick={() => {
               openAlertDialog({
                  title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "relatório" : "relatórios"}`,
                  description:
                     "Tem certeza que deseja excluir os relatórios selecionados? Esta ação não pode ser desfeita.",
                  actionLabel: "Excluir",
                  cancelLabel: "Cancelar",
                  variant: "destructive",
                  onAction: async () => {
                     const result = await fromPromise(
                        bulkRemoveReport({ ids: selectedIds }).isPersisted
                           .promise,
                        (error) => error,
                     );
                     if (result.isErr()) {
                        toast.error(
                           getErrorMessage(
                              result.error,
                              "Erro ao excluir relatórios.",
                           ),
                        );
                        return;
                     }
                     toast.success("Relatórios excluídos.");
                     table.resetRowSelection();
                  },
               });
            }}
            variant="destructive"
         >
            Excluir
         </SelectionActionButton>
      ),
   });

   const goToReport = useCallback(
      (id: string) =>
         navigate({
            to: "/$slug/$teamSlug/reports/$reportId",
            params: { slug, teamSlug, reportId: id },
         }),
      [navigate, slug, teamSlug],
   );

   return (
      <div className="flex flex-1 min-h-0 flex-col gap-4">
         <div className="flex flex-wrap items-center justify-between gap-2">
            <SearchInput
               aria-label="Buscar relatório por nome..."
               className="max-w-sm"
               onChange={(e) => searchInput.onChange(e.target.value)}
               placeholder="Buscar relatório por nome..."
               value={searchInput.value}
            />
            <div className="flex flex-wrap items-center gap-2">
               <DataTableColumnVisibility table={table} />
               <Button
                  onClick={handleOpenCreate}
                  size="icon-sm"
                  tooltip="Novo relatório"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo relatório</span>
               </Button>
            </div>
         </div>
         <ScrollArea className="bg-card flex-1 min-h-0 rounded-md border">
            <Table>
               <DataTableHeader table={table} />
               <DataTableBody<SavedReport>
                  renderRow={({ row }) => (
                     <TableRow
                        className="hover:bg-muted/50 cursor-pointer"
                        aria-selected={row.getIsSelected()}
                        data-selected={row.getIsSelected()}
                        data-state={
                           row.getIsSelected() ? "selected" : undefined
                        }
                        key={row.id}
                        onClick={() => goToReport(row.original.id)}
                        onKeyDown={(event) => {
                           if (event.key !== "Enter" && event.key !== " ") {
                              return;
                           }
                           event.preventDefault();
                           goToReport(row.original.id);
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
                     <ReceiptText className="size-10" />
                  </EmptyMedia>
                  <EmptyHeader>
                     <EmptyTitle>
                        {!baseSearch && allReports.length === 0
                           ? "Nenhum relatório criado"
                           : "Nenhum relatório encontrado"}
                     </EmptyTitle>
                     <EmptyDescription>
                        {!baseSearch && allReports.length === 0
                           ? "Crie o primeiro relatório para visualizar os dados do espaço atual."
                           : "Ajuste a busca ou crie um novo relatório."}
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            )}
         </ScrollArea>
      </div>
   );
}
