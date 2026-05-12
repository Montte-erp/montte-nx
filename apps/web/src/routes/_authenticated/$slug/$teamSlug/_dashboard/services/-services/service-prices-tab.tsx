import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQueries } from "@tanstack/react-query";
import {
   getCoreRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
   type SortingState,
} from "@tanstack/react-table";
import { CircleDollarSign, Copy, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/components/sonner";
import { DataTableBody } from "@/components/data-table-v2/data-table-body";
import { DataTableContainer } from "@/components/data-table-v2/data-table-container";
import { DataTableEmptyState } from "@/components/data-table-v2/data-table-empty-state";
import { DataTableHeader } from "@/components/data-table-v2/data-table-header";
import { DataTableRoot } from "@/components/data-table-v2/data-table-root";
import { useDataTableLayout } from "@/components/data-table-v2/use-data-table-layout";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import {
   buildPriceColumns,
   type PriceField,
   type ServicePrice,
} from "./service-prices-columns";
import { ServicePriceFormSheet } from "./service-price-form-sheet";
import { ServiceTabToolbar } from "./service-tab-toolbar";

export function ServicePricesTab({ serviceId }: { serviceId: string }) {
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const layout = useDataTableLayout("service-prices");

   const [{ data: prices }, { data: meters }] = useSuspenseQueries({
      queries: [
         orpc.prices.list.queryOptions({ input: { serviceId } }),
         orpc.meters.getMeters.queryOptions({}),
      ],
   });

   const updateMutation = useMutation(
      orpc.prices.update.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const createMutation = useMutation(
      orpc.prices.create.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.prices.remove.mutationOptions({
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

   const handleOpenCreate = useCallback(() => {
      openSheet({
         renderChildren: () => <ServicePriceFormSheet serviceId={serviceId} />,
      });
   }, [openSheet, serviceId]);

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
         toast.success("Preço duplicado.");
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

   const columns = useMemo<ColumnDef<ServicePrice>[]>(() => {
      const base = buildPriceColumns({ meters, onSaveCell: handleSaveCell });
      const actionsColumn: ColumnDef<ServicePrice> = {
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
      return [...base, actionsColumn];
   }, [meters, handleSaveCell, handleDuplicate, handleDelete]);

   const [sorting, setSorting] = useState<SortingState>([]);

   const table = useReactTable({
      data: prices,
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
         <div className="flex flex-col gap-4">
            <ServiceTabToolbar>
               <Button
                  onClick={handleOpenCreate}
                  size="icon-sm"
                  tooltip="Novo preço"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo preço</span>
               </Button>
            </ServiceTabToolbar>
            <DataTableContainer>
               <DataTableHeader />
               <DataTableBody<ServicePrice> />
            </DataTableContainer>
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
                     <Button onClick={handleOpenCreate}>
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
