# Categories — Skeleton, View Switch, WCAG & Form Validators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship realistic skeletons, context-scoped view-switch state, TanStack Form validators, and WCAG 2.2 accessibility fixes across the categories feature.

**Architecture:** Four independent tasks, each touching a distinct set of files. No shared state introduced. All UI-only changes — no server/API layer touched. No new files created.

**Tech Stack:** TanStack Start, React, `foxact/create-context-state`, `@packages/ui/components/*`, TanStack Form validators API, ARIA attributes.

---

## Context — files involved

| File | Purpose |
|---|---|
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx` | Route + skeletons + view switch |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-filter-bar.tsx` | Filter bar — WCAG |
| `apps/web/src/features/categories/ui/categories-form.tsx` | Category form — validators + WCAG |
| `apps/web/src/features/categories/ui/subcategory-form.tsx` | Subcategory form — validator |
| `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx` | Import wizard — WCAG + MapStep scroll |

---

### Task 1: Realistic skeletons + context-scoped view switch

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx`

**What to build:**

Replace the two existing flat skeletons with three realistic ones that mirror the actual UI structure. Replace `createLocalStorageState` for view with `createContextState<"table" | "card">` (non-persisted, SSR-safe).

---

**Step 1: Read the file**

The file is already read (provided in plan context). Proceed.

---

**Step 2: Replace the three skeleton functions + view state**

Replace the existing module-level view state line:
```typescript
const [useCategoriesView] = createLocalStorageState<"table" | "card">(
   "montte:categories:view",
   "table",
);
```

With:
```typescript
const [CategoriesViewProvider, useCategoriesView, useSetCategoriesView] =
   createContextState<"table" | "card">("table");
```

Add `createContextState` to the foxact import:
```typescript
import { createContextState } from "foxact/create-context-state";
import { createLocalStorageState } from "foxact/create-local-storage-state";
```

Keep `createLocalStorageState` for the table state (`montte:datatable:categories`).

---

**Step 3: Replace `CategoriesTableSkeleton`**

Replace the entire `CategoriesTableSkeleton` function with this realistic one:

```typescript
function CategoriesTableSkeleton() {
   return (
      <div className="rounded-md border overflow-hidden">
         {/* Header row */}
         <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-10" />
            <div className="flex-1" />
            <Skeleton className="h-4 w-10" />
            <div className="flex gap-2">
               <Skeleton className="size-8 rounded" />
               <Skeleton className="size-8 rounded" />
               <Skeleton className="size-8 rounded" />
               <Skeleton className="size-8 rounded" />
            </div>
         </div>

         {/* Group: Receitas */}
         <div className="flex items-center gap-2 px-4 py-2 bg-muted/10 border-b">
            <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <Skeleton className="h-4 w-16" />
         </div>
         {/* 3 parent rows, first has 2 sub-rows */}
         {[{ w: "w-32", subs: 2 }, { w: "w-44", subs: 0 }, { w: "w-24", subs: 0 }].map(
            ({ w, subs }, i) => (
               <div key={`income-row-${i + 1}`}>
                  <div className="flex items-center gap-4 px-4 py-3 border-b">
                     <Skeleton className="size-4 rounded" />
                     <Skeleton className="size-8 rounded-lg" />
                     <Skeleton className={`h-4 ${w}`} />
                     <div className="flex-1" />
                     <Skeleton className="h-5 w-16 rounded-full" />
                     <div className="flex gap-2">
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                     </div>
                  </div>
                  {Array.from({ length: subs }).map((_, si) => (
                     <div
                        className="flex items-center gap-4 px-4 py-2.5 border-b pl-16 bg-muted/10"
                        key={`income-sub-${i + 1}-${si + 1}`}
                     >
                        <Skeleton className="size-4 rounded" />
                        <Skeleton className="h-4 w-28" />
                        <div className="flex-1" />
                        <div className="flex gap-2">
                           <Skeleton className="size-8 rounded" />
                           <Skeleton className="size-8 rounded" />
                        </div>
                     </div>
                  ))}
               </div>
            ),
         )}

         {/* Group: Despesas */}
         <div className="flex items-center gap-2 px-4 py-2 bg-muted/10 border-b">
            <span className="size-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <Skeleton className="h-4 w-20" />
         </div>
         {[{ w: "w-36", subs: 0 }, { w: "w-28", subs: 1 }, { w: "w-40", subs: 0 }, { w: "w-24", subs: 0 }].map(
            ({ w, subs }, i) => (
               <div key={`expense-row-${i + 1}`}>
                  <div className="flex items-center gap-4 px-4 py-3 border-b last:border-b-0">
                     <Skeleton className="size-4 rounded" />
                     <Skeleton className="size-8 rounded-lg" />
                     <Skeleton className={`h-4 ${w}`} />
                     <div className="flex-1" />
                     <Skeleton className="h-5 w-16 rounded-full" />
                     <div className="flex gap-2">
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                        <Skeleton className="size-8 rounded" />
                     </div>
                  </div>
                  {Array.from({ length: subs }).map((_, si) => (
                     <div
                        className="flex items-center gap-4 px-4 py-2.5 border-b last:border-b-0 pl-16 bg-muted/10"
                        key={`expense-sub-${i + 1}-${si + 1}`}
                     >
                        <Skeleton className="size-4 rounded" />
                        <Skeleton className="h-4 w-28" />
                        <div className="flex-1" />
                        <div className="flex gap-2">
                           <Skeleton className="size-8 rounded" />
                           <Skeleton className="size-8 rounded" />
                        </div>
                     </div>
                  ))}
               </div>
            ),
         )}
      </div>
   );
}
```

---

**Step 4: Add `CategoriesCardSkeleton`**

Add this new function after `CategoriesTableSkeleton`:

```typescript
function CategoriesCardSkeleton() {
   return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
         {Array.from({ length: 6 }).map((_, i) => (
            <div
               className="flex flex-col rounded-lg border bg-card overflow-hidden"
               key={`card-skel-${i + 1}`}
            >
               <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <Skeleton className="size-4 rounded" />
                  <Skeleton className="h-5 w-14 rounded-full" />
               </div>
               <div className="flex items-center gap-4 px-4 pb-4">
                  <Skeleton className="size-10 rounded-lg shrink-0" />
                  <Skeleton className="h-4 w-32" />
               </div>
               <div className="border-t px-4 py-3 flex flex-wrap gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
               </div>
               <div className="border-t flex items-center gap-2 px-4 py-2">
                  <Skeleton className="size-8 rounded" />
                  <Skeleton className="size-8 rounded" />
                  <Skeleton className="size-8 rounded" />
                  <div className="flex-1" />
                  <Skeleton className="size-8 rounded" />
               </div>
            </div>
         ))}
      </div>
   );
}
```

---

**Step 5: Replace `CategoriesSkeleton`**

Replace the existing `CategoriesSkeleton` with one that has 3 action buttons and a richer filter bar:

```typescript
function CategoriesSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
               <Skeleton className="h-8 w-36" />
               <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
               <Skeleton className="h-9 w-20 rounded-md" />
               <Skeleton className="h-9 w-9 rounded-md" />
               <Skeleton className="h-9 w-36 rounded-md" />
            </div>
         </div>
         <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
               <Skeleton className="h-9 flex-1" />
               <Skeleton className="h-9 w-64 rounded-md" />
            </div>
            <div className="flex items-center gap-2">
               <Skeleton className="h-9 w-28 rounded-md" />
               <Skeleton className="h-9 w-32 rounded-md" />
            </div>
         </div>
         <CategoriesTableSkeleton />
      </div>
   );
}
```

---

**Step 6: Refactor `CategoriesPage` → `CategoriesPage` (provider wrapper) + `CategoriesPageContent`**

The `CategoriesPage` function currently mixes view state + all the page logic. Split it:

1. Rename the current `CategoriesPage` body to `CategoriesPageContent`
2. Create a new thin `CategoriesPage` that wraps with the provider:

```typescript
// New outer wrapper (replaces old CategoriesPage as route component)
function CategoriesPage() {
   const isMobile = useMediaQuery("(max-width: 640px)");
   return (
      <CategoriesViewProvider initialState={isMobile ? "card" : "table"}>
         <CategoriesPageContent />
      </CategoriesViewProvider>
   );
}
```

Inside `CategoriesPageContent` (the renamed former `CategoriesPage`):
- Replace `const [view, setView] = useCategoriesView();` with:
  ```typescript
  const view = useCategoriesView();
  const setView = useSetCategoriesView();
  ```
- Remove `const effectiveView: "table" | "card" = isMobile ? "card" : view;` — `view` is now directly correct since initial state was set by provider
- Remove `const isMobile = useMediaQuery("(max-width: 640px)");` from `CategoriesPageContent`
- Replace every `effectiveView` reference with `view`

Update `QueryBoundary` fallback to use view-aware skeleton:
```tsx
<QueryBoundary
   fallback={view === "card" ? <CategoriesCardSkeleton /> : <CategoriesTableSkeleton />}
   errorTitle="Erro ao carregar categorias"
>
   <CategoriesList navigate={navigate} view={view} />
</QueryBoundary>
```

---

**Step 7: Remove `useMediaQuery` from the imports if no longer used in `CategoriesPageContent`**

`useMediaQuery` is now only in `CategoriesPage` (outer). The import stays. No change needed.

---

**Step 8: Verify typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -50
```

Expected: 0 errors.

---

**Step 9: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/categories.tsx
git commit -m "feat(categories): realistic skeletons + context-scoped view switch"
```

---

### Task 2: TanStack Form validators + form WCAG fixes

**Files:**
- Modify: `apps/web/src/features/categories/ui/categories-form.tsx`
- Modify: `apps/web/src/features/categories/ui/subcategory-form.tsx`

**What to build:**

- [F1] Add `onChange` validators to `name` field in both forms — currently the asterisk promises "required" but no validation runs, allowing empty submit
- [F2] Wire `field.handleBlur` to the `type` Select in `CategoryForm` — without it `isTouched` never flips for that field
- [W5] `aria-label` on each subcategory removal `<button>` (currently icon-only, screen reader says just "button")
- [W6] `aria-label="Adicionar subcategoria"` on the raw `<input>` tag inside the subcategory chips widget
- [W7] Replace `title="Aleatorizar ícone e cor"` with `aria-label="Aleatorizar ícone e cor"` on the Shuffle `<Button>`

---

**Step 1: Edit `categories-form.tsx` — F1 (name validator)**

Locate the `form.Field name="name"` block (around line 262). Add validators:

```typescript
<form.Field
   name="name"
   validators={{
      onChange: ({ value }) =>
         !value.trim() ? "Nome é obrigatório" : undefined,
   }}
   children={(field) => {
```

---

**Step 2: Edit `categories-form.tsx` — F2 (type field handleBlur)**

Locate `form.Field name="type"` (around line 293). The `<Select>` lacks `onOpenChange` or blur wiring. Add `onOpenChange` to handle blur when the select closes:

```tsx
<form.Field
   name="type"
   children={(field) => (
      <Field>
         <FieldLabel>Tipo</FieldLabel>
         <Select
            onValueChange={(v) =>
               field.handleChange(v as "income" | "expense")
            }
            onOpenChange={(open) => {
               if (!open) field.handleBlur();
            }}
            value={field.state.value}
         >
```

---

**Step 3: Edit `categories-form.tsx` — W7 (Shuffle button aria-label)**

Locate `<Button title="Aleatorizar ícone e cor"` (around line 365). Replace `title` with `aria-label`:

```tsx
<Button
   aria-label="Aleatorizar ícone e cor"
   onClick={() => {
      form.setFieldValue("icon", randomIcon());
      form.setFieldValue("color", randomColor());
   }}
   size="sm"
   type="button"
   variant="ghost"
>
   <Shuffle aria-hidden="true" className="size-3.5" />
</Button>
```

Also add `aria-hidden="true"` to the `<Shuffle />` icon inside since the button now has a text label via `aria-label`.

---

**Step 4: Edit `categories-form.tsx` — W5 (subcategory remove buttons aria-label)**

Locate the removal `<button>` inside `pendingSubcategories.map` (around line 487). Add `aria-label`:

```tsx
<button
   aria-label={`Remover subcategoria ${name}`}
   className="text-secondary-foreground/50 hover:text-secondary-foreground transition-colors"
   onClick={(e) => {
      e.stopPropagation();
      removeSubcategory(i);
   }}
   type="button"
>
   <X aria-hidden="true" className="size-3" />
</button>
```

---

**Step 5: Edit `categories-form.tsx` — W6 (subcategory input aria-label)**

Locate the raw `<input>` (around line 499). Add `aria-label` and `id`:

```tsx
<input
   aria-label="Adicionar subcategoria"
   className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
   id="subcategory-input"
   onKeyDown={(e) => {
```

---

**Step 6: Edit `subcategory-form.tsx` — F1 (name validator)**

Locate `form.Field name="name"` (around line 104). Add validators:

```typescript
<form.Field
   name="name"
   validators={{
      onChange: ({ value }) =>
         !value.trim() ? "Nome é obrigatório" : undefined,
   }}
   children={(field) => {
```

---

**Step 7: Verify typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -50
```

Expected: 0 errors.

---

**Step 8: Commit**

```bash
git add apps/web/src/features/categories/ui/categories-form.tsx \
        apps/web/src/features/categories/ui/subcategory-form.tsx
git commit -m "fix(categories): form validators + WCAG aria labels on form controls"
```

---

### Task 3: WCAG fixes — category-filter-bar.tsx

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-filter-bar.tsx`

**What to build:**

- [W1] Add `aria-label="Buscar categorias"` to search `<Input>` — placeholder is not a label substitute
- [W2] Add `aria-label="Filtrar por tipo"` to the `ToggleGroup` — it behaves as a group control without a name
- [W4] Add `aria-hidden="true"` to all decorative icons inside `Toggle` and `ToggleGroupItem` buttons that already have text labels

---

**Step 1: Edit `category-filter-bar.tsx` — W1**

Locate `<Input` (around line 67). Add `aria-label`:

```tsx
<Input
   aria-label="Buscar categorias"
   className="pl-9"
   onChange={(e) => {
      setInputValue(e.target.value);
      debouncedOnSearchChange(e.target.value);
   }}
   placeholder="Buscar por nome ou palavra-chave..."
   value={inputValue}
/>
```

---

**Step 2: Edit `category-filter-bar.tsx` — W2**

Add `aria-label` to the `ToggleGroup` (around line 77):

```tsx
<ToggleGroup
   aria-label="Filtrar por tipo"
   onValueChange={(v) => {
```

---

**Step 3: Edit `category-filter-bar.tsx` — W4**

Add `aria-hidden="true"` to decorative icons in ToggleGroupItems and Toggles.

In `ToggleGroupItem`s (around lines 89–100):
```tsx
<ToggleGroupItem className="gap-2 px-4" value="all">
   <Layers aria-hidden="true" className="size-4" />
   Todos
</ToggleGroupItem>
<ToggleGroupItem className="gap-2 px-4" value="income">
   <TrendingUp aria-hidden="true" className="size-4" />
   Receitas
</ToggleGroupItem>
<ToggleGroupItem className="gap-2 px-4" value="expense">
   <TrendingDown aria-hidden="true" className="size-4" />
   Despesas
</ToggleGroupItem>
```

In the `Toggle` buttons (around lines 118–142):
```tsx
<Toggle aria-label="Mostrar arquivadas" ...>
   <Archive aria-hidden="true" className="size-4" />
   Arquivadas
</Toggle>
...
<Toggle aria-label="Agrupar por tipo" ...>
   <LayoutList aria-hidden="true" className="size-4" />
   Agrupar por tipo
</Toggle>
```

In the clear filters button (around line 148):
```tsx
<X aria-hidden="true" className="size-3" />
```

---

**Step 4: Verify typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -50
```

Expected: 0 errors.

---

**Step 5: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-filter-bar.tsx
git commit -m "fix(categories): WCAG aria labels and hidden icons in filter bar"
```

---

### Task 4: WCAG fixes + MapStep scroll — category-import-credenza.tsx

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx`

**What to build:**

- [W8] `PreviewStep` status icons: add `aria-hidden="true"` + `<span className="sr-only">` for screen reader text
- [W9] `MapStep` `Combobox` elements: each needs an accessible label identifying which CSV column it maps
- [W10] `UploadStep` decorative `FileSpreadsheet` icons: add `aria-hidden="true"`
- [V2] `MapStep` headers list: wrap in `<ScrollArea className="max-h-80">` to prevent overflow when CSV has many columns

---

**Step 1: Add `ScrollArea` import**

At the top of `category-import-credenza.tsx`, add:
```typescript
import { ScrollArea } from "@packages/ui/components/scroll-area";
```

---

**Step 2: Edit MapStep — V2 (scroll) + W9 (Combobox label)**

Locate the `<div className="flex flex-col gap-2">` that wraps `rawData.headers.map(...)` (around line 281). Wrap it with `ScrollArea`:

```tsx
<ScrollArea className="max-h-80">
   <div className="flex flex-col gap-2">
      {rawData.headers.map((header) => {
         const sample = getSampleValues(rawData, header);
         return (
            <div
               className="grid grid-cols-[10rem_1fr] items-start gap-2 rounded-lg border bg-muted/20 px-3 py-2.5 overflow-hidden"
               key={header}
            >
               <div className="flex flex-col gap-2 pt-1">
                  <span className="text-sm font-medium" id={`col-label-${header}`}>
                     {header}
                  </span>
                  {sample && (
                     <span className="text-xs text-muted-foreground truncate">
                        {sample}
                     </span>
                  )}
               </div>
               <Combobox
                  aria-label={`Mapear coluna "${header}"`}
                  options={FIELD_OPTIONS}
                  value={mapping[header] ?? "__skip__"}
                  onValueChange={(v) =>
                     setMapping({ ...mapping, [header]: v })
                  }
               />
            </div>
         );
      })}
   </div>
</ScrollArea>
```

Note: `Combobox` from `@packages/ui` renders a `Button` trigger. The `aria-label` prop will need to be passed through. Check if `Combobox` forwards ARIA props. If it does not, wrap the trigger area with a `<div role="group" aria-label={...}>` instead.

---

**Step 3: Edit PreviewStep — W8 (status icons with sr-only text)**

Locate the status icon render in `PreviewStep` (around lines 418–423):

Replace:
```tsx
{cat.valid ? (
   <CheckCircle2 className="size-4 text-green-600" />
) : (
   <AlertCircle className="size-4 text-destructive" />
)}
```

With:
```tsx
{cat.valid ? (
   <>
      <CheckCircle2 aria-hidden="true" className="size-4 text-green-600" />
      <span className="sr-only">Válido</span>
   </>
) : (
   <>
      <AlertCircle aria-hidden="true" className="size-4 text-destructive" />
      <span className="sr-only">Inválido: sem tipo definido</span>
   </>
)}
```

---

**Step 4: Edit UploadStep — W10 (decorative icons aria-hidden)**

Locate the `DropzoneEmptyState` block (around lines 191–207). Add `aria-hidden="true"` to decorative `FileSpreadsheet` icons:

```tsx
<DropzoneEmptyState>
   {isPending ? (
      <Loader2 className="size-8 text-primary animate-spin" />
   ) : (
      <>
         <FileSpreadsheet aria-hidden="true" className="size-8 text-muted-foreground" />
         <p className="font-medium text-sm">
            Arraste e solte ou clique para selecionar
         </p>
         <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1">
            <FileSpreadsheet aria-hidden="true" className="size-3.5 text-emerald-600" />
            <span className="text-xs font-medium">CSV</span>
         </div>
      </>
   )}
</DropzoneEmptyState>
```

---

**Step 5: Verify typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | head -50
```

Expected: 0 errors. If `Combobox` doesn't accept `aria-label`, the error will surface here — see note in Step 2 for fallback approach.

---

**Step 6: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-categories/category-import-credenza.tsx
git commit -m "fix(categories): WCAG sr-only status text, icon aria-hidden, MapStep scroll"
```

---

## Verification checklist (manual, after all tasks)

- [ ] Page loads — skeleton visible during `pendingMs` delay
- [ ] Card view shows `CategoriesCardSkeleton` while loading
- [ ] Table view shows `CategoriesTableSkeleton` while loading  
- [ ] View switch (table/card toggle) works
- [ ] Mobile (< 640px): page opens directly in card view
- [ ] Category form: submitting with empty name shows "Nome é obrigatório"
- [ ] Subcategory form: submitting with empty name shows "Nome é obrigatório"
- [ ] Category form: `type` field blur fires after closing the Select
- [ ] Filter bar search: screen reader announces "Buscar categorias"
- [ ] Import wizard MapStep: scrolls when CSV has 10+ columns
- [ ] Import wizard PreviewStep: screen reader announces "Válido"/"Inválido"
