# Categories Screen Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all bugs, pattern violations, and UX issues on the categories screen per audit.

**Architecture:** Six independent phases tackling bugs → pattern fixes → UX improvements → mobile view. Import logic extracted to a dedicated hook/provider. Mobile card view added alongside table view using foxact context state for view switching.

**Tech Stack:** TanStack Router, TanStack Form, TanStack Query, oRPC, shadcn/ui (Separator, ToggleGroup, DropdownMenu, ScrollArea, stepper), @tanstack/react-virtual, neverthrow, foxact

---

## Reference: File Paths

- **Route:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`
- **Columns:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/categories-columns.tsx`
- **Filter bar:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-filter-bar.tsx`
- **Import credenza:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx`
- **Export util:** `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/export-categories-csv.ts`
- **Category form:** `apps/web/src/features/categories/ui/categories-form.tsx`
- **Subcategory form:** `apps/web/src/features/categories/ui/subcategory-form.tsx`
- **Router:** `apps/web/src/integrations/orpc/router/categories.ts`

---

## Phase 1 — Skeletons

### Task 1: Rewrite `CategoriesSkeleton` and add `CategoriesTableSkeleton`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Context:**
Current `CategoriesSkeleton` renders 5 generic `<Skeleton h-12 w-full>` blocks. It should reflect the real structure: a header strip (title + action buttons), a filter bar strip, and grouped table rows with sub-rows.

**Step 1: Replace `CategoriesSkeleton` in categories.tsx**

Replace the existing `CategoriesSkeleton` function with:

```tsx
function CategoriesTableSkeleton() {
   return (
      <div className="flex flex-col gap-2">
         {/* Group header */}
         <Skeleton className="h-8 w-32" />
         {/* Parent rows */}
         {Array.from({ length: 3 }).map((_, i) => (
            <div className="flex flex-col gap-2" key={`parent-${i + 1}`}>
               <Skeleton className="h-12 w-full" />
               {/* Sub-rows indented */}
               {i < 2 && (
                  <div className="pl-8 flex flex-col gap-2">
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                  </div>
               )}
            </div>
         ))}
         {/* Second group */}
         <Skeleton className="h-8 w-32 mt-2" />
         {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton className="h-12 w-full" key={`parent2-${i + 1}`} />
         ))}
      </div>
   );
}

function CategoriesSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         {/* Header skeleton */}
         <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
               <Skeleton className="h-7 w-36" />
               <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex gap-2">
               <Skeleton className="h-9 w-28" />
               <Skeleton className="h-9 w-36" />
            </div>
         </div>
         {/* Filter bar skeleton */}
         <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full" />
            <div className="flex gap-2">
               <Skeleton className="h-9 w-48" />
               <Skeleton className="h-5 w-px" />
               <Skeleton className="h-9 w-36" />
            </div>
         </div>
         <CategoriesTableSkeleton />
      </div>
   );
}
```

Also update `QueryBoundary` fallback in `CategoriesPage`:
```tsx
<QueryBoundary
   fallback={<CategoriesTableSkeleton />}
   errorTitle="Erro ao carregar categorias"
>
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): improve skeleton to reflect real structure"
```

---

## Phase 2 — Pattern Violations (Bugs P1–P5)

### Task 2: Fix `form.Subscribe` selector in CategoryForm (P2)

**Files:**
- Modify: `apps/web/src/features/categories/ui/categories-form.tsx`

**Context:**
`CredenzaFooter` uses `form.Subscribe selector={(s) => s}` which re-renders on every state change. Must use specific selector.

**Step 1: Fix footer Subscribe**

In `categories-form.tsx` at line 509, replace:
```tsx
<form.Subscribe selector={(s) => s}>
   {(state) => (
      <Button
         disabled={
            !state.canSubmit || state.isSubmitting || isPending
         }
```

With:
```tsx
<form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}>
   {({ canSubmit, isSubmitting }) => (
      <Button
         disabled={
            !canSubmit || isSubmitting || isPending
         }
```

**Step 2: Commit**

```bash
git add apps/web/src/features/categories/ui/categories-form.tsx
git commit -m "fix(categories): narrow form.Subscribe selector in CategoryForm"
```

---

### Task 3: Fix `form.Subscribe` selector in SubcategoryForm (P2)

**Files:**
- Modify: `apps/web/src/features/categories/ui/subcategory-form.tsx`

**Step 1: Fix footer Subscribe**

In `subcategory-form.tsx` at line 136, replace:
```tsx
<form.Subscribe selector={(s) => s}>
   {(state) => (
      <Button
         disabled={
            !state.canSubmit || state.isSubmitting || isPending
         }
```

With:
```tsx
<form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit, isSubmitting: s.isSubmitting })}>
   {({ canSubmit, isSubmitting }) => (
      <Button
         disabled={
            !canSubmit || isSubmitting || isPending
         }
```

**Step 2: Commit**

```bash
git add apps/web/src/features/categories/ui/subcategory-form.tsx
git commit -m "fix(categories): narrow form.Subscribe selector in SubcategoryForm"
```

---

### Task 4: Fix gap-0.5, icon sizes, div separators in filter bar + main page (P3, P4, P5)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-filter-bar.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Context:**
- P3: `gap-0.5` in the type segmented control container → `gap-2`
- P4: `<Upload className="size-4 " />`, `<Download className="size-4 " />`, `<Plus className="size-4 " />` — trailing space, and `size-4` on icons inside `Button` is against shadcn rules. Remove `className="size-4 "` from icons inside Buttons in the header and `renderActions`.
- P5: `<div className="h-5 w-px bg-border" />` → `<Separator orientation="vertical" className="h-5" />`

**Step 1: Fix category-filter-bar.tsx**

Add import:
```tsx
import { Separator } from "@packages/ui/components/separator";
```

Remove `Link, useRouter` if only used for type segmented control (keep if used elsewhere — check: `useRouter` is used for preloading, keep it).

Change the container div with `gap-0.5` (line 72):
```tsx
<div className="flex items-center rounded-md border bg-background p-0.5 gap-0.5">
```
→
```tsx
<div className="flex items-center rounded-md border bg-background p-0.5 gap-2">
```

Replace both `<div className="h-5 w-px bg-border" />` occurrences with:
```tsx
<Separator orientation="vertical" className="h-5" />
```

**Step 2: Fix categories.tsx — icon trailing spaces + remove size-4 from icons in Button**

In `categories.tsx`, header actions section (around line 482–494):
```tsx
<Upload className="size-4 " />   →  <Upload />
<Download className="size-4 " /> →  <Download />
<Plus className="size-4 " />     →  <Plus />
```

In `renderActions` (around line 354–385), remove `className="size-4"` from all icon components:
```tsx
<Plus className="size-4" />     →  <Plus />
<Pencil className="size-4" />   →  <Pencil />
<Archive className="size-4" />  →  <Archive />
<Trash2 className="size-4" />   →  <Trash2 />
```

Also `SelectionActionBar`:
```tsx
<Trash2 className="size-3.5" />  →  <Trash2 />
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/category-filter-bar.tsx \
        apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "fix(categories): fix gap-0.5, icon sizes, div separators (P3/P4/P5)"
```

---

## Phase 3 — Export Fix (B4, P1)

### Task 5: Fix export to include subcategories + replace try/catch with neverthrow

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/export-categories-csv.ts`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Context:**
- B4: `exportCategoriesCsv` only serializes parent categories. `exportAll` returns all categories including those with `parentId !== null`. We need to output one row per subcategory too, with columns: `nome,tipo,cor,icone,palavras-chave,subcategoria,palavras-chave-sub`
- P1: `handleExport` uses `try/catch`. Replace with `fromPromise` from `neverthrow`.

**Step 1: Rewrite export-categories-csv.ts**

```typescript
interface ExportableCategory {
   name: string;
   type: string | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   parentId: string | null;
}

function escapeCsvField(value: string): string {
   if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
   }
   return value;
}

function triggerDownload(blob: Blob, filename: string): void {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

export function exportCategoriesCsv(categories: ExportableCategory[]): void {
   const headers = ["Nome", "Tipo", "Cor", "Ícone", "Palavras-chave", "Subcategoria", "Palavras-chave-Sub"];

   const parentMap = new Map(
      categories.filter((c) => c.parentId === null).map((c) => [c.name, c]),
   );

   const rows: string[][] = [];

   for (const cat of categories) {
      if (cat.parentId !== null) continue; // parent rows below
      const subs = categories.filter((c) => c.parentId !== null && categories.find((p) => p.name === cat.name && p.parentId === null));
      if (subs.length === 0) {
         rows.push([
            cat.name,
            cat.type === "income" ? "Receita" : cat.type === "expense" ? "Despesa" : "",
            cat.color ?? "",
            cat.icon ?? "",
            cat.keywords?.join("; ") ?? "",
            "",
            "",
         ]);
      } else {
         for (const sub of subs) {
            rows.push([
               cat.name,
               cat.type === "income" ? "Receita" : cat.type === "expense" ? "Despesa" : "",
               cat.color ?? "",
               cat.icon ?? "",
               cat.keywords?.join("; ") ?? "",
               sub.name,
               sub.keywords?.join("; ") ?? "",
            ]);
         }
      }
   }

   const csv = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
   ].join("\n");

   const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
   triggerDownload(blob, "categorias.csv");
}
```

Wait — the issue is that `exportAll` returns a flat list without the parent name on subcategory rows (subcategories have `parentId` pointing to a UUID, not by name). The match must be by `parentId === parent.id`.

Correct implementation:

```typescript
interface ExportableCategory {
   id: string;
   name: string;
   type: string | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   parentId: string | null;
}

function escapeCsvField(value: string): string {
   if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
   }
   return value;
}

function triggerDownload(blob: Blob, filename: string): void {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
}

export function exportCategoriesCsv(categories: ExportableCategory[]): void {
   const headers = [
      "Nome",
      "Tipo",
      "Cor",
      "Ícone",
      "Palavras-chave",
      "Subcategoria",
      "Palavras-chave-Sub",
   ];

   const parents = categories.filter((c) => c.parentId === null);
   const rows: string[][] = [];

   for (const parent of parents) {
      const subs = categories.filter((c) => c.parentId === parent.id);
      const typeLabel =
         parent.type === "income"
            ? "Receita"
            : parent.type === "expense"
              ? "Despesa"
              : "";

      if (subs.length === 0) {
         rows.push([
            parent.name,
            typeLabel,
            parent.color ?? "",
            parent.icon ?? "",
            parent.keywords?.join("; ") ?? "",
            "",
            "",
         ]);
      } else {
         for (const sub of subs) {
            rows.push([
               parent.name,
               typeLabel,
               parent.color ?? "",
               parent.icon ?? "",
               parent.keywords?.join("; ") ?? "",
               sub.name,
               sub.keywords?.join("; ") ?? "",
            ]);
         }
      }
   }

   const csv = [
      headers.map(escapeCsvField).join(","),
      ...rows.map((row) => row.map(escapeCsvField).join(",")),
   ].join("\n");

   const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
   triggerDownload(blob, "categorias.csv");
}
```

Note: The `ExportableCategory` interface now requires `id`. Check if the return type from `exportAll` includes `id` — it does (uses `listCategories` which returns full rows).

**Step 2: Fix handleExport in categories.tsx (P1 — replace try/catch with neverthrow)**

Add import at top of categories.tsx:
```tsx
import { fromPromise } from "neverthrow";
```

Replace `handleExport`:
```tsx
const handleExport = useCallback(async () => {
   const result = await fromPromise(
      orpc.categories.exportAll.call({}),
      (e) => e,
   );
   if (result.isErr()) {
      toast.error("Erro ao exportar categorias.");
      return;
   }
   exportCategoriesCsv(result.value);
   toast.success("Categorias exportadas com sucesso.");
}, []);
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/export-categories-csv.ts \
        apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "fix(categories): export subcategories in CSV and replace try/catch with neverthrow (B4/P1)"
```

---

## Phase 4 — UX Fixes (U2, U3, U4, U9)

### Task 6: Collapse import/export into DropdownMenu (U2)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Context:**
Header currently has 3 buttons at the same level: Importar, Exportar, Nova Categoria. Import and Export should be grouped in a DropdownMenu.

**Step 1: Add DropdownMenu import and restructure header**

Add imports:
```tsx
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { ChevronDown } from "lucide-react";
```

Replace header actions:
```tsx
actions={
   <div className="flex gap-2">
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button variant="outline">
               Importar / Exportar
               <ChevronDown />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleImport}>
               <Upload />
               Importar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExport}>
               <Download />
               Exportar CSV
            </DropdownMenuItem>
         </DropdownMenuContent>
      </DropdownMenu>
      <Button onClick={handleCreate}>
         <Plus />
         Nova Categoria
      </Button>
   </div>
}
```

Remove individual `Upload`, `Download` imports if no longer used elsewhere in the file.

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): group import/export in DropdownMenu (U2)"
```

---

### Task 7: Add bulk archive to SelectionActionBar (U3)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Context:**
`SelectionActionBar` only has delete. Add bulk archive via the existing `archive` procedure in a loop (no bulk archive endpoint exists yet — use `Promise.allSettled` pattern).

**Step 1: Add bulkArchiveMutation and handler in CategoriesList**

After `archiveMutation`, add:
```tsx
const bulkArchiveMutation = useMutation(
   orpc.categories.archive.mutationOptions({
      meta: { skipGlobalInvalidation: true },
      onError: (e) =>
         toast.error(e.message || "Erro ao arquivar categorias."),
   }),
);
```

Add handler after `handleBulkDelete`:
```tsx
const handleBulkArchive = useCallback(async () => {
   const archivableIds = selectedIds.filter(
      (id) => !categories.find((c) => c.id === id)?.isDefault,
   );
   if (archivableIds.length === 0) return;
   const results = await Promise.allSettled(
      archivableIds.map((id) => bulkArchiveMutation.mutateAsync({ id })),
   );
   const failed = results.filter((r) => r.status === "rejected").length;
   if (failed > 0) {
      toast.error(`${failed} categoria(s) não puderam ser arquivadas.`);
   } else {
      toast.success(
         `${archivableIds.length} ${archivableIds.length === 1 ? "categoria arquivada" : "categorias arquivadas"}.`,
      );
   }
   onClear();
}, [selectedIds, categories, bulkArchiveMutation, onClear]);
```

Note: After loop, need to manually invalidate. Add import of `useQueryClient`:
```tsx
import { useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
```

Then in `handleBulkArchive` after `onClear()`:
```tsx
queryClient.invalidateQueries({ queryKey: orpc.categories.getAll.queryKey() });
```

Declare `queryClient` at the top of `CategoriesList`:
```tsx
const queryClient = useQueryClient();
```

**Step 2: Add Archive button to SelectionActionBar**

```tsx
<SelectionActionBar onClear={onClear} selectedCount={selectedCount}>
   <SelectionActionButton
      icon={<Archive />}
      onClick={handleBulkArchive}
   >
      Arquivar
   </SelectionActionButton>
   <SelectionActionButton
      icon={<Trash2 />}
      onClick={handleBulkDelete}
      variant="destructive"
   >
      Excluir
   </SelectionActionButton>
</SelectionActionBar>
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): add bulk archive to SelectionActionBar (U3)"
```

---

### Task 8: Add Subcategorias and Palavras-chave count columns (U4)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/categories-columns.tsx`

**Context:**
Currently only 2 columns: Nome, Tipo. Add Subcategorias (count badge) and Palavras-chave (count badge). These are only meaningful for parent rows (depth === 0).

**Step 1: Add columns to buildCategoryColumns**

After the `type` column definition, add:
```tsx
{
   id: "subcategories",
   header: "Subcategorias",
   cell: ({ row }) => {
      if (row.depth > 0) return null;
      const count = row.original.subcategories?.length ?? 0;
      if (count === 0)
         return <span className="text-sm text-muted-foreground">—</span>;
      return <Badge variant="secondary">{count}</Badge>;
   },
},
{
   id: "keywords",
   header: "Palavras-chave",
   cell: ({ row }) => {
      const count = row.original.keywords?.length ?? 0;
      if (count === 0)
         return <span className="text-sm text-muted-foreground">—</span>;
      return <Badge variant="secondary">{count}</Badge>;
   },
},
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-columns.tsx
git commit -m "feat(categories): add subcategories and keywords count columns (U4)"
```

---

### Task 9: Replace segmented control Links with ToggleGroup (U9)

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-filter-bar.tsx`

**Context:**
Current type filter uses custom-styled `<Link>` components inside a border container. Replace with `ToggleGroup` from shadcn.

**Step 1: Replace Link-based segmented control**

Remove imports: `Link` (if no longer used), keep `useRouter`.

Add import:
```tsx
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
```

Replace the `<div className="flex items-center rounded-md border ...">...</div>` block containing the `Link` map with:
```tsx
<ToggleGroup
   type="single"
   value={type ?? "all"}
   onValueChange={(v) => {
      const next = v === "all" || v === "" ? undefined : (v as "income" | "expense");
      navigate({ search: (prev: CategoriesSearch) => ({ ...prev, type: next }) });
   }}
   variant="outline"
   size="sm"
>
   <ToggleGroupItem value="all">Todos</ToggleGroupItem>
   <ToggleGroupItem value="income">Receitas</ToggleGroupItem>
   <ToggleGroupItem value="expense">Despesas</ToggleGroupItem>
</ToggleGroup>
```

Note: `CategoryFilterBar` currently does not have `navigate` — it receives handler props. For the type toggle this uses `Link` to navigate. We need to pass `onTypeChange` or use `navigate` from route. Best approach: add `onTypeChange` prop and pass it from `CategoriesPage`.

Update `CategoryFilterBarProps`:
```typescript
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
```

Add `onTypeChange` to destructuring.

In `CategoriesPage`, add handler:
```tsx
const handleTypeChange = useCallback(
   (value: "income" | "expense" | undefined) => {
      navigate({
         search: (prev: CategoriesSearch) => ({ ...prev, type: value }),
      });
   },
   [navigate],
);
```

Pass to filter bar:
```tsx
<CategoryFilterBar
   ...
   onTypeChange={handleTypeChange}
/>
```

Remove `from` prop usage and `useRouter` import from filter bar if no longer needed (check: `useRouter` is used for `router.preloadRoute` on the archive switch — keep it).

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/category-filter-bar.tsx \
        apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): replace segmented control Links with ToggleGroup (U9)"
```

---

## Phase 5 — Import Rewrite (B1, B2, B3, U1, U6)

### Task 10: Rewrite category-import-credenza.tsx

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx`

**Context:**
This is a full rewrite fixing:
- B1: `handleImport` drops subcategories — must send them as separate items with `parentId`
- B2: Upload area has no drag-and-drop — add `onDrop`/`onDragOver`/`onDragEnter` handlers
- B3: `confirm` step is declared but never reached — remove it or implement a real confirm step
- U1: No stepper visual — use `defineStepper` from `@packages/ui/components/stepper`
- U6: Preview truncates at 20 with no scroll — use `useVirtualizer` from `@tanstack/react-virtual` (already in catalog: `tanstack`)

The `importBatch` router accepts `createCategorySchema[]`. Since `createCategorySchema` includes optional `parentId: z.string().uuid().nullable().optional()`, we can send subcategories with their parent ID — but at import time we don't have IDs yet. We need a two-pass approach: first create parents, then subcategories. This requires updating `importBatch`.

**Update to importBatch router first:**

In `apps/web/src/integrations/orpc/router/categories.ts`, update `importBatch` input schema:
```typescript
export const importBatch = protectedProcedure
   .input(
      z.object({
         categories: z.array(
            createCategorySchema.extend({
               subcategories: z
                  .array(z.object({ name: z.string().min(1).max(100) }))
                  .optional(),
            }),
         ),
      }),
   )
   .handler(async ({ context, input }) => {
      const userRecord = await context.db.query.user.findFirst({
         where: eq(userTable.id, context.userId),
         columns: { stripeCustomerId: true },
      });
      const results = [];
      for (const cat of input.categories) {
         const { subcategories, ...catData } = cat;
         const created = await createCategory(context.db, context.teamId, catData);
         results.push(created);
         startDeriveKeywordsWorkflow({
            categoryId: created.id,
            teamId: context.teamId,
            organizationId: context.organizationId,
            userId: context.userId,
            name: created.name,
            description: created.description,
            stripeCustomerId: userRecord?.stripeCustomerId ?? null,
         });
         if (subcategories && subcategories.length > 0) {
            for (const sub of subcategories) {
               const createdSub = await createCategory(context.db, context.teamId, {
                  name: sub.name,
                  type: catData.type,
                  parentId: created.id,
               });
               results.push(createdSub);
            }
         }
      }
      return results;
   });
```

**Rewrite category-import-credenza.tsx:**

```tsx
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@packages/ui/components/table";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { defineStepper } from "@packages/ui/components/stepper";
import { useMutation } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useCsvFile } from "@/hooks/use-csv-file";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { cn } from "@packages/ui/lib/utils";

// ─── Stepper definition ───────────────────────────────────────────────────────

const { Stepper, steps } = defineStepper(
   { id: "upload", label: "Upload" },
   { id: "mapping", label: "Mapeamento" },
   { id: "preview", label: "Revisão" },
);

// ─── Types ────────────────────────────────────────────────────────────────────

type ParsedRow = Record<string, string>;

const FIELD_OPTIONS = [
   { value: "__skip__", label: "Ignorar" },
   { value: "name", label: "Nome" },
   { value: "type", label: "Tipo" },
   { value: "color", label: "Cor" },
   { value: "icon", label: "Ícone" },
   { value: "keywords", label: "Palavras-chave" },
   { value: "subcategory", label: "Subcategoria" },
   { value: "subcategoryKeywords", label: "Palavras-chave (Sub)" },
];

function guessMapping(headers: string[]): Record<string, string> {
   const mapping: Record<string, string> = {};
   const patterns: Record<string, RegExp> = {
      name: /^(nome|name|categoria|category)$/i,
      type: /^(tipo|type)$/i,
      color: /^(cor|color)$/i,
      icon: /^(icone|ícone|icon)$/i,
      keywords: /^(palavras?.?chave|keywords?)$/i,
      subcategory: /^(subcategoria|subcategory|sub)$/i,
      subcategoryKeywords: /^(palavras?.?chave.*sub|sub.*keywords?)$/i,
   };
   for (const header of headers) {
      let matched = false;
      for (const [field, regex] of Object.entries(patterns)) {
         if (regex.test(header)) {
            mapping[header] = field;
            matched = true;
            break;
         }
      }
      if (!matched) mapping[header] = "__skip__";
   }
   return mapping;
}

interface MappedCategory {
   name: string;
   type: "income" | "expense" | null;
   color: string | null;
   icon: string | null;
   keywords: string[] | null;
   subcategories: { name: string; keywords: string[] | null }[];
   valid: boolean;
}

function applyMapping(
   rows: ParsedRow[],
   headers: string[],
   mapping: Record<string, string>,
): MappedCategory[] {
   const getField = (row: ParsedRow, field: string): string => {
      const header = headers.find((h) => mapping[h] === field);
      return header ? (row[header] ?? "").trim() : "";
   };

   const categoryMap = new Map<string, MappedCategory>();

   for (const row of rows) {
      const name = getField(row, "name");
      if (!name) continue;

      const typeRaw = getField(row, "type").toLowerCase();
      const type =
         typeRaw === "receita" || typeRaw === "income"
            ? ("income" as const)
            : typeRaw === "despesa" || typeRaw === "expense"
              ? ("expense" as const)
              : null;

      const color = getField(row, "color") || null;
      const icon = getField(row, "icon") || null;
      const keywordsRaw = getField(row, "keywords");
      const keywords = keywordsRaw
         ? keywordsRaw.split(/[;,]/).map((k) => k.trim()).filter(Boolean)
         : null;

      const subName = getField(row, "subcategory");
      const subKeywordsRaw = getField(row, "subcategoryKeywords");
      const subKeywords = subKeywordsRaw
         ? subKeywordsRaw.split(/[;,]/).map((k) => k.trim()).filter(Boolean)
         : null;

      if (!categoryMap.has(name)) {
         categoryMap.set(name, { name, type, color, icon, keywords, subcategories: [], valid: type !== null });
      }

      if (subName) {
         categoryMap.get(name)?.subcategories.push({ name: subName, keywords: subKeywords });
      }
   }

   return Array.from(categoryMap.values());
}

// ─── Component ────────────────────────────────────────────────────────────────

interface CategoryImportCredenzaProps {
   onSuccess: () => void;
}

export function CategoryImportCredenza({ onSuccess }: CategoryImportCredenzaProps) {
   const [headers, setHeaders] = useState<string[]>([]);
   const [rows, setRows] = useState<ParsedRow[]>([]);
   const [mapping, setMapping] = useState<Record<string, string>>({});
   const [mapped, setMapped] = useState<MappedCategory[]>([]);
   const [isDragging, setIsDragging] = useState(false);
   const previewRef = useRef<HTMLDivElement>(null);

   const importMutation = useMutation(
      orpc.categories.importBatch.mutationOptions({
         onSuccess: () => {
            toast.success("Categorias importadas com sucesso.");
            onSuccess();
         },
         onError: (e) => {
            toast.error(e.message || "Erro ao importar categorias.");
         },
      }),
   );

   const { parse } = useCsvFile();

   const processFile = useCallback(
      (file: File) => {
         parse(file).then(({ headers: parsedHeaders, rows: parsedRows }) => {
            const parsedRow = parsedRows.map((fields) => {
               const row: ParsedRow = {};
               for (let i = 0; i < parsedHeaders.length; i++) {
                  row[parsedHeaders[i]] = fields[i] ?? "";
               }
               return row;
            });
            setHeaders(parsedHeaders);
            setRows(parsedRow);
            setMapping(guessMapping(parsedHeaders));
         });
      },
      [parse],
   );

   const validCount = mapped.filter((c) => c.valid).length;
   const invalidCount = mapped.filter((c) => !c.valid).length;

   // Virtualizer for preview table
   const rowVirtualizer = useVirtualizer({
      count: mapped.length,
      getScrollElement: () => previewRef.current,
      estimateSize: () => 48,
      overscan: 5,
   });

   return (
      <Stepper.Provider>
         {({ methods }) => (
            <>
               <CredenzaHeader>
                  <CredenzaTitle>Importar Categorias</CredenzaTitle>
                  <CredenzaDescription>
                     {methods.current.id === "upload" && "Faça upload de um arquivo CSV com suas categorias."}
                     {methods.current.id === "mapping" && "Mapeie as colunas do CSV para os campos corretos."}
                     {methods.current.id === "preview" && `${validCount} categorias serão importadas${invalidCount > 0 ? `, ${invalidCount} inválidas` : ""}.`}
                  </CredenzaDescription>
                  {/* Step bar */}
                  <div className="flex gap-2 mt-2">
                     {steps.map((step, index) => (
                        <div className="flex items-center gap-2" key={step.id}>
                           <div
                              className={cn(
                                 "flex size-6 items-center justify-center rounded-full text-xs font-medium",
                                 methods.current.id === step.id
                                    ? "bg-primary text-primary-foreground"
                                    : methods.isCompleted(step)
                                      ? "bg-primary/20 text-primary"
                                      : "bg-muted text-muted-foreground",
                              )}
                           >
                              {index + 1}
                           </div>
                           <span className={cn(
                              "text-sm",
                              methods.current.id === step.id ? "font-medium" : "text-muted-foreground",
                           )}>
                              {step.label}
                           </span>
                           {index < steps.length - 1 && (
                              <div className="h-px w-8 bg-border" />
                           )}
                        </div>
                     ))}
                  </div>
               </CredenzaHeader>

               <CredenzaBody className="px-4">
                  <Stepper.Step of="upload">
                     <label
                        className={cn(
                           "flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
                           isDragging ? "border-primary bg-primary/5" : "hover:border-primary",
                        )}
                        onDragEnter={(e) => {
                           e.preventDefault();
                           setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                           e.preventDefault();
                           setIsDragging(false);
                           const file = e.dataTransfer.files?.[0];
                           if (file?.name.endsWith(".csv")) {
                              processFile(file);
                              methods.next();
                           }
                        }}
                     >
                        <Upload className="size-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground text-center">
                           Clique para selecionar ou arraste um arquivo CSV
                        </span>
                        <input
                           accept=".csv"
                           className="hidden"
                           onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                 processFile(file);
                                 methods.next();
                              }
                           }}
                           type="file"
                        />
                     </label>
                  </Stepper.Step>

                  <Stepper.Step of="mapping">
                     <div className="flex flex-col gap-4">
                        <p className="text-sm text-muted-foreground">
                           {rows.length} linhas encontradas. Mapeie as colunas:
                        </p>
                        {headers.map((header) => (
                           <div className="flex items-center gap-4" key={header}>
                              <span className="text-sm font-medium w-1/3 truncate">
                                 {header}
                              </span>
                              <Select
                                 onValueChange={(v) =>
                                    setMapping((prev) => ({ ...prev, [header]: v }))
                                 }
                                 value={mapping[header] ?? "__skip__"}
                              >
                                 <SelectTrigger className="w-2/3">
                                    <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {FIELD_OPTIONS.map((opt) => (
                                       <SelectItem key={opt.value} value={opt.value}>
                                          {opt.label}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </div>
                        ))}
                     </div>
                  </Stepper.Step>

                  <Stepper.Step of="preview">
                     <div className="flex flex-col gap-4">
                        <div className="flex gap-4 text-sm">
                           <span className="text-muted-foreground">
                              Total: <strong>{mapped.length}</strong>
                           </span>
                           {invalidCount > 0 && (
                              <span className="text-destructive">
                                 Inválidas: <strong>{invalidCount}</strong>
                              </span>
                           )}
                        </div>
                        <ScrollArea className="h-72" ref={previewRef}>
                           <Table>
                              <TableHeader>
                                 <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Subcategorias</TableHead>
                                    <TableHead>Status</TableHead>
                                 </TableRow>
                              </TableHeader>
                              <TableBody>
                                 <tr style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
                                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                       const cat = mapped[virtualRow.index];
                                       return (
                                          <TableRow
                                             key={cat.name}
                                             style={{
                                                position: "absolute",
                                                top: 0,
                                                transform: `translateY(${virtualRow.start}px)`,
                                                width: "100%",
                                                display: "table",
                                                tableLayout: "fixed",
                                             }}
                                          >
                                             <TableCell className="font-medium">{cat.name}</TableCell>
                                             <TableCell>
                                                {cat.type === "income" ? "Receita" : cat.type === "expense" ? "Despesa" : "—"}
                                             </TableCell>
                                             <TableCell>{cat.subcategories.length}</TableCell>
                                             <TableCell>
                                                {cat.valid ? (
                                                   <CheckCircle2 className="size-4 text-green-600" />
                                                ) : (
                                                   <AlertCircle className="size-4 text-destructive" />
                                                )}
                                             </TableCell>
                                          </TableRow>
                                       );
                                    })}
                                 </tr>
                              </TableBody>
                           </Table>
                        </ScrollArea>
                     </div>
                  </Stepper.Step>
               </CredenzaBody>

               <CredenzaFooter>
                  <Stepper.Step of="mapping">
                     <div className="flex gap-2 w-full">
                        <Button className="flex-1" onClick={() => methods.prev()} variant="outline">
                           Voltar
                        </Button>
                        <Button
                           className="flex-1"
                           onClick={() => {
                              const result = applyMapping(rows, headers, mapping);
                              setMapped(result);
                              methods.next();
                           }}
                        >
                           Continuar
                        </Button>
                     </div>
                  </Stepper.Step>
                  <Stepper.Step of="preview">
                     <div className="flex gap-2 w-full">
                        <Button className="flex-1" onClick={() => methods.prev()} variant="outline">
                           Voltar
                        </Button>
                        <Button
                           className="flex-1"
                           disabled={importMutation.isPending || validCount === 0}
                           onClick={() => {
                              const payload = mapped
                                 .filter((cat) => cat.valid)
                                 .map((cat) => ({
                                    name: cat.name,
                                    type: cat.type as "income" | "expense",
                                    color: cat.color,
                                    icon: cat.icon,
                                    keywords: cat.keywords,
                                    subcategories: cat.subcategories.map((s) => ({
                                       name: s.name,
                                    })),
                                 }));
                              importMutation.mutate({ categories: payload });
                           }}
                        >
                           {importMutation.isPending && <Spinner className="size-4 mr-2" />}
                           Importar {validCount} categorias
                        </Button>
                     </div>
                  </Stepper.Step>
               </CredenzaFooter>
            </>
         )}
      </Stepper.Provider>
   );
}
```

**Important notes:**
- Check the exact `Stepper` API by reading `packages/ui/src/components/stepper.tsx` before implementing — `Stepper.Step of="..."`, `Stepper.Provider`, `methods.next()`, `methods.prev()`, `methods.isCompleted()` may differ. Adjust accordingly.
- `useVirtualizer` from `@tanstack/react-virtual` — the `ref` on `ScrollArea` may not work directly. You may need to get the viewport element. Check `ScrollArea` internals or use a plain `div` with `overflow-auto h-72` instead.
- The `subcategories` field added to `importBatch` input schema needs `createCategorySchema` extended — make sure the router update is committed first.

**Step 2: Commit router change separately first**

```bash
git add apps/web/src/integrations/orpc/router/categories.ts
git commit -m "feat(categories): support subcategories in importBatch payload (B1)"
```

**Step 3: Commit credenza rewrite**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/category-import-credenza.tsx
git commit -m "feat(categories): rewrite import credenza with stepper, drag-drop, virtualizer (B2/B3/U1/U6)"
```

---

## Phase 6 — Server-side Search (U8)

### Task 11: Move search to server-side

**Files:**
- Modify: `apps/web/src/integrations/orpc/router/categories.ts`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Context:**
Currently `search` URL param is used to client-filter `parentCategories` after fetch. As pagination gets added this will break. Move search to `getAll` input.

**Step 1: Update getAll router input**

In `categories.ts`, change `getAllInput`:
```typescript
const getAllInput = z
   .object({
      type: z.enum(["income", "expense"]).optional(),
      includeArchived: z.boolean().optional(),
      search: z.string().optional(),
   })
   .optional();
```

Update handler to pass search to repository:
```typescript
export const getAll = protectedProcedure
   .input(getAllInput)
   .handler(async ({ context, input }) => {
      return listCategories(context.db, context.teamId, {
         type: input?.type,
         includeArchived: input?.includeArchived,
         search: input?.search,
      });
   });
```

**Step 2: Update listCategories repository to accept search**

Check `core/database/src/repositories/categories-repository.ts` for the `listCategories` function signature. Add `search?: string` to options and use SQL `ilike` filter if provided:
```typescript
// In repository options interface, add:
search?: string;

// In query, add condition:
...(search ? [ilike(categories.name, `%${search}%`)] : []),
```

**Step 3: Update categories.tsx**

In `loaderDeps`:
```typescript
loaderDeps: ({ search: { type, includeArchived, search } }) => ({
   type,
   includeArchived,
   search,
}),
```

Update loader:
```typescript
loader: ({ context, deps }) => {
   context.queryClient.prefetchQuery(
      orpc.categories.getAll.queryOptions({
         input: {
            type: deps.type,
            includeArchived: deps.includeArchived || undefined,
            search: deps.search || undefined,
         },
      }),
   );
},
```

In `CategoriesList`, update query input and remove client-side filtering:
```tsx
const { data: result } = useSuspenseQuery(
   orpc.categories.getAll.queryOptions({
      input: {
         type,
         includeArchived: includeArchived || undefined,
         search: search || undefined,
      },
   }),
);

const parentCategories: CategoryRow[] = result
   .filter((c) => c.parentId === null)
   .map((parent) => ({
      ...parent,
      subcategories: result.filter((c) => c.parentId === parent.id),
   }));

// Remove the `categories` filtering — use parentCategories directly
```

**Step 4: Commit**

```bash
git add apps/web/src/integrations/orpc/router/categories.ts \
        core/database/src/repositories/categories-repository.ts \
        apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): move search to server-side in getAll (U8)"
```

---

## Phase 7 — Mobile Card View (U10)

### Task 12: Create card view component

**Files:**
- Create: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/categories-card-view.tsx`
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**Context:**
Add a card view showing each category as a card with subcategories as chips, actions in card footer. A view toggle in header switches between table/card.

**Step 1: Create -categories/categories-card-view.tsx**

```tsx
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import type { CategoryRow } from "./categories-columns";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
   // same map as in categories-columns.tsx — import shared constant if extracted, or duplicate minimal set
};

interface CategoriesCardViewProps {
   categories: CategoryRow[];
   onEdit: (category: CategoryRow) => void;
   onDelete: (category: CategoryRow) => void;
   onArchive: (category: CategoryRow) => void;
   onAddSubcategory: (category: CategoryRow) => void;
}

export function CategoriesCardView({
   categories,
   onEdit,
   onDelete,
   onArchive,
   onAddSubcategory,
}: CategoriesCardViewProps) {
   return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         {categories.map((cat) => {
            // group by type header not needed — handled by parent grouping
            return (
               <div
                  className="flex flex-col rounded-lg border bg-card"
                  key={cat.id}
               >
                  <div className="flex items-center gap-4 p-4">
                     {cat.color && (
                        <div
                           className="size-10 rounded-lg flex items-center justify-center shrink-0"
                           style={{ backgroundColor: cat.color }}
                        />
                     )}
                     <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="font-medium truncate">{cat.name}</span>
                        <Badge
                           variant={cat.type === "income" ? "outline" : "destructive"}
                           className={cat.type === "income" ? "border-green-600 text-green-600 w-fit" : "w-fit"}
                        >
                           {cat.type === "income" ? "Receita" : "Despesa"}
                        </Badge>
                     </div>
                  </div>

                  {cat.subcategories && cat.subcategories.length > 0 && (
                     <div className="px-4 pb-4 flex flex-wrap gap-2">
                        {cat.subcategories.map((sub) => (
                           <Badge key={sub.id} variant="secondary">
                              {sub.name}
                           </Badge>
                        ))}
                     </div>
                  )}

                  {!cat.isDefault && (
                     <div className="flex gap-2 border-t px-4 py-2">
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
                        <Button
                           className="text-destructive hover:text-destructive ml-auto"
                           onClick={() => onDelete(cat)}
                           size="sm"
                           tooltip="Excluir"
                           variant="ghost"
                        >
                           <Trash2 />
                        </Button>
                     </div>
                  )}
               </div>
            );
         })}
      </div>
   );
}
```

**Step 2: Add view toggle state and ViewToggle to CategoriesPage**

In `categories.tsx` add imports:
```tsx
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { useMediaQuery } from "foxact/use-media-query";
import { LayoutGrid, LayoutList } from "lucide-react";
import { CategoriesCardView } from "./-categories/categories-card-view";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
```

Add view state at module level:
```tsx
const [useCategoriesView] = createLocalStorageState<"table" | "card">(
   "montte:categories:view",
   "table",
);
```

In `CategoriesPage`, add view state:
```tsx
const isMobile = useMediaQuery("(max-width: 640px)");
const [view, setView] = useCategoriesView();
const effectiveView = isMobile ? "card" : view;
```

Add view toggle to header actions (before the dropdown):
```tsx
<ToggleGroup
   type="single"
   value={effectiveView}
   onValueChange={(v) => {
      if (v === "table" || v === "card") setView(v);
   }}
   variant="outline"
   size="sm"
>
   <ToggleGroupItem value="table">
      <LayoutList />
   </ToggleGroupItem>
   <ToggleGroupItem value="card">
      <LayoutGrid />
   </ToggleGroupItem>
</ToggleGroup>
```

Pass `view={effectiveView}` to `CategoriesList`:
```tsx
<CategoriesList navigate={navigate} view={effectiveView} />
```

Update `CategoriesListProps`:
```tsx
interface CategoriesListProps {
   navigate: ReturnType<typeof Route.useNavigate>;
   view: "table" | "card";
}
```

In `CategoriesList`, conditionally render card or table view. For card view, skip `DataTable` and use `CategoriesCardView` instead (passing the same handlers).

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-categories/categories-card-view.tsx \
        apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): add mobile card view with view toggle (U10)"
```

---

## Execution Order

Phases are largely independent. Suggested order for minimal merge conflicts:

1. **Task 2, 3** (form.Subscribe fix) — quick, no deps
2. **Task 4** (gap/icon/separator fixes) — quick, no deps  
3. **Task 1** (skeleton) — quick, no deps
4. **Task 5** (export fix) — no deps
5. **Task 6** (header dropdown) — no deps
6. **Task 7** (bulk archive) — no deps
7. **Task 8** (count columns) — no deps
8. **Task 9** (ToggleGroup) — needs `onTypeChange` prop plumbing
9. **Task 10** (import rewrite) — router change first, then credenza
10. **Task 11** (server-side search) — needs repository check
11. **Task 12** (card view) — depends on Task 6 (view toggle in header)

Parallel dispatch opportunity: Tasks 2, 3, 4, 5 can all run in parallel (different files, no overlaps).

---

## Notes for Implementer

- Always check the exact `Stepper` API in `packages/ui/src/components/stepper.tsx` before writing import credenza — the `defineStepper` pattern uses `@stepperize/react` under the hood.
- `useVirtualizer` ref may require accessing `ScrollArea`'s inner viewport element — check `packages/ui/src/components/scroll-area.tsx` for forwarded ref or use a plain `div` instead.
- The `bulkArchive` in Task 7 loops individual `archive` mutations with `skipGlobalInvalidation: true` — remember to manually call `queryClient.invalidateQueries` after all settle.
- `listCategories` repository needs to be checked for its current signature before adding `search` param in Task 11.
