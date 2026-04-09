import { Button } from "@packages/ui/components/button";
import {
   DataTable,
   type DataTableStoredState,
} from "@packages/ui/components/data-table";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { z } from "zod";
import {
   Archive,
   History,
   MoreHorizontal,
   Package,
   PackagePlus,
   Pencil,
   Plus,
} from "lucide-react";
import { Suspense, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { InventoryHistorySheet } from "./-inventory/inventory-history-sheet";
import { InventoryMovementDialogStack } from "./-inventory/inventory-movement-dialog-stack";
import {
   buildInventoryProductColumns,
   type InventoryProductRow,
} from "./-inventory/inventory-product-columns";
import { InventoryProductForm } from "./-inventory/inventory-product-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .optional()
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .optional()
      .default([]),
});

const [useInventoryTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:inventory",
      null,
   );

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

function InventoryList() {
   const navigate = Route.useNavigate();
   const { sorting, columnFilters } = Route.useSearch();
   const [tableState, setTableState] = useInventoryTableState();

   const { data: products } = useSuspenseQuery(
      orpc.inventory.getProducts.queryOptions({}),
   );

   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function" ? updater(sorting) : updater;
         navigate({
            search: (prev: z.infer<typeof searchSchema>) => ({
               ...prev,
               sorting: next,
            }),
            replace: true,
         });
      },
      [navigate, sorting],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function" ? updater(columnFilters) : updater;
            navigate({
               search: (prev: z.infer<typeof searchSchema>) => ({
                  ...prev,
                  columnFilters: next,
               }),
               replace: true,
            });
         },
         [navigate, columnFilters],
      );

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
               <InventoryMovementDialogStack
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

   const columns = useMemo(() => buildInventoryProductColumns(), []);

   return (
      <DataTable
         columns={columns}
         data={products}
         getRowId={(row) => row.id}
         sorting={sorting}
         onSortingChange={handleSortingChange}
         columnFilters={columnFilters}
         onColumnFiltersChange={handleColumnFiltersChange}
         tableState={tableState}
         onTableStateChange={setTableState}
         renderActions={({ row }) => (
            <>
               <Button
                  onClick={() => handleMovement(row.original)}
                  variant="outline"
               >
                  <PackagePlus className="size-3.5 mr-1" />
                  Movimento
               </Button>
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="outline">
                        <MoreHorizontal className="size-4" />
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     <DropdownMenuItem
                        onClick={() => handleHistory(row.original)}
                     >
                        <History className="size-4" />
                        Ver histórico
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={() => handleEdit(row.original)}>
                        <Pencil className="size-4" />
                        Editar
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleArchive(row.original)}
                     >
                        <Archive className="size-4" />
                        Arquivar
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            </>
         )}
      />
   );
}

// =============================================================================
// Page
// =============================================================================

function InventoryPage() {
   const { openCredenza, closeCredenza } = useCredenza();

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
         />
         <EarlyAccessBanner template={INVENTORY_BANNER} />
         <Suspense fallback={<InventorySkeleton />}>
            <InventoryList />
         </Suspense>
      </main>
   );
}
