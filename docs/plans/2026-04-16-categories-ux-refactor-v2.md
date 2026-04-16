# Categories UX Refactor V2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine the categories page UX: icon-only import/export button, improved keywords display, parent-child visual hierarchy, archive AlertDialog, archived visual differentiation, unarchive action, description field, and filter bar redesign.

**Architecture:** All changes are frontend-only except T9 (adds `unarchive` oRPC procedure using existing `reactivateCategory` repo function) and T10 (adds `description` to CategoryForm + CategoryRow). No DB schema changes needed — `description` and `isArchived` already exist in the Drizzle schema and are returned by `listCategories`.

**Tech Stack:** React, TanStack Router, TanStack Query, oRPC, TanStack Form, Tailwind CSS, shadcn/ui, Lucide React

---

## Key Files

| File | Role |
|------|------|
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx` | Main page: handles mutations, archive, delete, view logic |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/categories-columns.tsx` | Table column defs + `CategoryRow` type |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/categories-card-view.tsx` | Card view component |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-filter-bar.tsx` | Filter bar component |
| `apps/web/src/integrations/orpc/router/categories.ts` | oRPC router: add `unarchive` procedure |
| `apps/web/src/features/categories/ui/categories-form.tsx` | Category create/edit form: add `description` field |
| `core/database/src/repositories/categories-repository.ts` | Already has `reactivateCategory` (line 282) |

---

## Task 1: Icon-only Import/Export button

**Problem:** The DropdownMenuTrigger shows "Importar / Exportar" text + ChevronDown. User wants icon-only.

**File:** `apps/web/src/routes/.../categories.tsx`

**Step 1: Update the DropdownMenuTrigger button**

Replace in `CategoriesPage` `actions` JSX (around line 631-636):

```tsx
// Before:
<DropdownMenuTrigger asChild>
   <Button variant="outline">
      Importar / Exportar
      <ChevronDown />
   </Button>
</DropdownMenuTrigger>

// After:
<DropdownMenuTrigger asChild>
   <Button size="icon" tooltip="Importar / Exportar" variant="outline">
      <MoreHorizontal />
   </Button>
</DropdownMenuTrigger>
```

**Step 2: Add MoreHorizontal to imports**

Add `MoreHorizontal` to the lucide-react import. Remove `ChevronDown` if unused.

**Step 3: Verify in browser** — Button should show only icon, tooltip on hover.

**Step 4: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): icon-only import/export button"
```

---

## Task 2: Fix header actions spacing

**Problem:** Spacing between view toggle, import/export button, and "Nova Categoria" button is inconsistent.

**File:** `apps/web/src/routes/.../categories.tsx`

**Step 1: Update actions div gap**

The current `<div className="flex gap-2">` around the actions is fine. But ensure consistent `gap-2` everywhere. Verify the ToggleGroup and Buttons look aligned after T1 icon change.

No code change needed if `gap-2` is already there — just verify visually.

---

## Task 3: Keywords column — Announcement component + improved tooltip

**Problem:** Keywords column shows only `<Badge variant="secondary">{count}</Badge>`. User wants Announcement component with tooltip showing comma-separated keywords.

**File:** `apps/web/src/routes/.../categories-columns.tsx`

**Step 1: Redesign the keywords column cell**

Replace the `keywords` column cell (lines 177-184):

```tsx
{
   id: "keywords",
   header: "Palavras-chave",
   cell: ({ row }) => {
      const keywords = row.original.keywords;
      const count = keywords?.length ?? 0;
      if (count === 0)
         return <span className="text-sm text-muted-foreground">—</span>;
      return (
         <Tooltip>
            <TooltipTrigger asChild>
               <Announcement className="cursor-default w-fit">
                  <AnnouncementTag>
                     <Tags className="size-3" />
                  </AnnouncementTag>
                  <AnnouncementTitle className="text-xs">
                     {count} {count === 1 ? "palavra" : "palavras"}
                  </AnnouncementTitle>
               </Announcement>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
               <p className="font-semibold text-sm">Palavras-chave IA</p>
               <p className="text-xs text-muted-foreground mb-1">
                  Geradas automaticamente com base no nome e descrição da categoria.
               </p>
               <p className="text-xs">{keywords!.join(", ")}</p>
            </TooltipContent>
         </Tooltip>
      );
   },
},
```

**Step 2: Also improve the inline keywords tooltip in the name column** (lines 84-94)

```tsx
const keywordsTooltip = hasKeywords ? (
   <Tooltip>
      <TooltipTrigger asChild>
         <Tags className="size-4 text-muted-foreground shrink-0 cursor-default" />
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
         <p className="font-semibold text-sm">Palavras-chave IA</p>
         <p className="text-xs text-muted-foreground mb-1">
            Geradas automaticamente com base no nome e descrição da categoria.
         </p>
         <p className="text-xs">{keywords!.join(", ")}</p>
      </TooltipContent>
   </Tooltip>
) : null;
```

**Step 3: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-columns.tsx
git commit -m "feat(categories): Announcement component for keywords column + improved tooltip"
```

---

## Task 4: Parent-child visual hierarchy in table rows

**Problem:** Subcategory rows (depth > 0) have no visual indentation or color differentiation from parent rows.

**Context:** The DataTable already passes `getSubRows={(row) => row.subcategories}` to TanStack Table. Row depth is available via `row.depth`. The `renderActions` function already checks `row.depth > 0` (via `isSub`).

**The visual differentiation needs to happen in the DataTable or via column styling.** Check if `DataTable` in `@packages/ui/components/data-table` supports row className customization. If yes, use that. If not, add subtle styling via CSS on the name column.

**File:** `apps/web/src/routes/.../categories.tsx`

**Step 1: Check DataTable for row className prop**

```bash
grep -n "rowClassName\|getRowProps\|rowClass" packages/ui/src/components/data-table/
```

**Step 2a (if DataTable supports row customization):**

Pass row class to DataTable:
```tsx
getRowClassName={(row) =>
   row.depth > 0
      ? "bg-muted/30 border-l-2 border-l-muted-foreground/20"
      : undefined
}
```

**Step 2b (if not supported):** Add indentation in the name column cell.

In `categories-columns.tsx`, in the non-Announcement branch of name cell (lines 123-142), wrap subcategory names with indentation indicator:

```tsx
return (
   <div className={cn(
      "flex items-center gap-2 min-w-0",
      row.depth > 0 && "pl-4 border-l-2 border-muted-foreground/20"
   )}>
      {row.depth > 0 && (
         <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
      )}
      <span className={row.depth > 0 ? "truncate text-muted-foreground" : "font-medium truncate"}>
         {name}
      </span>
      {isDefault && row.depth === 0 && (
         <Tooltip>
            <TooltipTrigger asChild>
               <Star className="size-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>Padrão</TooltipContent>
         </Tooltip>
      )}
      {keywordsTooltip}
   </div>
);
```

Also add `cn` import from `@packages/ui/lib/utils` if not present.

**Step 3: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-columns.tsx
git commit -m "feat(categories): parent-child visual hierarchy in table rows"
```

---

## Task 5: Parent-child visual hierarchy in card view

**Problem:** Card view shows subcategories as flat badges. User wants them to feel like indented children with a subtle color difference.

**File:** `apps/web/src/routes/.../categories-card-view.tsx`

**Step 1: Redesign subcategories section in card**

Replace the subcategories section (lines 55-66):

```tsx
{cat.subcategories && cat.subcategories.length > 0 && (
   <>
      <Separator />
      <div className="px-4 py-3 flex flex-col gap-1.5 bg-muted/20 rounded-b-lg">
         <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Subcategorias
         </p>
         <div className="flex flex-col gap-1">
            {cat.subcategories.map((sub) => (
               <div
                  key={sub.id}
                  className="flex items-center gap-2 pl-3 border-l-2 border-muted-foreground/20"
               >
                  <span className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span className="text-sm text-muted-foreground truncate">
                     {sub.name}
                  </span>
               </div>
            ))}
         </div>
      </div>
   </>
)}
```

**Step 2: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-card-view.tsx
git commit -m "feat(categories): parent-child visual hierarchy in card view"
```

---

## Task 6: Archive → AlertDialog confirmation

**Problem:** `handleArchive` calls `archiveMutation.mutate` directly without confirmation. User wants AlertDialog before archiving.

**File:** `apps/web/src/routes/.../categories.tsx`

**Step 1: Update handleArchive to use openAlertDialog**

Replace `handleArchive` (lines 350-354):

```tsx
const handleArchive = useCallback(
   (category: CategoryRow) => {
      openAlertDialog({
         title: "Arquivar categoria",
         description: `Arquivar "${category.name}" irá ocultá-la das listas e impedir novos lançamentos nesta categoria. Você poderá desarquivá-la a qualquer momento.`,
         actionLabel: "Arquivar",
         cancelLabel: "Cancelar",
         onAction: async () => {
            await archiveMutation.mutateAsync({ id: category.id });
         },
      });
   },
   [openAlertDialog, archiveMutation],
);
```

Note: Remove `onSuccess` from `archiveMutation` options since we handle flow in AlertDialog. Or keep it — the toast.success still fires on success.

**Step 2: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): archive action requires AlertDialog confirmation"
```

---

## Task 7: Add isArchived to CategoryRow + visual differentiation for archived

**Problem:** `CategoryRow` type doesn't include `isArchived`. Archived categories need visual differentiation (muted/faded appearance).

**Step 1: Add `isArchived` to CategoryRow type**

File: `apps/web/src/routes/.../categories-columns.tsx`

```tsx
export type CategoryRow = {
   id: string;
   name: string;
   isDefault: boolean;
   isArchived: boolean;  // ADD THIS
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   type: "income" | "expense" | null;
   parentId: string | null;
   subcategories?: CategoryRow[];
   createdAt: string | Date;
};
```

**Step 2: Add archived badge in name column**

In the name column cell, after the name span, add archived indicator:

```tsx
// In both Announcement and plain branches of name column cell:
{row.original.isArchived && (
   <Badge variant="secondary" className="text-xs shrink-0 opacity-70">
      Arquivada
   </Badge>
)}
```

For Announcement branch, add it inside `<AnnouncementTitle>`.
For plain branch, add it inside the `<div className="flex items-center gap-2">`.

**Step 3: Mute archived rows/cards**

In `categories.tsx`, DataTable `renderActions`:
- For archived categories (`row.original.isArchived`): show only unarchive + delete buttons (see T8)
- Archived rows: wrap row content in muted styling (use DataTable `getRowClassName` if available, else rely on the badge)

In `categories-card-view.tsx`, add archived styling to the card:

```tsx
<div
   className={cn(
      "flex flex-col rounded-lg border bg-card",
      cat.isArchived && "opacity-60 bg-muted/30"
   )}
   key={cat.id}
>
```

Add `cn` import from `@packages/ui/lib/utils`.

**Step 4: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-columns.tsx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-card-view.tsx
git commit -m "feat(categories): isArchived field in CategoryRow + archived visual differentiation"
```

---

## Task 8: Unarchive action — oRPC procedure + UI

**Context:** `reactivateCategory(db, id)` already exists in `core/database/src/repositories/categories-repository.ts` (line 282). Just needs oRPC procedure + UI.

### Part A: oRPC procedure

**File:** `apps/web/src/integrations/orpc/router/categories.ts`

**Step 1: Add reactivateCategory import**

```tsx
import {
   archiveCategory,
   bulkDeleteCategories,
   createCategory,
   deleteCategory,
   ensureCategoryOwnership,
   listCategories,
   reactivateCategory,  // ADD
   updateCategory,
} from "@core/database/repositories/categories-repository";
```

**Step 2: Add unarchive procedure**

After the `archive` procedure (line 157):

```tsx
export const unarchive = protectedProcedure
   .input(idSchema)
   .handler(async ({ context, input }) => {
      await ensureCategoryOwnership(context.db, input.id, context.teamId);
      return reactivateCategory(context.db, input.id);
   });
```

**Step 3: Commit router**
```bash
git add apps/web/src/integrations/orpc/router/categories.ts
git commit -m "feat(categories): add unarchive oRPC procedure"
```

### Part B: UI — unarchive mutation + action

**File:** `apps/web/src/routes/.../categories.tsx`

**Step 4: Add unarchive mutation**

After `archiveMutation` (around line 265):

```tsx
const unarchiveMutation = useMutation(
   orpc.categories.unarchive.mutationOptions({
      onSuccess: () => toast.success("Categoria desarquivada."),
      onError: (e) =>
         toast.error(e.message || "Erro ao desarquivar categoria."),
   }),
);
```

**Step 5: Add handleUnarchive**

After `handleArchive`:

```tsx
const handleUnarchive = useCallback(
   (category: CategoryRow) => {
      unarchiveMutation.mutate({ id: category.id });
   },
   [unarchiveMutation],
);
```

**Step 6: Show unarchive action in renderActions**

In `renderActions`, check `row.original.isArchived`:

```tsx
renderActions={({ row }) => {
   if (row.original.isDefault) return null;
   const isSub = row.original.parentId !== null;
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

   return (
      <>
         {!isSub && (
            <Button
               onClick={() => handleAddSubcategory(row.original)}
               tooltip="Nova subcategoria"
               variant="outline"
            >
               <Plus />
            </Button>
         )}
         <Button
            onClick={() => handleEdit(row.original)}
            tooltip="Editar"
            variant="outline"
         >
            <Pencil />
         </Button>
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

Import `ArchiveRestore` from lucide-react.

**Step 7: Update card view with unarchive action**

**File:** `apps/web/src/routes/.../categories-card-view.tsx`

Add `onUnarchive` prop:

```tsx
interface CategoriesCardViewProps {
   categories: CategoryRow[];
   onEdit: (category: CategoryRow) => void;
   onDelete: (category: CategoryRow) => void;
   onArchive: (category: CategoryRow) => void;
   onUnarchive: (category: CategoryRow) => void;
   onAddSubcategory: (category: CategoryRow) => void;
}
```

In the actions section, branch on `cat.isArchived`:

```tsx
{!cat.isDefault && (
   <>
      <Separator />
      <div className="flex items-center gap-2 px-4 py-2">
         {cat.isArchived ? (
            <>
               <Button
                  onClick={() => onUnarchive(cat)}
                  size="sm"
                  tooltip="Desarquivar"
                  variant="ghost"
               >
                  <ArchiveRestore />
               </Button>
               <div className="flex-1" />
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(cat)}
                  size="sm"
                  tooltip="Excluir"
                  variant="ghost"
               >
                  <Trash2 />
               </Button>
            </>
         ) : (
            <>
               <Button
                  onClick={() => onAddSubcategory(cat)}
                  size="sm"
                  tooltip="Nova subcategoria"
                  variant="ghost"
               >
                  <Plus />
               </Button>
               <Button
                  onClick={() => onEdit(cat)}
                  size="sm"
                  tooltip="Editar"
                  variant="ghost"
               >
                  <Pencil />
               </Button>
               <Button
                  onClick={() => onArchive(cat)}
                  size="sm"
                  tooltip="Arquivar"
                  variant="ghost"
               >
                  <Archive />
               </Button>
               <div className="flex-1" />
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(cat)}
                  size="sm"
                  tooltip="Excluir"
                  variant="ghost"
               >
                  <Trash2 />
               </Button>
            </>
         )}
      </div>
   </>
)}
```

Import `ArchiveRestore` from lucide-react. 

**Step 8: Pass `onUnarchive` from categories.tsx to CategoriesCardView**

```tsx
<CategoriesCardView
   categories={categories}
   onEdit={handleEdit}
   onDelete={handleDelete}
   onArchive={handleArchive}
   onUnarchive={handleUnarchive}
   onAddSubcategory={handleAddSubcategory}
/>
```

**Step 9: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-card-view.tsx
git commit -m "feat(categories): unarchive action in table and card views"
```

---

## Task 9: Description field in CategoryForm + CategoryRow

**Context:** `description` already exists in DB schema (text, nullable) and is accepted by `createCategorySchema`/`updateCategorySchema`. `listCategories` returns it. Just needs UI.

**Step 1: Add `description` to CategoryRow type**

File: `categories-columns.tsx`

```tsx
export type CategoryRow = {
   id: string;
   name: string;
   isDefault: boolean;
   isArchived: boolean;
   description: string | null;  // ADD
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   type: "income" | "expense" | null;
   parentId: string | null;
   subcategories?: CategoryRow[];
   createdAt: string | Date;
};
```

**Step 2: Add `description` field to CategoryForm**

File: `apps/web/src/features/categories/ui/categories-form.tsx`

Add `Textarea` import:
```tsx
import { Textarea } from "@packages/ui/components/textarea";
```

Add `description` to form `defaultValues`:
```tsx
const form = useForm({
   defaultValues: {
      color: category?.color ?? (isCreate ? randomColor() : "#6366f1"),
      icon: category?.icon ?? (isCreate ? randomIcon() : ""),
      name: category?.name ?? "",
      type: (category?.type ?? "expense") as "income" | "expense",
      description: category?.description ?? "",  // ADD
   },
   // ...
});
```

Add `description` to payload in `onSubmit`:
```tsx
const payload = {
   color: value.color || null,
   icon: value.icon || null,
   name: value.name.trim(),
   type: value.type,
   description: value.description?.trim() || null,  // ADD
};
```

Add `description` field after the name/type grid in CredenzaBody:

```tsx
<form.Field
   name="description"
   children={(field) => (
      <Field>
         <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
         <Textarea
            id={field.name}
            name={field.name}
            aria-invalid={false}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder="Descreva quando usar esta categoria..."
            rows={2}
            value={field.state.value}
         />
      </Field>
   )}
/>
```

**Step 3: Update CategoryFormProps to include description**

```tsx
interface CategoryFormProps {
   mode: "create" | "edit";
   category?: {
      id: string;
      name: string;
      color?: string | null;
      icon?: string | null;
      type?: string | null;
      description?: string | null;  // ADD
   };
   onSuccess: () => void;
}
```

**Step 4: Pass description when opening edit form in categories.tsx**

In `handleEdit` (around line 298):

```tsx
openCredenza({
   renderChildren: () => (
      <CategoryForm
         category={{
            id: category.id,
            name: category.name,
            color: category.color,
            icon: category.icon,
            type: category.type,
            description: category.description,  // ADD
         }}
         mode="edit"
         onSuccess={closeCredenza}
      />
   ),
});
```

**Step 5: Show description in card view (optional, subtle)**

In `categories-card-view.tsx`, after the name/badge section:

```tsx
{cat.description && (
   <p className="text-xs text-muted-foreground truncate" title={cat.description}>
      {cat.description}
   </p>
)}
```

**Step 6: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-columns.tsx
git add apps/web/src/features/categories/ui/categories-form.tsx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-card-view.tsx
git commit -m "feat(categories): description field in form and card view"
```

---

## Task 10: Filter bar redesign

**Current state:** Two-row layout — search input on top, then a flex row with ToggleGroup + Separators + Switches.

**New design:** Compact single-row or intelligently grouped layout. Use pill-style active filter indicators. Clear visual hierarchy. Better spacing and typography.

**Design direction:**
- Row 1: Search input (left, flexible) + type ToggleGroup (right, compact)
- Row 2: Compact filter pills row — "Arquivadas" toggle, "Agrupar" toggle, clear button
- Active filters highlighted with accent color

**File:** `apps/web/src/routes/.../category-filter-bar.tsx`

**Step 1: Redesign the component**

```tsx
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useRouter } from "@tanstack/react-router";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { Archive, LayoutList, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@packages/ui/lib/utils";

interface CategoryFilterBarProps {
   search: string;
   type: "income" | "expense" | undefined;
   includeArchived: boolean;
   groupBy: boolean;
   onSearchChange: (value: string) => void;
   onTypeChange: (value: "income" | "expense" | undefined) => void;
   onIncludeArchivedChange: (checked: boolean) => void;
   onGroupByChange: (checked: boolean) => void;
   onClear: () => void;
}

export function CategoryFilterBar({
   search,
   type,
   includeArchived,
   groupBy,
   onSearchChange,
   onTypeChange,
   onIncludeArchivedChange,
   onGroupByChange,
   onClear,
}: CategoryFilterBarProps) {
   const router = useRouter();
   const [inputValue, setInputValue] = useState(search);

   const debouncedOnSearchChange = useDebouncedCallback(onSearchChange, {
      wait: 300,
   });

   useEffect(() => {
      if (search === "") setInputValue("");
   }, [search]);

   const hasActiveFilters =
      type !== undefined || includeArchived || search !== "";

   return (
      <div className="flex flex-col gap-2">
         {/* Row 1: Search + type filter */}
         <div className="flex items-center gap-2">
            <div className="relative flex-1">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
               <Input
                  className="pl-9"
                  onChange={(e) => {
                     setInputValue(e.target.value);
                     debouncedOnSearchChange(e.target.value);
                  }}
                  placeholder="Buscar por nome ou palavra-chave..."
                  value={inputValue}
               />
            </div>
            <ToggleGroup
               onValueChange={(v) => {
                  if (v === "income" || v === "expense") {
                     onTypeChange(v);
                  } else {
                     onTypeChange(undefined);
                  }
               }}
               size="sm"
               type="single"
               value={type ?? "all"}
               variant="outline"
            >
               <ToggleGroupItem value="all">Todos</ToggleGroupItem>
               <ToggleGroupItem value="income">Receitas</ToggleGroupItem>
               <ToggleGroupItem value="expense">Despesas</ToggleGroupItem>
            </ToggleGroup>
         </div>

         {/* Row 2: Toggle filters as compact pill buttons */}
         <div className="flex items-center gap-2 flex-wrap">
            <button
               className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  includeArchived
                     ? "border-foreground/20 bg-foreground/5 text-foreground"
                     : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
               )}
               onClick={() => {
                  onIncludeArchivedChange(!includeArchived);
                  router.preloadRoute({
                     to: ".",
                     search: { includeArchived: !includeArchived },
                  });
               }}
               type="button"
            >
               <Archive className="size-3" />
               Arquivadas
            </button>

            <button
               className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  groupBy
                     ? "border-foreground/20 bg-foreground/5 text-foreground"
                     : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
               )}
               onClick={() => onGroupByChange(!groupBy)}
               type="button"
            >
               <LayoutList className="size-3" />
               Agrupar por tipo
            </button>

            {hasActiveFilters && (
               <Button
                  className="h-7 rounded-full gap-1.5 text-muted-foreground hover:text-foreground text-xs px-3"
                  onClick={onClear}
                  size="sm"
                  variant="ghost"
               >
                  <X className="size-3" />
                  Limpar filtros
               </Button>
            )}
         </div>
      </div>
   );
}
```

Note: Remove `Label`, `Separator`, `Switch` imports — no longer needed.

**Step 2: Verify the component renders correctly in both light and dark mode**

**Step 3: Commit**
```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/category-filter-bar.tsx
git commit -m "feat(categories): redesign filter bar with pill-style toggle filters"
```

---

## Task 11: routeTree.gen.ts sync

The `apps/web/src/routeTree.gen.ts` file is auto-generated. After all changes, if there are TypeScript errors about route types, run:

```bash
cd apps/web && bun run dev
# or
bunx tsr generate
```

This regenerates the route tree. **Never edit routeTree.gen.ts manually.**

---

## Execution Order

Run tasks in this order (each depends on previous TypeScript-wise):

```
T1 → T2 → T3 → T4 → T5 → T6 → T7 (adds isArchived) → T8 (uses isArchived) → T9 (uses description) → T10 → T11
```

T7 must come before T8 (unarchive UI uses `isArchived` field).
T9 must come after T7 (description on CategoryRow needed before form update).

---

## Testing checklist

After all tasks:

- [ ] Import/Export button shows only icon with tooltip
- [ ] Keywords column shows Announcement with tooltip (title + description + comma-separated keywords)
- [ ] Subcategory rows are visually indented in table view
- [ ] Card view subcategories show as indented children with muted styling
- [ ] Archive action shows AlertDialog with descriptive message
- [ ] Archived categories show muted/faded in both table and card view
- [ ] Archived categories show "Arquivada" badge
- [ ] Unarchive button appears for archived categories in both views
- [ ] Unarchive restores category (remove muted styling, show normal actions)
- [ ] Description field appears in CategoryForm (both create and edit)
- [ ] Description saves to DB and loads correctly in edit mode
- [ ] Description shows in card view (truncated)
- [ ] Filter bar shows pill-style toggles with active state
- [ ] All TypeScript compiles: `bun run typecheck`
