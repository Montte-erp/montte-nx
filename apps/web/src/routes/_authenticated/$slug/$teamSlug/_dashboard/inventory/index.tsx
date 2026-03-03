import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, LayoutList, Package, Plus } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { InventoryHistorySheet } from "@/features/inventory/ui/inventory-history-sheet";
import { InventoryMovementCredenza } from "@/features/inventory/ui/inventory-movement-credenza";
import { InventoryProductCard } from "@/features/inventory/ui/inventory-product-card";
import {
   buildInventoryProductColumns,
   type InventoryProductRow,
} from "@/features/inventory/ui/inventory-product-columns";
import { InventoryProductForm } from "@/features/inventory/ui/inventory-product-form";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/inventory/",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.inventory.getProducts.queryOptions({}),
      );
   },
   component: InventoryPage,
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

const INVENTORY_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

// =============================================================================
// Skeleton
// =============================================================================

function InventorySkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton className="h-12 w-full" key={`skel-${i + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

function InventoryList({ view }: { view: "table" | "card" }) {
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
            children: (
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
            children: <InventoryHistorySheet product={product} />,
         });
      },
      [openCredenza],
   );

   const handleEdit = useCallback(
      (product: InventoryProductRow) => {
         openCredenza({
            children: (
               <InventoryProductForm
                  defaultValues={{
                     id: product.id,
                     name: product.name,
                     description: product.description,
                     baseUnit: product.baseUnit,
                     purchaseUnit: product.purchaseUnit,
                     purchaseUnitFactor: "1",
                     sellingPrice: product.sellingPrice,
                  }}
                  mode="edit"
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
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

   if (!products.length) {
      return (
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
      );
   }

   if (view === "card") {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
               <InventoryProductCard
                  key={product.id}
                  onRegisterMovement={handleMovement}
                  onViewHistory={handleHistory}
                  product={product as InventoryProductRow}
               />
            ))}
         </div>
      );
   }

   const columns = buildInventoryProductColumns(
      handleMovement,
      handleHistory,
      handleEdit,
      handleArchive,
   );

   return (
      <DataTable columns={columns} data={products as InventoryProductRow[]} />
   );
}

// =============================================================================
// Page
// =============================================================================

function InventoryPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "inventory:products:view",
      INVENTORY_VIEWS,
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         children: (
            <InventoryProductForm mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4 mr-1" />
                  Novo Produto
               </Button>
            }
            description="Controle de estoque e movimentações"
            title="Estoque"
            viewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
         />
         <EarlyAccessBanner template={INVENTORY_BANNER} />
         <Suspense fallback={<InventorySkeleton />}>
            <InventoryList view={currentView} />
         </Suspense>
      </main>
   );
}
