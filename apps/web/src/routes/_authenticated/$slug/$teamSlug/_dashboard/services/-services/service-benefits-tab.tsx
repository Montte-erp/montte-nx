import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";
import {
   formatCostBRL,
   summarizeByType,
   totalCostPerCycle,
   type BenefitForAggregate,
} from "@modules/billing/services/benefits-aggregates";
import { PauseCircle, Plus, Sparkles } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/components/sonner";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { useContextPanelInfo } from "@/features/context-panel/use-context-panel";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import { BenefitAttachPopover } from "./benefit-attach-popover";
import { ServiceMarginPanel } from "./service-margin-panel";
import { ServiceTabToolbar } from "./service-tab-toolbar";
import { useCreateMeterFromName } from "./use-create-meter";
import {
   buildBenefitColumns,
   type BenefitRow,
} from "../-benefits/build-benefit-columns";
import {
   BENEFIT_TYPE_ICON,
   BENEFIT_TYPE_LABEL,
   type BenefitTypeKey,
} from "../-benefits/labels";

export function ServiceBenefitsTab({ serviceId }: { serviceId: string }) {
   const { openAlertDialog } = useAlertDialog();
   const [popoverOpen, setPopoverOpen] = useState(false);
   const [draftActive, setDraftActive] = useState(false);

   useContextPanelInfo(() => <ServiceMarginPanel serviceId={serviceId} />);

   const [{ data: linked }, { data: meters }] = useSuspenseQueries({
      queries: [
         orpc.benefits.getServiceBenefits.queryOptions({
            input: { serviceId },
         }),
         orpc.meters.getMeters.queryOptions({}),
      ],
   });

   const meterOptions = useMemo(
      () => meters.map((m) => ({ value: m.id, label: m.name })),
      [meters],
   );

   const attachedIds = useMemo(
      () => new Set(linked.map((b) => b.id)),
      [linked],
   );

   const detachMutation = useMutation(
      orpc.benefits.detachBenefit.mutationOptions({
         onSuccess: () => toast.success("Benefício desvinculado."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const updateMutation = useMutation(
      orpc.benefits.updateBenefitById.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const createAndAttachMutation = useMutation(
      orpc.benefits.createAndAttachBenefit.mutationOptions({
         onSuccess: () => {
            toast.success("Benefício criado e vinculado.");
            setDraftActive(false);
         },
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

   const handleDetach = useCallback(
      (benefit: BenefitRow) => {
         openAlertDialog({
            title: "Desvincular benefício",
            description: `Desvincular "${benefit.name}"? Assinantes ativos perdem acesso imediatamente.`,
            actionLabel: "Desvincular",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await detachMutation.mutateAsync({
                  serviceId,
                  benefitId: benefit.id,
               });
            },
         });
      },
      [openAlertDialog, detachMutation, serviceId],
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
         await createAndAttachMutation.mutateAsync({
            serviceId,
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
      [createAndAttachMutation, serviceId],
   );

   const handleCreateNew = useCallback(() => {
      setPopoverOpen(false);
      setDraftActive(true);
   }, []);

   const linkedAsRows = useMemo<BenefitRow[]>(
      () =>
         linked.map((b) => ({
            ...b,
            usedInServices: 1,
         })),
      [linked],
   );

   const columns = useMemo(
      () =>
         buildBenefitColumns({
            meterOptions,
            onSaveCell: handleSaveCell,
            onCreateMeter: handleCreateMeter,
            onDetach: handleDetach,
            includeUsedInServices: false,
            includeCostPerCycle: true,
         }),
      [meterOptions, handleSaveCell, handleCreateMeter, handleDetach],
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
            usedInServices: 1,
         }));
         const total = totalCostPerCycle(aggregates);
         const summary = summarizeByType(aggregates)[0];
         return (
            <span className="inline-flex items-center gap-2">
               <Icon className="size-4" />
               <span className="font-semibold">{BENEFIT_TYPE_LABEL[type]}</span>
               <span className="text-muted-foreground">
                  · {summary?.activeCount ?? 0} ativos · {formatCostBRL(total)}
                  /ciclo
               </span>
            </span>
         );
      },
      [],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={linkedAsRows}
         getRowId={(r) => r.id}
         groupBy={groupBy}
         renderGroupHeader={renderGroupHeader}
         isDraftRowActive={draftActive}
         onAddRow={handleAdd}
         onDiscardAddRow={() => setDraftActive(false)}
         storageKey="montte:datatable:service-benefits"
      >
         <ServiceTabToolbar searchPlaceholder="Buscar benefício...">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
               <PopoverTrigger asChild>
                  <Button
                     size="icon-sm"
                     tooltip="Vincular benefício"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Vincular benefício</span>
                  </Button>
               </PopoverTrigger>
               <PopoverContent align="end" className="w-80 p-0">
                  <Suspense fallback={null}>
                     <BenefitAttachPopover
                        serviceId={serviceId}
                        attachedIds={attachedIds}
                        onCreateNew={handleCreateNew}
                        onClose={() => setPopoverOpen(false)}
                     />
                  </Suspense>
               </PopoverContent>
            </Popover>
         </ServiceTabToolbar>
         <DataTableContent />
         <DataTableEmptyState>
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <Sparkles className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum benefício vinculado</EmptyTitle>
                  <EmptyDescription>
                     Vincule créditos, perks ou recursos para enriquecer o
                     serviço.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
      </DataTableRoot>
   );
}
