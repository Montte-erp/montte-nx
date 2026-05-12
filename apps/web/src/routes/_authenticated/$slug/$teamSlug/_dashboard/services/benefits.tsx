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
import { SelectionActionButton } from "@packages/ui/components/selection-action-bar";
import {
   useMutation,
   useQueryClient,
   useSuspenseQueries,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
   Copy,
   Gift,
   PauseCircle,
   Plus,
   Sparkles,
   Trash2,
   XCircle,
} from "lucide-react";
import { startTransition, useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/components/sonner";
import { z } from "zod";
import { DataTableBody } from "@/components/data-table-v2/data-table-body";
import { DataTableBulkActionBar } from "@/components/data-table-v2/data-table-bulk-action-bar";
import { DataTableColumnVisibility } from "@/components/data-table-v2/data-table-column-visibility";
import { DataTableContainer } from "@/components/data-table-v2/data-table-container";
import { DataTableEmptyState } from "@/components/data-table-v2/data-table-empty-state";
import { DataTableHeader } from "@/components/data-table-v2/data-table-header";
import { DataTableRoot } from "@/components/data-table-v2/data-table-root";
import { DataTableSearch } from "@/components/data-table-v2/data-table-search";
import { DataTableSkeleton } from "@/components/data-table-v2/data-table-skeleton";
import {
   DataTableToolbar,
   DataTableToolbarGroup,
} from "@/components/data-table-v2/data-table-toolbar";
import { useDataTableLayout } from "@/components/data-table-v2/use-data-table-layout";
import { DataImportButton } from "@/features/data-import/data-import-button";
import { DataImportSection } from "@/features/data-import/data-import-section";
import { useDataImport } from "@/features/data-import/use-data-import";
import type { DataImportConfig } from "@/features/data-import/types";
import { PageFilters } from "@/components/page-filters/page-filters";
import { PageFilter } from "@/components/page-filters/page-filter";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { DefaultHeader } from "../../-layout/default-header";
import { requestTour } from "./-tour/store";
import { TourHelpButton } from "./-tour/tour-help-button";
import { QueryBoundary } from "@/components/query-boundary";
import { useContextPanelInfo } from "../../-context-panel/use-context-panel";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import {
   buildBenefitColumns,
   type BenefitRow,
} from "./-benefits/build-benefit-columns";
import { BenefitFormSheet } from "./-benefits/benefit-form-sheet";
import { BenefitsAnalytics } from "./-benefits/benefits-analytics";
import { type BenefitTypeKey } from "./-benefits/labels";
import { useCreateMeterFromName } from "./-services/use-create-meter";

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
   type: z
      .enum(["credits", "feature_access", "custom"])
      .optional()
      .catch(undefined),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/services/benefits",
)({
   validateSearch: searchSchema,
   loaderDeps: ({ search }) => ({
      search: search.search,
      isActive: search.isActive,
      onlyInUse: search.onlyInUse,
      type: search.type,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.benefits.getBenefits.queryOptions({
            input: {
               search: deps.search || undefined,
               isActive: deps.isActive,
               onlyInUse: deps.onlyInUse || undefined,
               type: deps.type,
            },
         }),
      );
      context.queryClient.prefetchQuery(orpc.meters.getMeters.queryOptions({}));
   },
   onEnter: () => {
      requestTour("benefits-intro");
   },
   pendingMs: 300,
   pendingComponent: () => (
      <main className="flex h-full flex-col gap-4">
         <DataTableSkeleton columns={[]} />
      </main>
   ),
   head: () => ({ meta: [{ title: "Benefícios — Montte" }] }),
   component: BenefitsPage,
});

function BenefitsPage() {
   return (
      <main className="flex h-full flex-col gap-4">
         <div id="tour-benefits-header">
            <DefaultHeader
               actions={<TourHelpButton tourId="benefits-intro" />}
               description="Benefícios podem ser linkados a múltiplos serviços e impactam o custo efetivo."
               title="Benefícios"
            />
         </div>
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               errorTitle="Erro ao carregar benefícios"
               fallback={<DataTableSkeleton columns={[]} />}
            >
               <BenefitsList />
            </QueryBoundary>
         </div>
      </main>
   );
}

function BenefitsList() {
   const navigate = useNavigate({ from: Route.fullPath });
   const search = Route.useSearch();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const layout = useDataTableLayout("benefits");

   const queryInput = {
      search: search.search || undefined,
      isActive: search.isActive,
      onlyInUse: search.onlyInUse || undefined,
      type: search.type,
   };

   const [{ data: benefits }, { data: meters }] = useSuspenseQueries({
      queries: [
         orpc.benefits.getBenefits.queryOptions({ input: queryInput }),
         orpc.meters.getMeters.queryOptions({}),
      ],
   });

   useContextPanelInfo(() => <BenefitsAnalytics benefits={benefits} />);

   const meterOptions = useMemo(
      () => meters.map((m) => ({ value: m.id, label: m.name })),
      [meters],
   );

   const updateMutation = useMutation(
      orpc.benefits.updateBenefitById.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const createMutation = useMutation(
      orpc.benefits.createBenefit.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const bulkSetActiveMutation = useMutation(
      orpc.benefits.bulkSetActive.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const removeMutation = useMutation(
      orpc.benefits.removeBenefit.mutationOptions({
         onSuccess: () => toast.success("Benefício excluído."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleCreateMeter = useCreateMeterFromName();

   const handleSaveCell = useCallback(
      async (
         rowId: string,
         field:
            | "name"
            | "type"
            | "creditAmount"
            | "meterId"
            | "rollover"
            | "unitCost"
            | "isActive",
         value: unknown,
      ) => {
         await updateMutation.mutateAsync({ id: rowId, [field]: value });
      },
      [updateMutation],
   );

   const handleOpenCreate = useCallback(() => {
      openSheet({ renderChildren: () => <BenefitFormSheet /> });
   }, [openSheet]);

   const importConfig: DataImportConfig = useMemo(
      () => ({
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         mapRow: (row, i) => {
            const rawType = String(row.type ?? "")
               .toLowerCase()
               .trim();
            let type: BenefitTypeKey = "credits";
            if (rawType.includes("acesso") || rawType.includes("feature"))
               type = "feature_access";
            else if (
               rawType.includes("personalizado") ||
               rawType.includes("custom")
            )
               type = "custom";
            const creditAmount = String(row.creditAmount ?? "").trim();
            const unitCostRaw = String(row.unitCost ?? "0")
               .replace(/[R$\s.]/g, "")
               .replace(",", ".");
            return {
               id: `__import_${i}`,
               name: String(row.name ?? "").trim(),
               type,
               creditAmount,
               unitCost: unitCostRaw,
               description: String(row.description ?? "").trim() || null,
            };
         },
         onImport: async (rows) => {
            const results = await Promise.allSettled(
               rows.map((r) => {
                  const name = String(r.name ?? "").trim();
                  if (!name) return Promise.reject(new Error("skip"));
                  const type = (r.type as BenefitTypeKey) ?? "credits";
                  const creditAmountStr = String(r.creditAmount ?? "");
                  const creditAmount =
                     type === "credits" && creditAmountStr
                        ? Number.parseInt(creditAmountStr, 10)
                        : null;
                  const unitCostStr = String(r.unitCost ?? "0");
                  const unitCost = Number.isFinite(Number(unitCostStr))
                     ? Number(unitCostStr).toFixed(4)
                     : "0";
                  return createMutation.mutateAsync({
                     name,
                     type,
                     creditAmount,
                     meterId: null,
                     rollover: false,
                     unitCost,
                     description:
                        typeof r.description === "string"
                           ? r.description
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
            if (ok > 0) toast.success(`${ok} benefício(s) importado(s).`);
            if (failed > 0) toast.error(`${failed} benefício(s) com erro.`);
            await queryClient.invalidateQueries({
               queryKey: orpc.benefits.getBenefits.queryKey(),
            });
         },
      }),
      [parseCsv, parseXlsx, createMutation, queryClient],
   );

   const handleDuplicate = useCallback(
      async (benefit: BenefitRow) => {
         const existing = new Set(benefits.map((b) => b.name.toLowerCase()));
         let suffix = 1;
         let name = `${benefit.name} (cópia)`;
         while (existing.has(name.toLowerCase())) {
            suffix += 1;
            name = `${benefit.name} (cópia ${suffix})`;
         }
         await createMutation.mutateAsync({
            name,
            type: benefit.type,
            meterId: benefit.meterId,
            creditAmount: benefit.creditAmount,
            description: benefit.description,
            unitCost: benefit.unitCost,
            rollover: benefit.rollover,
         });
         toast.success("Benefício duplicado.");
      },
      [benefits, createMutation],
   );

   const handleDelete = useCallback(
      (benefit: BenefitRow) => {
         openAlertDialog({
            title: "Excluir benefício",
            description: `Excluir "${benefit.name}"? Será removido de todos os serviços vinculados.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await removeMutation.mutateAsync({ id: benefit.id });
            },
         });
      },
      [openAlertDialog, removeMutation],
   );

   const columns = useMemo<ColumnDef<BenefitRow>[]>(() => {
      const base = buildBenefitColumns({
         meterOptions,
         onSaveCell: handleSaveCell,
         onCreateMeter: handleCreateMeter,
         includeUsedInServices: true,
      });
      const selectColumn: ColumnDef<BenefitRow> = {
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
      const actionsColumn: ColumnDef<BenefitRow> = {
         id: "__actions",
         size: 100,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  onClick={() => handleDuplicate(row.original)}
                  size="icon-sm"
                  tooltip="Duplicar"
                  variant="ghost"
               >
                  <Copy />
                  <span className="sr-only">Duplicar</span>
               </Button>
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
   }, [
      meterOptions,
      handleSaveCell,
      handleCreateMeter,
      handleDuplicate,
      handleDelete,
   ]);

   const [sorting, setSorting] = useState<SortingState>(search.sorting);
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
      search.columnFilters,
   );
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const table = useReactTable({
      data: benefits,
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

   return (
      <DataTableRoot table={table}>
         <div className="flex flex-col gap-4">
            <DataTableToolbar>
               <DataTableSearch
                  onChange={(v) =>
                     startTransition(() => {
                        navigate({
                           search: (s) => ({ ...s, search: v }),
                           replace: true,
                        });
                     })
                  }
                  placeholder="Buscar benefício..."
                  value={search.search}
               />
               <DataTableToolbarGroup>
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
                        icon={<Sparkles className="size-4" />}
                        id="onlyInUse"
                        label="Em uso por algum serviço"
                        onToggle={(active) =>
                           navigate({
                              search: (s) => ({ ...s, onlyInUse: active }),
                              replace: true,
                           })
                        }
                     />
                  </PageFilters>
                  <DataTableColumnVisibility />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     id="tour-benefits-create"
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Novo benefício"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo benefício</span>
                  </Button>
               </DataTableToolbarGroup>
            </DataTableToolbar>
            <DataTableContainer>
               <DataTableHeader />
               <DataTableBody<BenefitRow> />
            </DataTableContainer>
            <DataImportSection
               api={importApi}
               config={importConfig}
               table={table}
            />
            <DataTableBulkActionBar<BenefitRow>>
               {({ rows, clear }) => {
                  const ids = rows.map((r) => r.original.id);
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
                                    `${res.updated} benefício(s) ativado(s).`,
                                 );
                              clear();
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
                                    `${res.updated} benefício(s) desativado(s).`,
                                 );
                              clear();
                           }}
                        >
                           Desativar
                        </SelectionActionButton>
                        <SelectionActionButton
                           icon={<Trash2 />}
                           variant="destructive"
                           onClick={() =>
                              openAlertDialog({
                                 title: `Excluir ${ids.length} benefício(s)`,
                                 description:
                                    "Serão removidos de todos os serviços vinculados. Não pode ser desfeito.",
                                 actionLabel: "Excluir",
                                 cancelLabel: "Cancelar",
                                 variant: "destructive",
                                 onAction: async () => {
                                    await Promise.allSettled(
                                       ids.map((id) =>
                                          removeMutation.mutateAsync({ id }),
                                       ),
                                    );
                                    clear();
                                 },
                              })
                           }
                        >
                           Excluir
                        </SelectionActionButton>
                     </>
                  );
               }}
            </DataTableBulkActionBar>
            <DataTableEmptyState>
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Gift className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum benefício</EmptyTitle>
                     <EmptyDescription>
                        Benefícios reduzem o custo do serviço. Tipo créditos
                        exige um{" "}
                        <Link
                           className="underline underline-offset-2"
                           params={{ slug, teamSlug }}
                           to="/$slug/$teamSlug/services/meters"
                        >
                           medidor
                        </Link>
                        .
                     </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                     <Button onClick={handleOpenCreate}>
                        <Plus />
                        Novo benefício
                     </Button>
                  </EmptyContent>
               </Empty>
            </DataTableEmptyState>
         </div>
      </DataTableRoot>
   );
}
