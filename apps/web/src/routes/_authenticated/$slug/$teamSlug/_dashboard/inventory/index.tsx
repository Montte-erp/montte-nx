import { Button } from "@packages/ui/components/button";
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
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
   Archive,
   History,
   MoreHorizontal,
   Package,
   PackagePlus,
   Plus,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { InventoryHistorySheet } from "./-inventory/inventory-history-sheet";
import { InventoryMovementCredenza } from "./-inventory/inventory-movement-credenza";
import {
   buildInventoryProductColumns,
   type InventoryProductRow,
} from "./-inventory/inventory-product-columns";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

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

   const createMutation = useMutation(
      orpc.inventory.createProduct.mutationOptions({
         onSuccess: () => toast.success("Produto criado com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddProduct = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         const baseUnit = String(data.baseUnit ?? "").trim();
         if (!name || !baseUnit) return;
         const description = String(data.description ?? "").trim() || null;
         await createMutation.mutateAsync({
            name,
            baseUnit,
            purchaseUnit: baseUnit,
            purchaseUnitFactor: "1",
            description,
         });
         setIsDraftActive(false);
      },
      [createMutation],
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
      <DataTableRoot
         columns={columns}
         data={products}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:inventory"
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddProduct}
         onDiscardAddRow={handleDiscardDraft}
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
               typeof updater === "function" ? updater(columnFilters) : updater;
            navigate({
               search: (prev) => ({ ...prev, columnFilters: next }),
               replace: true,
            });
         }}
         renderActions={({ row }) => (
            <>
               <Button
                  onClick={() => handleMovement(row.original)}
                  variant="outline"
               >
                  <PackagePlus className="size-3.5" />
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
      >
         <DataTableToolbar>
            <Button
               onClick={() => setIsDraftActive(true)}
               size="icon-sm"
               tooltip="Novo Produto"
               variant="outline"
            >
               <Plus />
            </Button>
         </DataTableToolbar>
         <DataTableContent />
         <DataTableEmptyState>
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
         </DataTableEmptyState>
      </DataTableRoot>
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
