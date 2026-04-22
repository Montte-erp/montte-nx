# Categories — Native Table Create & Import

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `CategoryForm` + `SubcategoryForm` + `CategoryImportCredenza` with native `onAddRow` + `DataTableImportButton` + inline cell editing via `onSave`. Delete all deprecated form/credenza files.

**Architecture:** Add `cellComponent: "text"` + `onSave` to `name` column and `cellComponent: "select"` + `onSave` to `type` column in `categories-columns.tsx`. `buildCategoryColumns` accepts an `options` object with `onUpdate` callback. Wire `isDraftRowActive`/`onAddRow`/`onDiscardAddRow` on `DataTableRoot`. Replace the Upload + Create buttons in `DataTableToolbar` with `DataTableImportButton` + a Plus button. Remove `handleEdit`, `handleAddSubcategory`, `handleCreate`, `handleImport` from `CategoriesList`.

**Tech Stack:** TanStack Query, `DataTableRoot`, `DataTableImportButton`, `orpc.categories.create`, `orpc.categories.update`

---

### Task 1: Update `categories-columns.tsx` — add `cellComponent` + `onSave` meta

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/categories-columns.tsx`

**Step 1: Add z import and update function signature**

Add at the top of the file (after existing imports):
```typescript
import { z } from "zod";
```

Change function signature from:
```typescript
export function buildCategoryColumns(): ColumnDef<CategoryRow>[]
```
to:
```typescript
export function buildCategoryColumns(options?: {
   onUpdate?: (rowId: string, data: { name?: string; type?: "income" | "expense" }) => Promise<void>;
}): ColumnDef<CategoryRow>[]
```

**Step 2: Update `name` column — add meta**

Replace the `name` column entirely:
```typescript
{
   accessorKey: "name",
   header: "Nome",
   meta: {
      label: "Nome",
      cellComponent: "text" as const,
      isEditable: true,
      editSchema: z.string().min(1, "Nome é obrigatório.").max(80),
      isEditableForRow: (row: CategoryRow) => !row.isDefault && !row.isArchived,
      onSave: options?.onUpdate
         ? async (rowId, value) => {
              await options.onUpdate!(rowId, { name: String(value) });
           }
         : undefined,
   },
   cell: ({ row }) => {
      // Keep all existing cell rendering code unchanged
      // ...
   },
},
```

**Step 3: Update `type` column — add meta**

```typescript
{
   accessorKey: "type",
   header: "Tipo",
   meta: {
      label: "Tipo",
      cellComponent: "select" as const,
      isEditable: true,
      editOptions: [
         { value: "income", label: "Receita" },
         { value: "expense", label: "Despesa" },
      ],
      editSchema: z.enum(["income", "expense"]),
      isEditableForRow: (row: CategoryRow) => !row.isDefault && !row.isArchived && row.parentId === null,
      onSave: options?.onUpdate
         ? async (rowId, value) => {
              await options.onUpdate!(rowId, {
                 type: String(value) as "income" | "expense",
              });
           }
         : undefined,
   },
   cell: ({ row }) => {
      const { type } = row.original;
      if (type === "income")
         return (
            <Badge
               className="border-green-600 text-green-600 dark:border-green-500 dark:text-green-500"
               variant="outline"
            >
               Receita
            </Badge>
         );
      if (type === "expense")
         return <Badge variant="destructive">Despesa</Badge>;
      return <span className="text-sm text-muted-foreground">—</span>;
   },
},
```

**Step 4: Typecheck columns file**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "categories-columns" | head -20
```

---

### Task 2: Rewrite `categories.tsx` — remove forms/credenzas, add native create/import

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Step 1: Add these imports, remove form/credenza imports**

Remove:
```typescript
import { CategoryForm } from "@/features/categories/ui/categories-form";
import { SubcategoryForm } from "@/features/categories/ui/subcategory-form";
import { CategoryImportCredenza } from "./-categories/category-import-credenza";
```

Add:
```typescript
import { useState } from "react"; // add to existing react import
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
```

Also remove from lucide-react imports: `Pencil`, `Upload` (if no longer used).

**Step 2: Update `CategoriesList` — remove form callbacks, add create/import**

In `CategoriesList`, make these changes:

1. Add `parseCsv`/`parseXlsx` hooks at top of component
2. Add `createMutation`:
```typescript
const createMutation = useMutation(
   orpc.categories.create.mutationOptions({
      onSuccess: () => toast.success("Categoria criada com sucesso."),
      onError: (e) => toast.error(e.message || "Erro ao criar categoria."),
   }),
);
```

3. Add `updateMutation`:
```typescript
const updateMutation = useMutation(
   orpc.categories.update.mutationOptions({
      onError: (e) => toast.error(e.message || "Erro ao atualizar categoria."),
   }),
);
```

4. Add draft state:
```typescript
const [isDraftActive, setIsDraftActive] = useState(false);
const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);
```

5. Add `handleAddCategory`:
```typescript
const handleAddCategory = useCallback(
   async (data: Record<string, string | string[]>) => {
      const name = String(data.name ?? "").trim();
      const categoryType = String(data.type ?? "") as "income" | "expense";
      if (!name || !categoryType) return;
      await createMutation.mutateAsync({ name, type: categoryType, participatesDre: false });
      setIsDraftActive(false);
   },
   [createMutation],
);
```

6. Add `importConfig`:
```typescript
const importConfig: DataTableImportConfig = useMemo(
   () => ({
      accept: {
         "text/csv": [".csv"],
         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            [".xlsx"],
         "application/vnd.ms-excel": [".xls"],
      },
      parseFile: async (file: File) => {
         const ext = file.name.split(".").pop()?.toLowerCase();
         if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
         return parseCsv(file);
      },
      mapRow: (row, i): CategoryRow => ({
         id: `__import_${i}`,
         name: String(row.name ?? "").trim(),
         type: (String(row.type ?? "expense") === "income" ? "income" : "expense") as "income" | "expense",
         color: null,
         icon: null,
         description: null,
         parentId: null,
         isDefault: false,
         isArchived: false,
         keywords: null,
         keywordsUpdatedAt: null,
         updatedAt: new Date().toISOString(),
         participatesDre: false,
         dreGroupId: null,
      }),
      onImport: async (rows) => {
         await Promise.allSettled(
            rows.map((r) =>
               createMutation.mutateAsync({
                  name: r.name,
                  type: r.type,
                  participatesDre: false,
               }),
            ),
         );
      },
   }),
   [createMutation, parseCsv, parseXlsx],
);
```

7. Add `handleUpdateCategory` and pass to `buildCategoryColumns`:
```typescript
const handleUpdateCategory = useCallback(
   async (rowId: string, data: { name?: string; type?: "income" | "expense" }) => {
      await updateMutation.mutateAsync({ id: rowId, ...data });
   },
   [updateMutation],
);

const columns = useMemo(
   () => buildCategoryColumns({ onUpdate: handleUpdateCategory }),
   [handleUpdateCategory],
);
```

8. Remove `handleEdit`, `handleAddSubcategory`, `handleCreate`, `handleImport` callbacks entirely.

9. Update `renderActions` — remove Pencil button and "Add Subcategory" button:
```typescript
renderActions={({ row }) => {
   if (row.original.isDefault) return null;
   const isArchived = row.original.isArchived;

   if (isArchived) {
      return (
         <>
            <Button
               onClick={() => handleUnarchive(row.original)}
               tooltip="Desarquivar"
               variant="outline"
            >
               <ArchiveRestore />
            </Button>
            <Button
               className="text-destructive hover:text-destructive"
               onClick={() => handleDelete(row.original)}
               tooltip="Excluir"
               variant="outline"
            >
               <Trash2 />
            </Button>
         </>
      );
   }

   const isSub = row.original.parentId !== null;

   return (
      <>
         {!isSub && (
            <Button
               disabled={regenerateKeywordsMutation.isPending}
               onClick={() =>
                  regenerateKeywordsMutation.mutate({
                     id: row.original.id,
                  })
               }
               tooltip="Regerar palavras-chave"
               variant="outline"
            >
               <RefreshCw />
            </Button>
         )}
         {!isSub && (
            <Button
               onClick={() => handleArchive(row.original)}
               tooltip="Arquivar"
               variant="outline"
            >
               <Archive />
            </Button>
         )}
         <Button
            className="text-destructive hover:text-destructive"
            onClick={() => handleDelete(row.original)}
            tooltip="Excluir"
            variant="outline"
         >
            <Trash2 />
         </Button>
      </>
   );
}}
```

10. Add `isDraftRowActive`, `onAddRow`, `onDiscardAddRow` to `DataTableRoot`:
```typescript
isDraftRowActive={isDraftActive}
onAddRow={handleAddCategory}
onDiscardAddRow={handleDiscardDraft}
```

11. Replace the two manual buttons inside `DataTableToolbar` children with `DataTableImportButton` + Plus button:
```typescript
<DataTableToolbar
   searchPlaceholder="Buscar categorias..."
   searchDefaultValue={search}
   onSearch={(value) =>
      navigate({
         search: (prev) => ({ ...prev, search: value, page: 1 }),
         replace: true,
      })
   }
>
   <DataTableImportButton importConfig={importConfig} />
   <Button
      onClick={() => setIsDraftActive(true)}
      tooltip="Nova Categoria"
      variant="outline"
      size="icon-sm"
   >
      <Plus />
   </Button>
</DataTableToolbar>
```

12. Remove `useCredenza` if no longer used (check — it may still be used by archive/delete confirmations via `openAlertDialog`). Actually `useCredenza` was used only for forms — remove it if no other credenza is opened. Keep `useAlertDialog`.

**Step 3: Update `CategoriesPage` — remove the create button from header**

`CategoriesPage` currently has no actions in `DefaultHeader` (the buttons are inside `DataTableToolbar`). Verify this is still the case after changes. The `DefaultHeader` should remain unchanged.

**Step 4: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "categor" | head -20
```

Fix all type errors. The `CategoryRow` type from `Outputs["categories"]["getPaginated"]["data"][number]` may have additional fields — check and ensure `mapRow` returns a compatible shape (extra fields can be `null`/`undefined`).

---

### Task 3: Delete deprecated files

**Files to delete:**
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/use-category-import.tsx`
- `apps/web/src/features/categories/ui/categories-form.tsx`
- `apps/web/src/features/categories/ui/subcategory-form.tsx`

**Step 1: Verify no imports remain**

```bash
cd /home/yorizel/Documents/montte-nx && grep -r "category-import-credenza\|use-category-import\|categories-form\|subcategory-form" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Expected: 0 results.

**Step 2: Delete**

```bash
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/category-import-credenza.tsx"
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/use-category-import.tsx"
rm "apps/web/src/features/categories/ui/categories-form.tsx"
rm "apps/web/src/features/categories/ui/subcategory-form.tsx"
rmdir "apps/web/src/features/categories/ui" 2>/dev/null || true
rmdir "apps/web/src/features/categories" 2>/dev/null || true
```

**Step 3: Final typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "categor" | head -20
```

**Step 4: Commit**

```bash
cd /home/yorizel/Documents/montte-nx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-columns.tsx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git add -u
git commit -m "feat(categories): native inline create/edit, import, remove deprecated files"
```
