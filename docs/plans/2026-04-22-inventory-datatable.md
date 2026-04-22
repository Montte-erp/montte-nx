# Inventory DataTable Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `DataTable` + `createLocalStorageState` + manual `OnChangeFn` handlers with `DataTableRoot` composable pattern. Delete the orphaned `inventory-product-card.tsx` file (no imports found anywhere).

**Architecture:** `DataTableRoot` manages all state internally (`storageKey` handles localStorage). URL-bound `sorting`/`columnFilters` continue to work via the external props. `DropdownMenu` row actions stay unchanged inside `renderActions`.

**Tech Stack:** TanStack Router, TanStack Query, `DataTableRoot` + `DataTableContent` + `DataTableEmptyState` + `DataTableSkeleton` + `DataTableToolbar` from `@/components/data-table/`

---

### Task 1: Delete `inventory-product-card.tsx` (orphaned)

**Files:**
- Delete: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/-inventory/inventory-product-card.tsx`

**Step 1: Verify no file imports it**

```bash
grep -r "inventory-product-card" apps/web/src --include="*.tsx" --include="*.ts"
```
Expected: 0 results.

**Step 2: Delete the file**

```bash
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/-inventory/inventory-product-card.tsx"
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove orphaned inventory-product-card"
```

---

### Task 2: Rewrite `inventory/index.tsx` to use `DataTableRoot`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`

**Step 1: Replace the file content**

```tsx
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
import type {
   SortingState,
   ColumnFiltersState,
} from "@tanstack/react-table";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
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
import { useCallback, useMemo } from "react";
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
import { InventoryProductForm } from "./-inventory/inventory-product-form";
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

   const handleEdit = useCallback(
      (product: InventoryProductRow) => {
         openCredenza({
            renderChildren: () => (
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

   const columns = useMemo(() => buildInventoryProductColumns(), []);

   return (
      <DataTableRoot
         columns={columns}
         data={products}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:inventory"
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
      >
         <DataTableToolbar />
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
   const { openCredenza, closeCredenza } = useCredenza();

   const handleCreate = useCallback(() => {
      openCredenza({
         renderChildren: () => (
            <InventoryProductForm mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4" />
                  Novo Produto
               </Button>
            }
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
```

Key changes:
- Removed `createLocalStorageState`, `DataTableStoredState`, `DataTable` from `@packages/ui`
- Removed `OnChangeFn` import (inline handlers typed via `SortingState`/`ColumnFiltersState`)
- `InventorySkeleton` uses `DataTableSkeleton` with actual columns
- `DataTableRoot` handles localStorage via `storageKey`
- `DataTableEmptyState` + `DataTableToolbar` + `DataTableContent` composable children
- `PackagePlus` button: removed `mr-1` (gap handled by flex parent)

**Step 2: TypeCheck**

```bash
bun run typecheck 2>&1 | grep -A3 "inventory"
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/index.tsx
git commit -m "feat(inventory): migrate to DataTableRoot composable pattern"
```
