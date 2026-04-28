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
   useSuspenseQueries,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import {
   buildCouponColumns,
   type CouponRow,
} from "./-coupons/build-coupon-columns";
import {
   DIRECTION_LABEL,
   type CouponDirection,
   type CouponDuration,
   type CouponScope,
   type CouponTrigger,
   type CouponType,
} from "./-coupons/labels";

const searchSchema = z.object({
   search: z.string().catch("").default(""),
   add: z.boolean().catch(false).default(false),
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
         <DefaultHeader
            description="Cupons aplicam descontos ou acréscimos automáticos sobre preços."
            title="Cupons"
         />
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
   const queryClient = useQueryClient();
   const { openAlertDialog } = useAlertDialog();

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

   const couponsKey = orpc.coupons.list.queryKey();

   const updateMutation = useMutation(
      orpc.coupons.update.mutationOptions({
         meta: { skipGlobalInvalidation: true },
         onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: couponsKey });
            const prev = queryClient.getQueryData<CouponRow[]>(couponsKey);
            if (prev) {
               const { redeemBy, ...rest } = vars;
               const patch: Partial<CouponRow> = {
                  ...rest,
                  ...(redeemBy !== undefined
                     ? { redeemBy: redeemBy ? new Date(redeemBy) : null }
                     : {}),
               };
               queryClient.setQueryData<CouponRow[]>(
                  couponsKey,
                  prev.map((c) => (c.id === vars.id ? { ...c, ...patch } : c)),
               );
            }
            return { prev };
         },
         onError: (e, _v, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(couponsKey, ctx.prev);
            toast.error(e.message);
         },
         onSettled: () =>
            queryClient.invalidateQueries({ queryKey: couponsKey }),
      }),
   );

   const createMutation = useMutation(
      orpc.coupons.create.mutationOptions({
         onSuccess: () => {
            toast.success("Cupom criado.");
            navigate({ search: (s) => ({ ...s, add: false }), replace: true });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const deactivateMutation = useMutation(
      orpc.coupons.deactivate.mutationOptions({
         onSuccess: () => toast.success("Cupom desativado."),
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

   const handleAdd = useCallback(
      async (data: Record<string, string | string[]>) => {
         const code = String(data.code ?? "").trim();
         if (!code) {
            toast.error("Código é obrigatório.");
            return;
         }
         const direction = (String(data.direction ?? "discount") ||
            "discount") as CouponDirection;
         const trigger = (String(data.trigger ?? "code") ||
            "code") as CouponTrigger;
         const scope = (String(data.scope ?? "team") || "team") as CouponScope;
         const type = (String(data.type ?? "percent") ||
            "percent") as CouponType;
         const duration = (String(data.duration ?? "once") ||
            "once") as CouponDuration;
         const amountStr = String(data.amount ?? "0");
         const amount = Number.isFinite(Number(amountStr))
            ? Number(amountStr).toFixed(4)
            : "0";
         const meterId =
            scope === "meter" &&
            typeof data.meterId === "string" &&
            data.meterId
               ? data.meterId
               : null;
         const durationMonthsStr = String(data.durationMonths ?? "");
         const durationMonths =
            duration === "repeating" && durationMonthsStr
               ? Number.parseInt(durationMonthsStr, 10)
               : null;
         const maxUsesStr = String(data.maxUses ?? "");
         const maxUses = maxUsesStr ? Number.parseInt(maxUsesStr, 10) : null;
         await createMutation.mutateAsync({
            code,
            direction,
            trigger,
            scope,
            meterId,
            type,
            amount,
            duration,
            durationMonths,
            maxUses,
         });
      },
      [createMutation],
   );

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

   const columns = useMemo(
      () =>
         buildCouponColumns({
            meterOptions,
            onSaveCell: handleSaveCell,
         }),
      [meterOptions, handleSaveCell],
   );

   const renderActions = useCallback(
      ({ row }: { row: { original: CouponRow } }) => (
         <div className="flex items-center gap-2">
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
               <span className="sr-only">Desativar</span>×
            </Button>
         </div>
      ),
      [handleDuplicate, handleDelete],
   );

   const groupBy = useCallback(
      (row: CouponRow) => (row.isActive ? row.direction : "__inactive__"),
      [],
   );

   const renderGroupHeader = useCallback(
      (key: string, rows: { original: CouponRow }[]) => {
         if (key === "__inactive__") {
            return (
               <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <PauseCircle className="size-4" />
                  <span className="font-semibold">Pausados</span>
                  <span>· {rows.length}</span>
               </span>
            );
         }
         const dir = key as CouponDirection;
         const Icon = dir === "discount" ? TrendingDown : TrendingUp;
         return (
            <span className="inline-flex items-center gap-2">
               <Icon className="size-4" />
               <span className="font-semibold">{DIRECTION_LABEL[dir]}</span>
               <span className="text-muted-foreground">· {rows.length}</span>
            </span>
         );
      },
      [],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={filtered}
         getRowId={(r) => r.id}
         groupBy={groupBy}
         renderGroupHeader={renderGroupHeader}
         renderActions={renderActions}
         isDraftRowActive={search.add}
         onAddRow={handleAdd}
         onDiscardAddRow={() =>
            navigate({ search: (s) => ({ ...s, add: false }), replace: true })
         }
         storageKey="montte:datatable:coupons"
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
            id="onlyDiscount"
            label="Somente descontos"
            group="Tipo"
            active={search.direction === "discount"}
            renderIcon={() => <TrendingDown className="size-4" />}
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
         <DataTableExternalFilter
            id="onlySurcharge"
            label="Somente acréscimos"
            group="Tipo"
            active={search.direction === "surcharge"}
            renderIcon={() => <TrendingUp className="size-4" />}
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
         <div className="flex flex-col gap-4">
            <DataTableToolbar
               searchPlaceholder="Buscar cupom..."
               searchDefaultValue={search.search}
               onSearch={(v) =>
                  navigate({
                     search: (s) => ({ ...s, search: v }),
                     replace: true,
                  })
               }
            >
               <Button
                  onClick={() =>
                     navigate({
                        search: (s) => ({ ...s, add: true }),
                        replace: true,
                     })
                  }
                  size="icon-sm"
                  tooltip="Novo cupom"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo cupom</span>
               </Button>
            </DataTableToolbar>
            <DataTableContent />
            <DataTableBulkActions<CouponRow>>
               {({ selectedRows, clearSelection }) => {
                  const ids = selectedRows.map((r) => r.id);
                  return (
                     <>
                        <SelectionActionButton
                           icon={<CheckCircle2 />}
                           onClick={async () => {
                              await Promise.allSettled(
                                 ids.map((id) =>
                                    updateMutation.mutateAsync({
                                       id,
                                       isActive: true,
                                    }),
                                 ),
                              );
                              toast.success(
                                 `${ids.length} cupom(s) ativado(s).`,
                              );
                              clearSelection();
                           }}
                        >
                           Ativar
                        </SelectionActionButton>
                        <SelectionActionButton
                           icon={<XCircle />}
                           onClick={async () => {
                              await Promise.allSettled(
                                 ids.map((id) =>
                                    deactivateMutation.mutateAsync({ id }),
                                 ),
                              );
                              toast.success(
                                 `${ids.length} cupom(s) desativado(s).`,
                              );
                              clearSelection();
                           }}
                        >
                           Desativar
                        </SelectionActionButton>
                     </>
                  );
               }}
            </DataTableBulkActions>
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
                     <Button
                        onClick={() =>
                           navigate({
                              search: (s) => ({ ...s, add: true }),
                              replace: true,
                           })
                        }
                     >
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
