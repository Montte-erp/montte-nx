import { Button } from "@packages/ui/components/button";
import {
   DataTable,
   type DataTableStoredState,
} from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { z } from "zod";
import { Archive, History, Package, PackagePlus, Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/components/blocks/early-access-banner";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { InventoryHistorySheet } from "./-inventory/inventory-history-sheet";
import { InventoryMovementCredenza } from "./-inventory/inventory-movement-credenza";
import {
   buildInventoryProductColumns,
   type InventoryProductRow,
} from "./-inventory/inventory-product-columns";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const [useInventoryTableState, setInventoryTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:inventory",
      null,
   );

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
});

const INVENTORY_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Estoque",
   message: "Esta funcionalidade está em conceito.",
   ctaLabel: "Deixar feedback",
   stage: "concept",
   icon: Package,
   bullets: [
      "Cadastre produtos e controle o estoque",
      "Registre entradas e saídas de movimentação",
      "Seu feedback nos ajuda a melhorar",
   ],
};

const skeletonColumns = buildInventoryProductColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/inventory/",
)({
   validateSearch: searchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.inventory.getProducts.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: InventorySkeleton,
   head: () => ({
      meta: [{ title: "Estoque — Montte" }],
   }),
   component: InventoryPage,
});

function InventorySkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function InventoryList() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters } = Route.useSearch();
   const [tableState] = useInventoryTableState();

   const { data: products } = useSuspenseQuery(
      orpc.inventory.getProducts.queryOptions({}),
   );

   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const archiveMutation = useMutation(
      orpc.inventory.archiveProduct.mutationOptions({
         onSuccess: () => toast.success("Produto arquivado."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleMovement = useCallback(
      (product: InventoryProductRow) => {
         openCredenza({
            renderChildren: () => (
               <InventoryMovementCredenza
                  onSuccess={closeCredenza}
                  product={product}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleHistory = useCallback(
      (product: InventoryProductRow) => {
         openCredenza({
            renderChildren: () => <InventoryHistorySheet product={product} />,
         });
      },
      [openCredenza],
   );

   const handleArchive = useCallback(
      (product: InventoryProductRow) => {
         openAlertDialog({
            title: "Arquivar produto?",
            description: `"${product.name}" será arquivado e ficará oculto da lista.`,
            onAction: () => archiveMutation.mutate({ id: product.id }),
         });
      },
      [openAlertDialog, archiveMutation],
   );

   const columns = useMemo(() => buildInventoryProductColumns(), []);

   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-end">
            <Button size="icon-sm" tooltip="Novo Produto" variant="outline">
               <Plus />
            </Button>
         </div>
         {products.length === 0 ? (
            <Empty>
               <EmptyMedia>
                  <Package className="size-10" />
               </EmptyMedia>
               <EmptyHeader>
                  <EmptyTitle>Nenhum produto cadastrado</EmptyTitle>
                  <EmptyDescription>
                     Adicione produtos para começar a controlar o estoque.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         ) : (
            <DataTable
               columns={columns}
               data={products}
               getRowId={(row) => row.id}
               sorting={sorting}
               onSortingChange={(updater) => {
                  const next =
                     typeof updater === "function" ? updater(sorting) : updater;
                  navigate({
                     search: (prev) => ({ ...prev, sorting: next }),
                     replace: true,
                  });
               }}
               columnFilters={columnFilters}
               onColumnFiltersChange={(updater) => {
                  const next =
                     typeof updater === "function"
                        ? updater(columnFilters)
                        : updater;
                  navigate({
                     search: (prev) => ({ ...prev, columnFilters: next }),
                     replace: true,
                  });
               }}
               tableState={tableState}
               onTableStateChange={setInventoryTableState}
               renderActions={({ row }) => (
                  <div className="flex items-center gap-2">
                     <Button
                        onClick={() => handleMovement(row.original)}
                        variant="outline"
                     >
                        <PackagePlus className="size-3.5" />
                        Movimento
                     </Button>
                     <Button
                        onClick={() => handleHistory(row.original)}
                        size="icon"
                        variant="ghost"
                     >
                        <History className="size-4" />
                        <span className="sr-only">Ver histórico</span>
                     </Button>
                     <Button
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleArchive(row.original)}
                        size="icon"
                        variant="ghost"
                     >
                        <Archive className="size-4" />
                        <span className="sr-only">Arquivar</span>
                     </Button>
                  </div>
               )}
            />
         )}
      </div>
   );
}

function InventoryPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Controle de estoque e movimentações"
            title="Estoque"
         />
         <EarlyAccessBanner template={INVENTORY_BANNER} />
         <QueryBoundary
            fallback={<InventorySkeleton />}
            errorTitle="Erro ao carregar estoque"
         >
            <InventoryList />
         </QueryBoundary>
      </main>
   );
}
