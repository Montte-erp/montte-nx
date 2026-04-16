import type {
   Dashboard,
   DashboardTile as DashboardTileType,
} from "@core/database/schemas/dashboards";
import type { Insight } from "@core/database/schemas/insights";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   DataTable,
   type DataTableStoredState,
} from "@packages/ui/components/data-table";
import {
   useMutation,
   useSuspenseQuery,
   useQueryClient,
} from "@tanstack/react-query";
import type {
   ColumnDef,
   ColumnFiltersState,
   SortingState,
} from "@tanstack/react-table";
import { BarChart3, CheckCircle2, Plus } from "lucide-react";
import { noop } from "foxact/noop";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { DashboardGrid } from "./dashboard-grid";
import { DashboardTile } from "./dashboard-tile";

interface EditableDashboardGridProps {
   dashboard: Dashboard;
   onOpenAddInsight?: (handler: () => void) => void;
   isEditingLayout: boolean;
   onSaveReady?: (handler: () => void) => void;
   onCancelReady?: (handler: () => void) => void;
   onSaveComplete?: () => void;
   onSaveError?: () => void;
}

function deriveTileSize(insight: Insight): DashboardTileType["size"] {
   const config = insight.config as Record<string, unknown> | undefined;
   const chartType = config?.chartType as string | undefined;
   return chartType === "number" ? "sm" : "md";
}

function makeInsightColumns(
   existingInsightIds: Set<string>,
   onAdd: (insight: Insight) => void,
): ColumnDef<Insight>[] {
   return [
      {
         accessorKey: "name",
         header: "Nome",
         cell: ({ row }) => {
            const isAdded = existingInsightIds.has(row.original.id);
            return (
               <div className="flex items-center gap-3">
                  <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                     <BarChart3 className="size-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-sm font-medium truncate">
                        {row.original.name}
                     </p>
                     {row.original.description && (
                        <p className="text-xs text-muted-foreground truncate">
                           {row.original.description}
                        </p>
                     )}
                  </div>
                  {isAdded && (
                     <CheckCircle2 className="size-4 text-muted-foreground shrink-0" />
                  )}
               </div>
            );
         },
      },
      {
         accessorKey: "type",
         header: "Tipo",
         cell: ({ getValue }) => (
            <span className="text-sm capitalize">{getValue() as string}</span>
         ),
      },
      {
         id: "actions",
         header: "Status",
         cell: ({ row }) => {
            const isAdded = existingInsightIds.has(row.original.id);
            if (isAdded) {
               return (
                  <span className="text-xs text-muted-foreground">
                     Adicionado
                  </span>
               );
            }
            return (
               <Button onClick={() => onAdd(row.original)} variant="outline">
                  <Plus className="size-3.5" />
                  Adicionar
               </Button>
            );
         },
      },
   ];
}

const PAGE_SIZE = 5;

function AddInsightCredenza({
   existingInsightIds,
   onAdd,
}: {
   existingInsightIds: Set<string>;
   onAdd: (insight: Insight) => void;
}) {
   const [currentPage, setCurrentPage] = useState(1);
   const [sorting, setSorting] = useState<SortingState>([]);
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
   const [tableState, setTableState] = useState<DataTableStoredState | null>(
      null,
   );
   const { data: insights } = useSuspenseQuery(
      orpc.insights.list.queryOptions({}),
   );

   const columns = useMemo(
      () => makeInsightColumns(existingInsightIds, onAdd),
      [existingInsightIds, onAdd],
   );

   const allInsights = insights ?? [];
   const totalPages = Math.max(1, Math.ceil(allInsights.length / PAGE_SIZE));
   const paginatedInsights = allInsights.slice(
      (currentPage - 1) * PAGE_SIZE,
      currentPage * PAGE_SIZE,
   );

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Adicionar insight</CredenzaTitle>
            <CredenzaDescription>
               Selecione um insight para adicionar ao dashboard.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            {allInsights.length === 0 ? (
               <div className="flex flex-col items-center justify-center gap-4 py-8 text-muted-foreground">
                  <BarChart3 className="size-8" />
                  <p className="text-sm text-center">
                     Nenhum insight criado ainda. Crie insights na seção de
                     Analytics.
                  </p>
               </div>
            ) : (
               <DataTable
                  columns={columns}
                  data={paginatedInsights}
                  getRowId={(row) => row.id}
                  sorting={sorting}
                  onSortingChange={setSorting}
                  columnFilters={columnFilters}
                  onColumnFiltersChange={setColumnFilters}
                  tableState={tableState}
                  onTableStateChange={setTableState}
                  pagination={{
                     currentPage,
                     totalPages,
                     totalCount: allInsights.length,
                     pageSize: PAGE_SIZE,
                     onPageChange: setCurrentPage,
                  }}
               />
            )}
         </CredenzaBody>
      </>
   );
}

export function EditableDashboardGrid({
   dashboard,
   onOpenAddInsight: externalOnOpenAddInsight,
   isEditingLayout,
   onSaveReady,
   onCancelReady,
   onSaveComplete,
   onSaveError,
}: EditableDashboardGridProps) {
   const queryClient = useQueryClient();
   const { openCredenza, closeCredenza } = useCredenza();

   const [localTiles, setLocalTiles] = useState<DashboardTileType[]>(
      dashboard.tiles,
   );

   const dashboardTilesJson = JSON.stringify(dashboard.tiles);
   const [lastDashboardTiles, setLastDashboardTiles] =
      useState(dashboardTilesJson);

   if (dashboardTilesJson !== lastDashboardTiles) {
      setLastDashboardTiles(dashboardTilesJson);
      setLocalTiles(dashboard.tiles);
   }

   const { mutate: saveMutate } = useMutation(
      orpc.dashboards.updateTiles.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: orpc.analytics.getDefaultDashboard.queryKey(),
            });
            queryClient.invalidateQueries({
               queryKey: orpc.dashboards.getById.queryKey({
                  input: { id: dashboard.id },
               }),
            });
         },
      }),
   );

   const stableOnSaveComplete = useCallback(onSaveComplete ?? noop, [
      onSaveComplete,
   ]);
   const stableOnSaveError = useCallback(onSaveError ?? noop, [onSaveError]);

   const handleReorder = useCallback((reordered: DashboardTileType[]) => {
      setLocalTiles(reordered);
   }, []);

   const handleRemoveTile = useCallback((insightId: string) => {
      setLocalTiles((prev) =>
         prev
            .filter((t) => t.insightId !== insightId)
            .map((t, i) => ({ ...t, order: i })),
      );
   }, []);

   const handleResizeTile = useCallback(
      (insightId: string, size: DashboardTileType["size"]) => {
         setLocalTiles((prev) =>
            prev.map((t) => (t.insightId === insightId ? { ...t, size } : t)),
         );
      },
      [],
   );

   const handleDuplicateTile = useCallback((insightId: string) => {
      setLocalTiles((prev) => {
         const source = prev.find((t) => t.insightId === insightId);
         if (!source) return prev;
         const sourceIndex = prev.indexOf(source);
         const updated = [...prev];
         updated.splice(sourceIndex + 1, 0, {
            insightId: source.insightId,
            size: source.size,
            order: sourceIndex + 1,
         });
         return updated.map((t, i) => ({ ...t, order: i }));
      });
   }, []);

   const handleAddInsight = useCallback(
      (insight: Insight) => {
         setLocalTiles((prev) => [
            ...prev,
            {
               insightId: insight.id,
               size: deriveTileSize(insight),
               order: prev.length,
            },
         ]);
         closeCredenza();
      },
      [closeCredenza],
   );

   const handleOpenAddInsight = useCallback(() => {
      const existingIds = new Set(localTiles.map((t) => t.insightId));
      openCredenza({
         renderChildren: () => (
            <AddInsightCredenza
               existingInsightIds={existingIds}
               onAdd={handleAddInsight}
            />
         ),
      });
   }, [localTiles, openCredenza, handleAddInsight]);

   const handleSave = useCallback(() => {
      saveMutate(
         { id: dashboard.id, tiles: localTiles },
         {
            onSuccess: () => stableOnSaveComplete(),
            onError: () => stableOnSaveError(),
         },
      );
   }, [saveMutate, dashboard.id, localTiles]);

   const handleCancel = useCallback(() => {
      setLocalTiles(dashboard.tiles);
   }, [dashboard.tiles]);

   useEffect(() => {
      if (externalOnOpenAddInsight) {
         externalOnOpenAddInsight(handleOpenAddInsight);
      }
   }, [externalOnOpenAddInsight, handleOpenAddInsight]);

   useEffect(() => {
      if (onSaveReady) onSaveReady(handleSave);
   }, [onSaveReady, handleSave]);

   useEffect(() => {
      if (onCancelReady) onCancelReady(handleCancel);
   }, [onCancelReady, handleCancel]);

   if (localTiles.length === 0 && !isEditingLayout) {
      return (
         <Card>
            <CardHeader className="items-center text-center py-12">
               <BarChart3 className="size-10 text-muted-foreground mb-2" />
               <CardTitle className="text-base">Dashboard vazio</CardTitle>
               <CardDescription>
                  Use o botão "Adicionar insight" para começar.
               </CardDescription>
            </CardHeader>
         </Card>
      );
   }

   return (
      <div className="flex flex-col gap-4">
         <DashboardGrid
            onReorder={handleReorder}
            onResize={handleResizeTile}
            renderTile={(tile, resizeProps) => (
               <DashboardTile
                  globalDateRange={dashboard.globalDateRange ?? undefined}
                  globalFilters={dashboard.globalFilters ?? undefined}
                  id={tile.insightId}
                  insightId={tile.insightId}
                  isEditing={isEditingLayout}
                  isResizing={resizeProps.isResizing}
                  key={tile.insightId}
                  onDuplicate={() => handleDuplicateTile(tile.insightId)}
                  onRemove={() => handleRemoveTile(tile.insightId)}
                  onResizeCommit={resizeProps.onResizeCommit}
                  onResizePreview={resizeProps.onResizePreview}
                  size={tile.size}
               />
            )}
            tiles={localTiles}
         />
      </div>
   );
}
