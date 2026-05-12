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
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";
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
   PauseCircle,
   Plus,
   Tag,
   TrendingDown,
   TrendingUp,
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
import { PageFilters } from "@/components/page-filters/page-filters";
import { PageFilter } from "@/components/page-filters/page-filter";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import { DefaultHeader } from "../../-layout/default-header";
import { requestTour } from "./-tour/store";
import { TourHelpButton } from "./-tour/tour-help-button";
import {
   buildCouponColumns,
   type CouponRow,
} from "./-coupons/build-coupon-columns";
import { CouponFormSheet } from "./-coupons/coupon-form-sheet";

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
   direction: z.enum(["discount", "surcharge"]).optional().catch(undefined),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/services/coupons",
)({
   validateSearch: searchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.coupons.list.queryOptions());
      context.queryClient.prefetchQuery(orpc.meters.getMeters.queryOptions({}));
   },
   onEnter: () => {
      requestTour("coupons-intro");
   },
   pendingMs: 300,
   pendingComponent: () => (
      <main className="flex h-full flex-col gap-4">
         <DataTableSkeleton columns={[]} />
      </main>
   ),
   head: () => ({ meta: [{ title: "Cupons — Montte" }] }),
   component: CouponsPage,
});

function CouponsPage() {
   return (
      <main className="flex h-full flex-col gap-4">
         <div id="tour-coupons-header">
            <DefaultHeader
               actions={<TourHelpButton tourId="coupons-intro" />}
               description="Cupons aplicam descontos ou acréscimos automáticos sobre preços."
               title="Cupons"
            />
         </div>
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               errorTitle="Erro ao carregar cupons"
               fallback={<DataTableSkeleton columns={[]} />}
            >
               <CouponsList />
            </QueryBoundary>
         </div>
      </main>
   );
}

function CouponsList() {
   const navigate = useNavigate({ from: Route.fullPath });
   const search = Route.useSearch();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const layout = useDataTableLayout("coupons");

   const [{ data: coupons }, { data: meters }] = useSuspenseQueries({
      queries: [
         orpc.coupons.list.queryOptions(),
         orpc.meters.getMeters.queryOptions({}),
      ],
   });

   const meterOptions = useMemo(
      () => meters.map((m) => ({ value: m.id, label: m.name })),
      [meters],
   );

   const filtered = useMemo(() => {
      const q = search.search.trim().toLowerCase();
      let rows = coupons;
      if (q) rows = rows.filter((c) => c.code.toLowerCase().includes(q));
      if (search.isActive !== undefined)
         rows = rows.filter((c) => c.isActive === search.isActive);
      if (search.direction)
         rows = rows.filter((c) => c.direction === search.direction);
      return rows;
   }, [coupons, search.search, search.isActive, search.direction]);

   const updateMutation = useMutation(
      orpc.coupons.update.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const createMutation = useMutation(
      orpc.coupons.create.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const deactivateMutation = useMutation(
      orpc.coupons.deactivate.mutationOptions({
         onSuccess: () => toast.success("Cupom desativado."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const bulkSetActiveMutation = useMutation(
      orpc.coupons.bulkSetActive.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleSaveCell = useCallback(
      async (
         rowId: string,
         field:
            | "code"
            | "direction"
            | "trigger"
            | "scope"
            | "meterId"
            | "type"
            | "amount"
            | "duration"
            | "durationMonths"
            | "maxUses"
            | "redeemBy"
            | "isActive",
         value: unknown,
      ) => {
         await updateMutation.mutateAsync({ id: rowId, [field]: value });
      },
      [updateMutation],
   );

   const handleOpenCreate = useCallback(() => {
      openSheet({ renderChildren: () => <CouponFormSheet /> });
   }, [openSheet]);

   const handleDuplicate = useCallback(
      async (coupon: CouponRow) => {
         const existing = new Set(coupons.map((c) => c.code.toLowerCase()));
         let suffix = 1;
         let code = `${coupon.code}-COPY`;
         while (existing.has(code.toLowerCase())) {
            suffix += 1;
            code = `${coupon.code}-COPY-${suffix}`;
         }
         await createMutation.mutateAsync({
            code,
            direction: coupon.direction,
            trigger: coupon.trigger,
            scope: coupon.scope,
            priceId: coupon.priceId,
            meterId: coupon.meterId,
            type: coupon.type,
            amount: coupon.amount,
            duration: coupon.duration,
            durationMonths: coupon.durationMonths,
            maxUses: coupon.maxUses,
            redeemBy: coupon.redeemBy ? coupon.redeemBy.toISOString() : null,
            conditions: coupon.conditions,
         });
         toast.success("Cupom duplicado.");
      },
      [coupons, createMutation],
   );

   const handleDelete = useCallback(
      (coupon: CouponRow) => {
         openAlertDialog({
            title: "Desativar cupom",
            description: `Desativar "${coupon.code}"? Não será mais aplicado.`,
            actionLabel: "Desativar",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deactivateMutation.mutateAsync({ id: coupon.id });
            },
         });
      },
      [openAlertDialog, deactivateMutation],
   );

   const columns = useMemo<ColumnDef<CouponRow>[]>(() => {
      const base = buildCouponColumns({
         meterOptions,
         onSaveCell: handleSaveCell,
      });
      const selectColumn: ColumnDef<CouponRow> = {
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
      const actionsColumn: ColumnDef<CouponRow> = {
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
                  tooltip="Desativar"
                  variant="ghost"
               >
                  <XCircle />
                  <span className="sr-only">Desativar</span>
               </Button>
            </div>
         ),
      };
      return [selectColumn, ...base, actionsColumn];
   }, [meterOptions, handleSaveCell, handleDuplicate, handleDelete]);

   const [sorting, setSorting] = useState<SortingState>(search.sorting);
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
      search.columnFilters,
   );
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const table = useReactTable({
      data: filtered,
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
                  placeholder="Buscar cupom..."
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
                        active={search.direction === "discount"}
                        group="Tipo"
                        icon={<TrendingDown className="size-4" />}
                        id="onlyDiscount"
                        label="Somente descontos"
                        onToggle={(active) =>
                           navigate({
                              search: (s) => ({
                                 ...s,
                                 direction: active ? "discount" : undefined,
                              }),
                              replace: true,
                           })
                        }
                     />
                     <PageFilter
                        active={search.direction === "surcharge"}
                        group="Tipo"
                        icon={<TrendingUp className="size-4" />}
                        id="onlySurcharge"
                        label="Somente acréscimos"
                        onToggle={(active) =>
                           navigate({
                              search: (s) => ({
                                 ...s,
                                 direction: active ? "surcharge" : undefined,
                              }),
                              replace: true,
                           })
                        }
                     />
                  </PageFilters>
                  <DataTableColumnVisibility />
                  <Button
                     id="tour-coupons-create"
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Novo cupom"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo cupom</span>
                  </Button>
               </DataTableToolbarGroup>
            </DataTableToolbar>
            <DataTableContainer>
               <DataTableHeader />
               <DataTableBody<CouponRow> />
            </DataTableContainer>
            <DataTableBulkActionBar<CouponRow>>
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
                                    `${res.updated} cupom(s) ativado(s).`,
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
                                    `${res.updated} cupom(s) desativado(s).`,
                                 );
                              clear();
                           }}
                        >
                           Desativar
                        </SelectionActionButton>
                     </>
                  );
               }}
            </DataTableBulkActionBar>
            <DataTableEmptyState>
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Tag className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum cupom</EmptyTitle>
                     <EmptyDescription>
                        Cupons aplicam desconto ou acréscimo automático. Para
                        escopo medidor, crie um{" "}
                        <Link
                           className="underline underline-offset-2"
                           params={{ slug, teamSlug }}
                           to="/$slug/$teamSlug/services/meters"
                        >
                           medidor
                        </Link>{" "}
                        antes.
                     </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                     <Button onClick={handleOpenCreate}>
                        <Plus />
                        Novo cupom
                     </Button>
                  </EmptyContent>
               </Empty>
            </DataTableEmptyState>
         </div>
      </DataTableRoot>
   );
}
