import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { createSlug } from "@core/utils/text";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getFilteredRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type RowSelectionState,
   type SortingState,
} from "@tanstack/react-table";
import {
   Activity,
   CheckCircle2,
   Gauge,
   Link2,
   PauseCircle,
   Plus,
   Trash2,
   XCircle,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/components/sonner";
import { z } from "zod";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import { useDataImport } from "@/blocks/data-table/data-import/use-data-import";
import type { DataImportConfig } from "@/blocks/data-table/data-import/types";
import { PageFilters } from "@/components/page-filters/page-filters";
import { PageFilter } from "@/components/page-filters/page-filter";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { DefaultHeader } from "../../-layout/default-header";
import { requestTour } from "./-tour/store";
import { TourHelpButton } from "./-tour/tour-help-button";
import { QueryBoundary } from "@/components/query-boundary";
import { useContextPanelInfo } from "../../-context-panel/use-context-panel";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import {
   buildMeterColumns,
   type MeterRow,
} from "./-meters/build-meter-columns";
import { MeterFormSheet } from "./-meters/meter-form-sheet";
import { MeterUsagePanel } from "./-meters/meter-usage-panel";
import { MetersAnalytics } from "./-meters/meters-analytics";
import { type MeterAggregationKey } from "./-meters/labels";

const AGGREGATIONS = ["sum", "count", "count_unique", "max", "last"] as const;

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().catch("").default(""),
   isActive: z
      .union([z.literal(true), z.literal(false)])
      .optional()
      .catch(undefined),
   onlyInUse: z.boolean().catch(false).default(false),
   aggregation: z.enum(AGGREGATIONS).optional().catch(undefined),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/services/meters",
)({
   validateSearch: searchSchema,
   loaderDeps: ({ search }) => ({
      search: search.search,
      isActive: search.isActive,
      onlyInUse: search.onlyInUse,
      aggregation: search.aggregation,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.meters.getMeters.queryOptions({
            input: {
               search: deps.search || undefined,
               isActive: deps.isActive,
               onlyInUse: deps.onlyInUse || undefined,
               aggregation: deps.aggregation,
            },
         }),
      );
   },
   onEnter: () => {
      requestTour("meters-intro");
   },
   pendingMs: 300,
   pendingComponent: () => (
      <main className="flex h-full flex-col gap-4">
         <DataTableSkeleton columns={[]} />
      </main>
   ),
   head: () => ({ meta: [{ title: "Medidores — Montte" }] }),
   component: MetersPage,
});

function MetersPage() {
   return (
      <main className="flex h-full flex-col gap-4">
         <div id="tour-meters-header">
            <DefaultHeader
               actions={<TourHelpButton tourId="meters-intro" />}
               description="Medidores rastreiam eventos para cobrança e créditos de benefícios."
               title="Medidores"
            />
         </div>
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               errorTitle="Erro ao carregar medidores"
               fallback={<DataTableSkeleton columns={[]} />}
            >
               <MetersList />
            </QueryBoundary>
         </div>
      </main>
   );
}

function MetersList() {
   const navigate = useNavigate({ from: Route.fullPath });
   const search = Route.useSearch();
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();
   const { openCredenza } = useCredenza();
   const { openSheet } = useSheet();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const layout = useDataTableLayout("meters");

   const searchInput = useDebouncedSearch({
      value: search.search,
      onCommit: (value) =>
         navigate({
            search: (s) => ({ ...s, search: value }),
            replace: true,
         }),
   });

   const queryInput = {
      search: search.search || undefined,
      isActive: search.isActive,
      onlyInUse: search.onlyInUse || undefined,
      aggregation: search.aggregation,
   };

   const { data: meters } = useSuspenseQuery(
      orpc.meters.getMeters.queryOptions({ input: queryInput }),
   );

   useContextPanelInfo(() => <MetersAnalytics meters={meters} />);

   const updateMutation = useMutation(
      orpc.meters.updateMeterById.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const createMutation = useMutation(
      orpc.meters.createMeter.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const removeMutation = useMutation(
      orpc.meters.removeMeter.mutationOptions({
         onSuccess: () => toast.success("Medidor excluído."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const bulkSetActiveMutation = useMutation(
      orpc.meters.bulkSetActive.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleSaveCell = useCallback(
      async (
         rowId: string,
         field:
            | "name"
            | "eventName"
            | "aggregation"
            | "aggregationProperty"
            | "unitCost"
            | "isActive",
         value: unknown,
      ) => {
         await updateMutation.mutateAsync({ id: rowId, [field]: value });
      },
      [updateMutation],
   );

   const handleOpenCreate = useCallback(() => {
      openSheet({ renderChildren: () => <MeterFormSheet /> });
   }, [openSheet]);

   const importConfig: DataImportConfig = useMemo(
      () => ({
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         mapRow: (row, i) => {
            const rawAgg = String(row.aggregation ?? "")
               .toLowerCase()
               .trim();
            let aggregation: MeterAggregationKey = "sum";
            if (
               rawAgg.includes("contagem única") ||
               rawAgg.includes("count_unique")
            )
               aggregation = "count_unique";
            else if (rawAgg.includes("contagem") || rawAgg.includes("count"))
               aggregation = "count";
            else if (rawAgg.includes("máximo") || rawAgg.includes("max"))
               aggregation = "max";
            else if (rawAgg.includes("último") || rawAgg.includes("last"))
               aggregation = "last";
            const unitCostRaw = String(row.unitCost ?? "0")
               .replace(/[R$\s.]/g, "")
               .replace(",", ".");
            const name = String(row.name ?? "").trim();
            const eventName =
               String(row.eventName ?? "").trim() ||
               createSlug(name).replace(/-/g, "_") ||
               "evento";
            return {
               id: `__import_${i}`,
               name,
               eventName,
               aggregation,
               unitCost: unitCostRaw,
               aggregationProperty:
                  String(row.aggregationProperty ?? "").trim() || null,
            };
         },
         onImport: async (rows) => {
            const results = await Promise.allSettled(
               rows.map((r) => {
                  const name = String(r.name ?? "").trim();
                  if (!name) return Promise.reject(new Error("skip"));
                  const eventName =
                     String(r.eventName ?? "").trim() ||
                     createSlug(name).replace(/-/g, "_") ||
                     "evento";
                  const aggregation =
                     (r.aggregation as MeterAggregationKey) ?? "sum";
                  const unitCostStr = String(r.unitCost ?? "0");
                  const unitCost = Number.isFinite(Number(unitCostStr))
                     ? Number(unitCostStr).toFixed(4)
                     : "0";
                  return createMutation.mutateAsync({
                     name,
                     eventName,
                     aggregation,
                     filters: {},
                     unitCost,
                     aggregationProperty:
                        typeof r.aggregationProperty === "string"
                           ? r.aggregationProperty
                           : null,
                  });
               }),
            );
            const ok = results.filter((r) => r.status === "fulfilled").length;
            const failed = results.filter(
               (r) =>
                  r.status === "rejected" &&
                  (r.reason as Error)?.message !== "skip",
            ).length;
            if (ok > 0) toast.success(`${ok} medidor(es) importado(s).`);
            if (failed > 0) toast.error(`${failed} medidor(es) com erro.`);
            await queryClient.invalidateQueries({
               queryKey: orpc.meters.getMeters.queryKey(),
            });
         },
      }),
      [parseCsv, parseXlsx, createMutation, queryClient],
   );

   const handleDelete = useCallback(
      (meter: MeterRow) => {
         openAlertDialog({
            title: "Excluir medidor",
            description: `Excluir "${meter.name}"? Preços e benefícios vinculados perderão a referência.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await removeMutation.mutateAsync({ id: meter.id });
            },
         });
      },
      [openAlertDialog, removeMutation],
   );

   const handleOpenUsage = useCallback(
      (meter: MeterRow) => {
         openCredenza({
            renderChildren: () => (
               <MeterUsagePanel meterId={meter.id} meterName={meter.name} />
            ),
         });
      },
      [openCredenza],
   );

   const columns = useMemo<ColumnDef<MeterRow>[]>(() => {
      const base = buildMeterColumns({
         onSaveCell: handleSaveCell,
         onOpenUsage: handleOpenUsage,
         includeUsedIn: true,
      });
      const selectColumn: ColumnDef<MeterRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
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
               onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onCheckedChange={(v) => row.toggleSelected(!!v)}
            />
         ),
      };
      const actionsColumn: ColumnDef<MeterRow> = {
         id: "__actions",
         size: 60,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="ghost"
               >
                  <Trash2 />
                  <span className="sr-only">Excluir</span>
               </Button>
            </div>
         ),
      };
      return [selectColumn, ...base, actionsColumn];
   }, [handleSaveCell, handleOpenUsage, handleDelete]);

   const [sorting, setSorting] = useState<SortingState>(search.sorting);
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
      search.columnFilters,
   );
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const table = useReactTable({
      data: meters,
      columns,
      getRowId: (r) => r.id,
      state: { sorting, columnFilters, rowSelection },
      onSortingChange: setSorting,
      onColumnFiltersChange: setColumnFilters,
      onRowSelectionChange: setRowSelection,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      initialState: {
         columnSizing: layout.initialState.columnSizing,
         columnOrder: layout.initialState.columnOrder,
         columnVisibility: layout.initialState.columnVisibility,
         columnPinning: layout.initialState.columnPinning,
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
   });

   const importApi = useDataImport({ table, config: importConfig });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((r) => r.original.id);
   const resetSelection = () => table.resetRowSelection();

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: resetSelection,
      children: (
         <>
            <SelectionActionButton
               icon={<CheckCircle2 />}
               onClick={async () => {
                  const res = await bulkSetActiveMutation
                     .mutateAsync({ ids: selectedIds, isActive: true })
                     .catch(() => null);
                  if (res)
                     toast.success(`${res.updated} medidor(es) ativado(s).`);
                  resetSelection();
               }}
            >
               Ativar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<XCircle />}
               onClick={async () => {
                  const res = await bulkSetActiveMutation
                     .mutateAsync({ ids: selectedIds, isActive: false })
                     .catch(() => null);
                  if (res)
                     toast.success(`${res.updated} medidor(es) desativado(s).`);
                  resetSelection();
               }}
            >
               Desativar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Trash2 />}
               variant="destructive"
               onClick={() =>
                  openAlertDialog({
                     title: `Excluir ${selectedIds.length} medidor(es)`,
                     description:
                        "Preços e benefícios vinculados perderão a referência. Não pode ser desfeito.",
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     variant: "destructive",
                     onAction: async () => {
                        await Promise.allSettled(
                           selectedIds.map((id) =>
                              removeMutation.mutateAsync({ id }),
                           ),
                        );
                        resetSelection();
                     },
                  })
               }
            >
               Excluir
            </SelectionActionButton>
         </>
      ),
   });

   return (
      <div className="flex flex-col gap-4">
         <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  aria-label="Buscar medidor"
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar medidor..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <PageFilters>
                     <PageFilter
                        active={search.isActive === true}
                        group="Status"
                        icon={<Activity className="size-4" />}
                        id="onlyActive"
                        label="Somente ativos"
                        onToggle={(active) =>
                           navigate({
                              search: (s) => ({
                                 ...s,
                                 isActive: active ? true : undefined,
                              }),
                              replace: true,
                           })
                        }
                     />
                     <PageFilter
                        active={search.isActive === false}
                        group="Status"
                        icon={<PauseCircle className="size-4" />}
                        id="onlyPaused"
                        label="Somente pausados"
                        onToggle={(active) =>
                           navigate({
                              search: (s) => ({
                                 ...s,
                                 isActive: active ? false : undefined,
                              }),
                              replace: true,
                           })
                        }
                     />
                     <PageFilter
                        active={search.onlyInUse}
                        group="Uso"
                        icon={<Link2 className="size-4" />}
                        id="onlyInUse"
                        label="Em uso"
                        onToggle={(active) =>
                           navigate({
                              search: (s) => ({ ...s, onlyInUse: active }),
                              replace: true,
                           })
                        }
                     />
                  </PageFilters>
                  <DataTableColumnVisibility table={table} />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     id="tour-meters-create"
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Novo medidor"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo medidor</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<MeterRow> table={table} />
               </Table>
            </ScrollArea>
            <DataImportSection
               api={importApi}
               config={importConfig}
               table={table}
            />
            {table.getRowCount() === 0 && (
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Gauge className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum medidor</EmptyTitle>
                     <EmptyDescription>
                        Medidores rastreiam consumo. Depois associe a preços,
                        benefícios e cupons.
                     </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                     <Button onClick={handleOpenCreate}>
                        <Plus />
                        Novo medidor
                     </Button>
                  </EmptyContent>
               </Empty>
            )}
         </div>
      </div>
   );
}
