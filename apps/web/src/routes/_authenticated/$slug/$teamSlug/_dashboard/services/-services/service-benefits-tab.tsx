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
   getCoreRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
   type SortingState,
} from "@tanstack/react-table";
import { Plus, Sparkles } from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/components/sonner";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableContainer } from "@/blocks/data-table/data-table-container";
import { DataTableEmptyState } from "@/blocks/data-table/data-table-empty-state";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTableRoot } from "@/blocks/data-table/data-table-root";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useContextPanelInfo } from "../../../-context-panel/use-context-panel";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import { BenefitAttachPopover } from "./benefit-attach-popover";
import { ServiceBenefitCreateSheet } from "./service-benefit-create-sheet";
import { ServiceMarginPanel } from "./service-margin-panel";
import { ServiceTabToolbar } from "./service-tab-toolbar";
import { useCreateMeterFromName } from "./use-create-meter";
import {
   buildBenefitColumns,
   type BenefitRow,
} from "../-benefits/build-benefit-columns";

export function ServiceBenefitsTab({ serviceId }: { serviceId: string }) {
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const [popoverOpen, setPopoverOpen] = useState(false);
   const layout = useDataTableLayout("service-benefits");

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

   const handleCreateNew = useCallback(() => {
      setPopoverOpen(false);
      openSheet({
         renderChildren: () => (
            <ServiceBenefitCreateSheet serviceId={serviceId} />
         ),
      });
   }, [openSheet, serviceId]);

   const linkedAsRows = useMemo<BenefitRow[]>(
      () =>
         linked.map((b) => ({
            ...b,
            usedInServices: 1,
         })),
      [linked],
   );

   const columns = useMemo<ColumnDef<BenefitRow>[]>(
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

   const [sorting, setSorting] = useState<SortingState>([]);

   const table = useReactTable({
      data: linkedAsRows,
      columns,
      getRowId: (r) => r.id,
      state: { sorting },
      onSortingChange: setSorting,
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
   });

   return (
      <DataTableRoot table={table}>
         <ServiceTabToolbar>
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
         <DataTableContainer>
            <DataTableHeader />
            <DataTableBody<BenefitRow> />
         </DataTableContainer>
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
