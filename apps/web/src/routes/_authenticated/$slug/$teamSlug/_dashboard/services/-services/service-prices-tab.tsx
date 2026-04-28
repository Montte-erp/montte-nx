import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { CircleDollarSign, Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";
import { PriceForm } from "./price-form";
import {
   buildPriceColumns,
   PRICING_TYPE_LABEL,
   type ServicePrice,
} from "./service-prices-columns";

export function ServicePricesTab({ serviceId }: { serviceId: string }) {
   const { openCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: prices } = useSuspenseQuery(
      orpc.services.getVariants.queryOptions({ input: { serviceId } }),
   );
   const { data: meters } = useSuspenseQuery(
      orpc.meters.getMeters.queryOptions({}),
   );

   const meterNameById = useMemo(
      () =>
         meters.reduce<Record<string, string>>((acc, m) => {
            acc[m.id] = m.name;
            return acc;
         }, {}),
      [meters],
   );

   const updateMutation = useMutation(
      orpc.services.updateVariant.mutationOptions({
         onSuccess: () => toast.success("Preço atualizado."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.services.removeVariant.mutationOptions({
         onSuccess: () => toast.success("Preço excluído."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         className: "sm:max-w-lg",
         renderChildren: () => <PriceForm serviceId={serviceId} />,
      });
   }, [openCredenza, serviceId]);

   const handleEdit = useCallback(
      (price: ServicePrice) => {
         openCredenza({
            className: "sm:max-w-lg",
            renderChildren: () => (
               <PriceForm serviceId={serviceId} existing={price} />
            ),
         });
      },
      [openCredenza, serviceId],
   );

   const handleDuplicate = useCallback(
      (price: ServicePrice) => {
         const copy: ServicePrice = {
            ...price,
            name: `${price.name} (cópia)`,
         };
         openCredenza({
            className: "sm:max-w-lg",
            renderChildren: () => (
               <PriceForm serviceId={serviceId} existing={copy} duplicate />
            ),
         });
      },
      [openCredenza, serviceId],
   );

   const handleToggle = useCallback(
      (price: ServicePrice) => {
         updateMutation.mutate({
            id: price.id,
            isActive: !price.isActive,
         });
      },
      [updateMutation],
   );

   const handleDelete = useCallback(
      (price: ServicePrice) => {
         openAlertDialog({
            title: "Excluir preço",
            description: `Excluir "${price.name}"? Assinaturas vinculadas impedirão a exclusão.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: price.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo(
      () =>
         buildPriceColumns({
            meterNameById,
            onEdit: handleEdit,
            onToggle: handleToggle,
            onDelete: handleDelete,
            onDuplicate: handleDuplicate,
         }),
      [meterNameById, handleEdit, handleToggle, handleDelete, handleDuplicate],
   );

   const groupBy = useCallback(
      (row: ServicePrice) => PRICING_TYPE_LABEL[row.type],
      [],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={prices}
         getRowId={(r) => r.id}
         groupBy={groupBy}
         storageKey="montte:datatable:service-prices"
      >
         <DataTableToolbar searchPlaceholder="Buscar preço..." hideExport>
            <Button
               onClick={handleCreate}
               size="icon-sm"
               tooltip="Novo preço"
               variant="outline"
            >
               <Plus />
               <span className="sr-only">Novo preço</span>
            </Button>
         </DataTableToolbar>
         <DataTableContent />
         <DataTableEmptyState>
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <CircleDollarSign className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum preço configurado</EmptyTitle>
                  <EmptyDescription>
                     Crie um preço para começar a cobrar pelo serviço.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
      </DataTableRoot>
   );
}
