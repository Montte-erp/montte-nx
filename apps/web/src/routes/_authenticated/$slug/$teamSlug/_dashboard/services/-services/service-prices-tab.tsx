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
import { CircleDollarSign, Copy, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import {
   buildPriceColumns,
   PRICING_TYPE_LABEL,
   type PriceField,
   type ServicePrice,
} from "./service-prices-columns";
import { ServiceTabToolbar } from "./service-tab-toolbar";

export function ServicePricesTab({ serviceId }: { serviceId: string }) {
   const { openAlertDialog } = useAlertDialog();
   const queryClient = useQueryClient();
   const [isDraftActive, setIsDraftActive] = useState(false);

   const variantsKey = orpc.services.getVariants.queryKey({
      input: { serviceId },
   });

   const [{ data: prices }, { data: meters }] = useSuspenseQueries({
      queries: [
         orpc.services.getVariants.queryOptions({ input: { serviceId } }),
         orpc.meters.getMeters.queryOptions({}),
      ],
   });

   const updateMutation = useMutation(
      orpc.services.updateVariant.mutationOptions({
         meta: { skipGlobalInvalidation: true },
         onMutate: async (vars) => {
            await queryClient.cancelQueries({ queryKey: variantsKey });
            const prev = queryClient.getQueryData<ServicePrice[]>(variantsKey);
            if (prev) {
               queryClient.setQueryData<ServicePrice[]>(
                  variantsKey,
                  prev.map((p) => (p.id === vars.id ? { ...p, ...vars } : p)),
               );
            }
            return { prev };
         },
         onError: (e, _v, ctx) => {
            if (ctx?.prev) queryClient.setQueryData(variantsKey, ctx.prev);
            toast.error(e.message);
         },
         onSettled: () =>
            queryClient.invalidateQueries({ queryKey: variantsKey }),
      }),
   );

   const createMutation = useMutation(
      orpc.services.createVariant.mutationOptions({
         onSuccess: () => {
            toast.success("Preço criado.");
            setIsDraftActive(false);
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.services.removeVariant.mutationOptions({
         onSuccess: () => toast.success("Preço excluído."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleSaveCell = useCallback(
      async (rowId: string, field: PriceField, value: unknown) => {
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
         await createMutation.mutateAsync({
            serviceId,
            name,
            type: "flat",
            basePrice: "0",
            interval: "monthly",
            autoEnroll: false,
         });
      },
      [createMutation, serviceId],
   );

   const handleDuplicate = useCallback(
      async (price: ServicePrice) => {
         await createMutation.mutateAsync({
            serviceId,
            name: `${price.name} (cópia)`,
            type: price.type,
            basePrice: price.basePrice,
            interval: price.interval,
            meterId: price.meterId,
            minPrice: price.minPrice,
            priceCap: price.priceCap,
            trialDays: price.trialDays,
            autoEnroll: price.autoEnroll,
         });
      },
      [createMutation, serviceId],
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
      () => buildPriceColumns({ meters, onSaveCell: handleSaveCell }),
      [meters, handleSaveCell],
   );

   const groupBy = useCallback(
      (row: ServicePrice) => PRICING_TYPE_LABEL[row.type],
      [],
   );

   const renderActions = useCallback(
      ({ row }: { row: { original: ServicePrice } }) => (
         <>
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
         </>
      ),
      [handleDuplicate, handleDelete],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={prices}
         getRowId={(r) => r.id}
         groupBy={groupBy}
         renderActions={renderActions}
         isDraftRowActive={isDraftActive}
         onAddRow={handleAdd}
         onDiscardAddRow={() => setIsDraftActive(false)}
         storageKey="montte:datatable:service-prices"
      >
         <div className="flex flex-col gap-4">
            <ServiceTabToolbar
               serviceId={serviceId}
               searchPlaceholder="Buscar preço..."
            >
               <Button
                  onClick={() => setIsDraftActive(true)}
                  size="icon-sm"
                  tooltip="Novo preço"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo preço</span>
               </Button>
            </ServiceTabToolbar>
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
                  <EmptyContent>
                     <Button onClick={() => setIsDraftActive(true)}>
                        <Plus />
                        Novo preço
                     </Button>
                  </EmptyContent>
               </Empty>
            </DataTableEmptyState>
         </div>
      </DataTableRoot>
   );
}
