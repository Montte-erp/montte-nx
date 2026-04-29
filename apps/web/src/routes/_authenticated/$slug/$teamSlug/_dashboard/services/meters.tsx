import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
   formatCostBRL,
   summarizeByAggregation,
   totalUnitCost,
   type MeterForAggregate,
} from "@modules/billing/services/meters-aggregates";
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
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { useCallback, useMemo } from "react";
import { toast } from "@packages/ui/components/sonner";
import { z } from "zod";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { DefaultHeader } from "@/components/default-header";
import { requestTour } from "./-tour/store";
import { TourHelpButton } from "./-tour/tour-help-button";
import { QueryBoundary } from "@/components/query-boundary";
import { useContextPanelInfo } from "@/features/context-panel/use-context-panel";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { createSlug } from "@core/utils/text";
import { orpc } from "@/integrations/orpc/client";
import {
   buildMeterColumns,
   type MeterRow,
} from "./-meters/build-meter-columns";
import { MeterUsagePanel } from "./-meters/meter-usage-panel";
import { MetersAnalytics } from "./-meters/meters-analytics";
import {
   AGG_ICON,
   AGG_LABEL,
   type MeterAggregationKey,
} from "./-meters/labels";

const AGGREGATIONS = ["sum", "count", "count_unique", "max", "last"] as const;

const searchSchema = z.object({
   search: z.string().catch("").default(""),
   add: z.boolean().catch(false).default(false),
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
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

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
         onSuccess: () => {
            toast.success("Medidor criado.");
            navigate({ search: (s) => ({ ...s, add: false }), replace: true });
         },
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

   const handleAdd = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         if (!name) {
            toast.error("Nome é obrigatório.");
            return;
         }
         const eventName = createSlug(name).replace(/-/g, "_") || "evento";
         const unitCostStr = String(data.unitCost ?? "0");
         const unitCost = Number.isFinite(Number(unitCostStr))
            ? Number(unitCostStr).toFixed(4)
            : "0";
         await createMutation.mutateAsync({
            name,
            eventName,
            aggregation: "sum",
            filters: {},
            unitCost,
         });
      },
      [createMutation],
   );

   const importConfig: DataTableImportConfig = useMemo(
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

   const columns = useMemo(
      () =>
         buildMeterColumns({
            onSaveCell: handleSaveCell,
            onOpenUsage: handleOpenUsage,
            includeUsedIn: true,
         }),
      [handleSaveCell, handleOpenUsage],
   );

   const renderActions = useCallback(
      ({ row }: { row: { original: MeterRow } }) => (
         <Button
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(row.original)}
            size="icon-sm"
            tooltip="Excluir"
            variant="ghost"
         >
            <span className="sr-only">Excluir</span>×
         </Button>
      ),
      [handleDelete],
   );

   const groupBy = useCallback(
      (row: MeterRow) => (row.isActive ? row.aggregation : "__inactive__"),
      [],
   );

   const renderGroupHeader = useCallback(
      (key: string, rows: { original: MeterRow }[]) => {
         if (key === "__inactive__") {
            return (
               <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <PauseCircle className="size-4" />
                  <span className="font-semibold">Pausados</span>
                  <span>· {rows.length}</span>
               </span>
            );
         }
         const agg = key as MeterAggregationKey;
         const Icon = AGG_ICON[agg];
         const aggregates: MeterForAggregate[] = rows.map((r) => ({
            id: r.original.id,
            name: r.original.name,
            aggregation: r.original.aggregation,
            unitCost: r.original.unitCost,
            isActive: r.original.isActive,
            usedIn: r.original.usedIn,
         }));
         const summary = summarizeByAggregation(aggregates)[0];
         const total = totalUnitCost(aggregates);
         return (
            <span className="inline-flex items-center gap-2">
               <Icon className="size-4" />
               <span className="font-semibold">{AGG_LABEL[agg]}</span>
               <span className="text-muted-foreground">
                  · {summary?.activeCount ?? 0} ativos · {formatCostBRL(total)}
                  {summary?.topByCost
                     ? ` · top: "${summary.topByCost.name}"`
                     : ""}
               </span>
            </span>
         );
      },
      [],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={meters}
         getRowId={(r) => r.id}
         groupBy={groupBy}
         renderGroupHeader={renderGroupHeader}
         renderActions={renderActions}
         isDraftRowActive={search.add}
         onAddRow={handleAdd}
         onDiscardAddRow={() =>
            navigate({ search: (s) => ({ ...s, add: false }), replace: true })
         }
         storageKey="montte:datatable:meters"
      >
         <DataTableExternalFilter
            id="onlyActive"
            label="Somente ativos"
            group="Status"
            active={search.isActive === true}
            renderIcon={() => <Activity className="size-4" />}
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
         <DataTableExternalFilter
            id="onlyPaused"
            label="Somente pausados"
            group="Status"
            active={search.isActive === false}
            renderIcon={() => <PauseCircle className="size-4" />}
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
         <DataTableExternalFilter
            id="onlyInUse"
            label="Em uso"
            group="Uso"
            active={search.onlyInUse}
            renderIcon={() => <Link2 className="size-4" />}
            onToggle={(active) =>
               navigate({
                  search: (s) => ({ ...s, onlyInUse: active }),
                  replace: true,
               })
            }
         />
         <div className="flex flex-col gap-4">
            <DataTableToolbar
               searchPlaceholder="Buscar medidor..."
               searchDefaultValue={search.search}
               onSearch={(v) =>
                  navigate({
                     search: (s) => ({ ...s, search: v }),
                     replace: true,
                  })
               }
            >
               <DataTableImportButton importConfig={importConfig} />
               <Button
                  id="tour-meters-create"
                  onClick={() =>
                     navigate({
                        search: (s) => ({ ...s, add: true }),
                        replace: true,
                     })
                  }
                  size="icon-sm"
                  tooltip="Novo medidor"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo medidor</span>
               </Button>
            </DataTableToolbar>
            <DataTableContent />
            <DataTableBulkActions<MeterRow>>
               {({ selectedRows, clearSelection }) => {
                  const ids = selectedRows.map((r) => r.id);
                  return (
                     <>
                        <SelectionActionButton
                           icon={<CheckCircle2 />}
                           onClick={async () => {
                              const res = await bulkSetActiveMutation
                                 .mutateAsync({ ids, isActive: true })
                                 .catch(() => null);
                              if (res)
                                 toast.success(
                                    `${res.updated} medidor(es) ativado(s).`,
                                 );
                              clearSelection();
                           }}
                        >
                           Ativar
                        </SelectionActionButton>
                        <SelectionActionButton
                           icon={<XCircle />}
                           onClick={async () => {
                              const res = await bulkSetActiveMutation
                                 .mutateAsync({ ids, isActive: false })
                                 .catch(() => null);
                              if (res)
                                 toast.success(
                                    `${res.updated} medidor(es) desativado(s).`,
                                 );
                              clearSelection();
                           }}
                        >
                           Desativar
                        </SelectionActionButton>
                        <SelectionActionButton
                           icon={<Trash2 />}
                           variant="destructive"
                           onClick={() =>
                              openAlertDialog({
                                 title: `Excluir ${ids.length} medidor(es)`,
                                 description:
                                    "Preços e benefícios vinculados perderão a referência. Não pode ser desfeito.",
                                 actionLabel: "Excluir",
                                 cancelLabel: "Cancelar",
                                 variant: "destructive",
                                 onAction: async () => {
                                    await Promise.allSettled(
                                       ids.map((id) =>
                                          removeMutation.mutateAsync({ id }),
                                       ),
                                    );
                                    clearSelection();
                                 },
                              })
                           }
                        >
                           Excluir
                        </SelectionActionButton>
                     </>
                  );
               }}
            </DataTableBulkActions>
            <DataTableEmptyState>
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
                     <Button
                        onClick={() =>
                           navigate({
                              search: (s) => ({ ...s, add: true }),
                              replace: true,
                           })
                        }
                     >
                        <Plus />
                        Novo medidor
                     </Button>
                  </EmptyContent>
               </Empty>
            </DataTableEmptyState>
         </div>
      </DataTableRoot>
   );
}
