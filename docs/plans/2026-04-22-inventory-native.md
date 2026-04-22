# Inventory — Native Table Create

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `InventoryProductForm` credenza with native `onAddRow`. Delete `inventory-product-form.tsx`.

**Architecture:** Add `cellComponent: "text"` to `name`, `baseUnit`, `purchaseUnit` columns in `inventory-product-columns.tsx` so `DraftRow` renders inline inputs. Wire `isDraftRowActive`/`onAddRow`/`onDiscardAddRow` on `DataTableRoot`. Remove `handleCreate` + `InventoryProductForm` from `inventory/index.tsx`. Replace the "Novo Produto" button in `DefaultHeader.actions` with a Plus button inside `DataTableToolbar`.

**Tech Stack:** TanStack Query, `DataTableRoot`, `orpc.inventory.createProduct`

---

### Task 1: Update `inventory-product-columns.tsx` — add `cellComponent` meta

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/-inventory/inventory-product-columns.tsx`

**Step 1: Add z import**

Add at the top:
```typescript
import { z } from "zod";
```

**Step 2: Update `name` column — add meta**

```typescript
{
   accessorKey: "name",
   header: "Produto",
   meta: {
      label: "Produto",
      cellComponent: "text" as const,
      editSchema: z.string().min(2, "Nome deve ter no mínimo 2 caracteres."),
   },
   cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
   ),
},
```

**Step 3: Update `description` column — add meta (optional field)**

```typescript
{
   accessorKey: "description",
   header: "Descrição",
   meta: {
      label: "Descrição",
      cellComponent: "text" as const,
   },
   cell: ({ row }) => {
      const { description } = row.original;
      if (!description)
         return <span className="text-muted-foreground">—</span>;
      return (
         <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
            {description}
         </span>
      );
   },
},
```

**Step 4: Add `baseUnit` column meta** (currently no meta on this column)

```typescript
{
   accessorKey: "baseUnit",
   // Add new hidden draft-only column for baseUnit input
   // Wait — baseUnit is shown inside `currentStock` cell. We need a dedicated column.
}
```

Actually, `baseUnit` is not shown as a separate column — it appears inside the `currentStock` cell. For the draft row to capture `baseUnit`, we need to add a separate `baseUnit` column that shows in the draft row.

Add this new column to `buildInventoryProductColumns()`:
```typescript
{
   accessorKey: "baseUnit",
   header: "Unidade",
   meta: {
      label: "Unidade",
      cellComponent: "text" as const,
      editSchema: z.string().min(1, "Unidade é obrigatória.").max(10),
   },
   cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.baseUnit}</span>
   ),
},
```

Note: if `InventoryProductRow` doesn't have `baseUnit` as a separate field, check the type — it does since the type definition shows `baseUnit: string`. Add this column before `currentStock`.

**Step 5: Typecheck columns file**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "inventory-product-columns" | head -20
```

---

### Task 2: Rewrite `inventory/index.tsx` — remove form, add native create

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/index.tsx`

**Step 1: Remove `InventoryProductForm` references**

Remove from imports:
```typescript
import { InventoryProductForm } from "./-inventory/inventory-product-form";
```

Remove `useCredenza` import if it's no longer needed (check — `InventoryHistorySheet` and `InventoryMovementCredenza` still use `useCredenza`). Keep it.

**Step 2: Add `useState` import and `createMutation`**

Add `useState` to existing React imports.

In `InventoryList`, add:
```typescript
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
```

**Step 3: Remove `handleCreate` and edit-related props**

In `InventoryList`, remove `handleCreate` callback (was in `InventoryPage`).

Remove from `renderActions` the `handleEdit` callback that uses `InventoryProductForm`:
```typescript
// Remove: openCredenza for InventoryProductForm edit
```

Keep: `handleMovement`, `handleHistory`, `handleArchive`.

Updated `renderActions`:
```typescript
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
```

**Step 4: Add `isDraftRowActive`/`onAddRow`/`onDiscardAddRow` to `DataTableRoot` and update toolbar**

Add to `DataTableRoot` props:
```typescript
isDraftRowActive={isDraftActive}
onAddRow={handleAddProduct}
onDiscardAddRow={handleDiscardDraft}
```

Replace `<DataTableToolbar />` with:
```typescript
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
```

**Step 5: Update `InventoryPage` — remove "Novo Produto" button from DefaultHeader**

`InventoryPage` currently renders a "Novo Produto" button in `DefaultHeader.actions`. Remove it entirely — the Plus button is now in the toolbar.

```typescript
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
```

Also: remove `Plus` from lucide-react imports if no longer in `InventoryPage` — but keep it since it's now used inside `InventoryList`.

**Step 6: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "inventory" | head -20
```

Fix all errors. Check the exact signature of `orpc.inventory.createProduct.mutationOptions` — it may be `orpc.inventory.createProduct` or a different name. Look at the existing `InventoryProductForm` implementation to find the correct mutation.

---

### Task 3: Delete deprecated file

**File to delete:**
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/inventory/-inventory/inventory-product-form.tsx`

**Step 1: Verify no imports remain**

```bash
cd /home/yorizel/Documents/montte-nx && grep -r "inventory-product-form" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Expected: 0 results.

**Step 2: Delete**

```bash
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/-inventory/inventory-product-form.tsx"
```

**Step 3: Final typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "inventory" | head -20
```

**Step 4: Commit**

```bash
cd /home/yorizel/Documents/montte-nx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/-inventory/inventory-product-columns.tsx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/inventory/index.tsx
git add -u
git commit -m "feat(inventory): native inline create, remove deprecated inventory-product-form"
```
