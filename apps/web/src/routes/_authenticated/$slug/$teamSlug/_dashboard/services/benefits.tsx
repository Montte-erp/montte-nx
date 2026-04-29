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
   formatCostBRL,
   summarizeByType,
   totalCostPerCycle,
   type BenefitForAggregate,
} from "@modules/billing/services/benefits-aggregates";
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
import { QueryBoundary } from "@/components/query-boundary";
import { useContextPanelInfo } from "@/features/context-panel/use-context-panel";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import {
   buildBenefitColumns,
   type BenefitRow,
} from "./-benefits/build-benefit-columns";
import { BenefitsAnalytics } from "./-benefits/benefits-analytics";
import {
   BENEFIT_TYPE_ICON,
   BENEFIT_TYPE_LABEL,
   type BenefitTypeKey,
} from "./-benefits/labels";
import { useCreateMeterFromName } from "./-services/use-create-meter";

const searchSchema = z.object({
   search: z.string().catch("").default(""),
   add: z.boolean().catch(false).default(false),
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
         <DefaultHeader
            description="Benefícios podem ser linkados a múltiplos serviços e impactam o custo efetivo."
            title="Benefícios"
         />
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
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

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
         onSuccess: () => {
            toast.success("Benefício criado.");
            navigate({ search: (s) => ({ ...s, add: false }), replace: true });
         },
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

   const handleAdd = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         if (!name) {
            toast.error("Nome é obrigatório.");
            return;
         }
         const type = String(data.type ?? "credits") as BenefitTypeKey;
         const creditAmountStr = String(data.creditAmount ?? "");
         const creditAmount =
            type === "credits" && creditAmountStr
               ? Number.parseInt(creditAmountStr, 10)
               : null;
         const unitCostStr = String(data.unitCost ?? "0");
         const unitCost = Number.isFinite(Number(unitCostStr))
            ? Number(unitCostStr).toFixed(4)
            : "0";
         await createMutation.mutateAsync({
            name,
            type,
            creditAmount,
            meterId:
               typeof data.meterId === "string" && data.meterId
                  ? data.meterId
                  : null,
            rollover: data.rollover === "true",
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

   const columns = useMemo(
      () =>
         buildBenefitColumns({
            meterOptions,
            onSaveCell: handleSaveCell,
            onCreateMeter: handleCreateMeter,
            includeUsedInServices: true,
         }),
      [meterOptions, handleSaveCell, handleCreateMeter],
   );

   const renderActions = useCallback(
      ({ row }: { row: { original: BenefitRow } }) => (
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
               tooltip="Excluir"
               variant="ghost"
            >
               <span className="sr-only">Excluir</span>×
            </Button>
         </div>
      ),
      [handleDuplicate, handleDelete],
   );

   const groupBy = useCallback(
      (row: BenefitRow) => (row.isActive ? row.type : "__inactive__"),
      [],
   );

   const renderGroupHeader = useCallback(
      (key: string, rows: { original: BenefitRow }[]) => {
         if (key === "__inactive__") {
            return (
               <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <PauseCircle className="size-4" />
                  <span className="font-semibold">Pausados</span>
                  <span>· {rows.length}</span>
               </span>
            );
         }
         const type = key as BenefitTypeKey;
         const Icon = BENEFIT_TYPE_ICON[type];
         const aggregates: BenefitForAggregate[] = rows.map((r) => ({
            id: r.original.id,
            name: r.original.name,
            type: r.original.type,
            creditAmount: r.original.creditAmount,
            unitCost: r.original.unitCost,
            isActive: r.original.isActive,
            usedInServices: r.original.usedInServices,
         }));
         const summary = summarizeByType(aggregates)[0];
         const total = totalCostPerCycle(aggregates);
         return (
            <span className="inline-flex items-center gap-2">
               <Icon className="size-4" />
               <span className="font-semibold">{BENEFIT_TYPE_LABEL[type]}</span>
               <span className="text-muted-foreground">
                  · {summary?.activeCount ?? 0} ativos · {formatCostBRL(total)}
                  /ciclo
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
         data={benefits}
         getRowId={(r) => r.id}
         groupBy={groupBy}
         renderGroupHeader={renderGroupHeader}
         renderActions={renderActions}
         isDraftRowActive={search.add}
         onAddRow={handleAdd}
         onDiscardAddRow={() =>
            navigate({ search: (s) => ({ ...s, add: false }), replace: true })
         }
         storageKey="montte:datatable:benefits"
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
            label="Em uso por algum serviço"
            group="Uso"
            active={search.onlyInUse}
            renderIcon={() => <Sparkles className="size-4" />}
            onToggle={(active) =>
               navigate({
                  search: (s) => ({ ...s, onlyInUse: active }),
                  replace: true,
               })
            }
         />
         <div className="flex flex-col gap-4">
            <DataTableToolbar
               searchPlaceholder="Buscar benefício..."
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
                  onClick={() =>
                     navigate({
                        search: (s) => ({ ...s, add: true }),
                        replace: true,
                     })
                  }
                  size="icon-sm"
                  tooltip="Novo benefício"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo benefício</span>
               </Button>
            </DataTableToolbar>
            <DataTableContent />
            <DataTableBulkActions<BenefitRow>>
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
                                    `${res.updated} benefício(s) ativado(s).`,
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
                                    `${res.updated} benefício(s) desativado(s).`,
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
                     <Button
                        onClick={() =>
                           navigate({
                              search: (s) => ({ ...s, add: true }),
                              replace: true,
                           })
                        }
                     >
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
