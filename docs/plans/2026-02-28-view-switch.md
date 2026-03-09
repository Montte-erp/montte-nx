# View Switch Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a view switch dropdown button to `DefaultHeader` that lets finance pages toggle between table and card views, with preference persisted in localStorage.

**Architecture:** A shared `view-switch` feature provides `useViewSwitch` (localStorage-backed hook) and `ViewSwitchDropdown` (icon button + dropdown). `DefaultHeader` gains a `viewSwitch?: ReactNode` slot. Each finance route calls the hook, passes the dropdown to the header, and conditionally renders its own table/card view.

**Tech Stack:** React, lucide-react, `@packages/ui/components/dropdown-menu`, `@packages/ui/components/button`, `useSafeLocalStorage` from `@/hooks/use-local-storage`

---

## Task 1: Create `useViewSwitch` hook

**Files:**

- Create: `apps/web/src/features/view-switch/hooks/use-view-switch.ts`

**Step 1: Create the file**

```ts
import type { ReactNode } from "react";
import { useSafeLocalStorage } from "@/hooks/use-local-storage";

export interface ViewConfig<T extends string = string> {
   id: T;
   label: string;
   icon: ReactNode;
}

export function useViewSwitch<T extends string>(
   storageKey: string,
   views: ViewConfig<T>[],
): { currentView: T; setView: (id: T) => void; views: ViewConfig<T>[] } {
   const [currentView, setView] = useSafeLocalStorage<T>(
      storageKey,
      views[0].id,
   );
   return { currentView, setView, views };
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/view-switch/hooks/use-view-switch.ts
git commit -m "feat(view-switch): add useViewSwitch hook with localStorage persistence"
```

---

## Task 2: Create `ViewSwitchDropdown` component

**Files:**

- Create: `apps/web/src/features/view-switch/ui/view-switch-dropdown.tsx`

**Step 1: Create the file**

```tsx
import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Check } from "lucide-react";
import type { ViewConfig } from "../hooks/use-view-switch";

interface ViewSwitchDropdownProps<T extends string> {
   views: ViewConfig<T>[];
   currentView: T;
   onViewChange: (id: T) => void;
}

export function ViewSwitchDropdown<T extends string>({
   views,
   currentView,
   onViewChange,
}: ViewSwitchDropdownProps<T>) {
   const active = views.find((v) => v.id === currentView) ?? views[0];

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="outline" type="button">
               {active.icon}
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="end">
            <DropdownMenuLabel>Visualização</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {views.map((view) => (
               <DropdownMenuItem
                  className="flex items-center justify-between gap-4"
                  key={view.id}
                  onClick={() => onViewChange(view.id)}
               >
                  <span className="flex items-center gap-2">
                     {view.icon}
                     {view.label}
                  </span>
                  {currentView === view.id && <Check className="size-4" />}
               </DropdownMenuItem>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/view-switch/ui/view-switch-dropdown.tsx
git commit -m "feat(view-switch): add ViewSwitchDropdown component"
```

---

## Task 3: Update `DefaultHeader` to accept `viewSwitch` slot

**Files:**

- Modify: `apps/web/src/components/default-header.tsx`

**Step 1: Add `viewSwitch` prop and render it in actions**

Current `DefaultHeader` wraps `PageHeader` and passes `actions` through. Add `viewSwitch?: ReactNode` and render it before the route's `actions` inside `PageHeader.actions`.

Replace the file content with:

```tsx
import type { ReactNode } from "react";
import { PageHeader } from "./page-header";

interface DefaultHeaderProps {
   title: string;
   description: ReactNode;
   actions?: ReactNode;
   /** Secondary actions shown below the title (e.g., filter chips) */
   secondaryActions?: ReactNode;
   /** View switch dropdown rendered in the actions area */
   viewSwitch?: ReactNode;
}

export function DefaultHeader({
   title,
   description,
   actions,
   secondaryActions,
   viewSwitch,
}: DefaultHeaderProps) {
   return (
      <div className="flex flex-col gap-4">
         <PageHeader
            actions={
               <>
                  {viewSwitch}
                  {actions}
               </>
            }
            description={description}
            title={title}
         />
         {secondaryActions != null && (
            <div className="flex flex-wrap items-center gap-4">
               {secondaryActions}
            </div>
         )}
      </div>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/default-header.tsx
git commit -m "feat(default-header): add viewSwitch slot to actions area"
```

---

## Task 4: Wire up Categories page

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/categories.tsx`

**Step 1: Add imports and view switch to `CategoriesPage`**

The page currently uses `PageHeader` directly. Switch to `DefaultHeader` and add the view switch. Add a simple card grid as the card view.

Key changes:

1. Import `DefaultHeader` instead of `PageHeader`
2. Import `useViewSwitch` and `ViewSwitchDropdown`
3. Import `LayoutGrid`, `LayoutList` from lucide-react
4. Move `useViewSwitch` call into `CategoriesPage`
5. Pass `viewSwitch` to `DefaultHeader`
6. Pass `currentView` down to `CategoriesList` and render table or card based on it

```tsx
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
import { FolderOpen, LayoutGrid, LayoutList, Plus } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   type CategoryRow,
   buildCategoryColumns,
} from "@/features/categories/ui/categories-columns";
import { CategorySheet } from "@/features/categories/ui/categories-sheet";
import { useViewSwitch } from "@/features/view-switch/hooks/use-view-switch";
import { ViewSwitchDropdown } from "@/features/view-switch/ui/view-switch-dropdown";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/finance/categories",
)({ component: CategoriesPage });

const CATEGORY_VIEWS = [
   {
      id: "table" as const,
      label: "Tabela",
      icon: <LayoutList className="size-4" />,
   },
   {
      id: "card" as const,
      label: "Cards",
      icon: <LayoutGrid className="size-4" />,
   },
];

// =============================================================================
// Skeleton
// =============================================================================

function CategoriesSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

interface CategoriesListProps {
   view: "table" | "card";
}

function CategoriesList({ view }: CategoriesListProps) {
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const deleteMutation = useMutation(
      orpc.categories.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Categoria excluída com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir categoria.");
         },
      }),
   );

   const handleEdit = useCallback(
      (category: CategoryRow) => {
         openCredenza({
            children: (
               <CategorySheet
                  category={{
                     id: category.id,
                     name: category.name,
                     color: category.color,
                     icon: category.icon,
                     type: category.type,
                  }}
                  mode="edit"
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (category: CategoryRow) => {
         openAlertDialog({
            title: "Excluir categoria",
            description: `Tem certeza que deseja excluir a categoria "${category.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: category.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = buildCategoryColumns(handleEdit, handleDelete);

   if (categories.length === 0) {
      return (
         <Empty>
            <EmptyHeader>
               <EmptyMedia variant="icon">
                  <FolderOpen className="size-6" />
               </EmptyMedia>
               <EmptyTitle>Nenhuma categoria</EmptyTitle>
               <EmptyDescription>
                  Adicione uma categoria para organizar suas transações.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   if (view === "card") {
      return (
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((category) => (
               <div
                  className="rounded-lg border bg-background p-4 space-y-3"
                  key={category.id}
               >
                  <div className="flex items-center gap-2 min-w-0">
                     {category.color && (
                        <span
                           className="size-4 rounded-full shrink-0"
                           style={{ backgroundColor: category.color }}
                        />
                     )}
                     <p className="font-medium truncate">{category.name}</p>
                  </div>
                  {!category.isDefault && (
                     <div className="flex items-center gap-2">
                        <Button
                           onClick={() => handleEdit(category)}
                           size="sm"
                           variant="outline"
                        >
                           Editar
                        </Button>
                        <Button
                           className="text-destructive"
                           onClick={() => handleDelete(category)}
                           size="sm"
                           variant="ghost"
                        >
                           Excluir
                        </Button>
                     </div>
                  )}
               </div>
            ))}
         </div>
      );
   }

   return (
      <DataTable
         columns={columns}
         data={categories}
         getRowId={(row) => row.id}
         renderMobileCard={({ row }) => (
            <div className="rounded-lg border bg-background p-4 space-y-3">
               <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                     {row.original.color && (
                        <span
                           className="size-4 rounded-full shrink-0"
                           style={{ backgroundColor: row.original.color }}
                        />
                     )}
                     <p className="font-medium truncate">{row.original.name}</p>
                  </div>
               </div>
               {!row.original.isDefault && (
                  <div className="flex items-center gap-2">
                     <Button
                        onClick={() => handleEdit(row.original)}
                        size="sm"
                        variant="outline"
                     >
                        Editar
                     </Button>
                     <Button
                        className="text-destructive"
                        onClick={() => handleDelete(row.original)}
                        size="sm"
                        variant="ghost"
                     >
                        Excluir
                     </Button>
                  </div>
               )}
            </div>
         )}
      />
   );
}

// =============================================================================
// Page
// =============================================================================

function CategoriesPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "finance:categories:view",
      CATEGORY_VIEWS,
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <CategorySheet mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate} size="sm">
                  <Plus className="size-4 mr-1" />
                  Nova Categoria
               </Button>
            }
            description="Gerencie as categorias das suas transações"
            title="Categorias"
            viewSwitch={
               <ViewSwitchDropdown
                  currentView={currentView}
                  onViewChange={setView}
                  views={views}
               />
            }
         />
         <Suspense fallback={<CategoriesSkeleton />}>
            <CategoriesList view={currentView} />
         </Suspense>
      </main>
   );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/categories.tsx
git commit -m "feat(categories): add table/card view switch"
```

---

## Task 5: Wire up Transactions page

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx`

**Step 1: Add imports and view switch**

Key changes (same pattern as categories):

1. Replace `PageHeader` import with `DefaultHeader`
2. Add `useViewSwitch`, `ViewSwitchDropdown`, `LayoutGrid`, `LayoutList` imports
3. Define `TRANSACTION_VIEWS` constant at module level
4. Add `view` prop to `TransactionsListProps` and `TransactionsList`
5. Add card view branch inside `TransactionsList`
6. Call `useViewSwitch` in `TransactionsPage`, pass `viewSwitch` to `DefaultHeader`, pass `view` to `TransactionsList`

Card view for transactions:

```tsx
if (view === "card") {
   return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
         {transactions.map((transaction) => (
            <div
               className="rounded-lg border bg-background p-4 space-y-3"
               key={transaction.id}
            >
               <div className="flex flex-col gap-1 min-w-0">
                  <p className="text-sm font-medium tabular-nums">
                     {transaction.date.split("-").reverse().join("/")}
                  </p>
                  {(transaction.name || transaction.description) && (
                     <p className="text-xs text-muted-foreground truncate">
                        {transaction.name || transaction.description}
                     </p>
                  )}
               </div>
               <div className="flex items-center gap-2">
                  <Button
                     onClick={() => handleEdit(transaction)}
                     size="sm"
                     variant="outline"
                  >
                     Editar
                  </Button>
                  <Button
                     className="text-destructive"
                     onClick={() => handleDelete(transaction)}
                     size="sm"
                     variant="ghost"
                  >
                     Excluir
                  </Button>
               </div>
            </div>
         ))}
      </div>
   );
}
```

Storage key: `"finance:transactions:view"`

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/transactions.tsx
git commit -m "feat(transactions): add table/card view switch"
```

---

## Task 6: Wire up Bank Accounts page

**Files:**

- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/bank-accounts.tsx`

**Step 1: Add imports and view switch**

Same pattern as above. Card view for bank accounts:

```tsx
if (view === "card") {
   return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
         {accounts.map((account) => (
            <div
               className="rounded-lg border bg-background p-4 space-y-3"
               key={account.id}
            >
               <div className="flex items-center gap-2 min-w-0">
                  <span
                     className="size-3 rounded-full shrink-0"
                     style={{ backgroundColor: account.color }}
                  />
                  <p className="font-medium truncate">{account.name}</p>
               </div>
               <div className="flex items-center gap-2">
                  <Button
                     onClick={() => handleEdit(account)}
                     size="sm"
                     variant="outline"
                  >
                     Editar
                  </Button>
                  <Button
                     className="text-destructive"
                     onClick={() => handleDelete(account)}
                     size="sm"
                     variant="ghost"
                  >
                     Excluir
                  </Button>
               </div>
            </div>
         ))}
      </div>
   );
}
```

Storage key: `"finance:bank-accounts:view"`

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/finance/bank-accounts.tsx
git commit -m "feat(bank-accounts): add table/card view switch"
```

---

## Notes

- `CATEGORY_VIEWS`, `TRANSACTION_VIEWS`, `BANK_ACCOUNT_VIEWS` constants are defined at module level (outside the component) to avoid re-creating the array on every render — this is important because `useViewSwitch` uses `views[0].id` as the default.
- All three finance routes now import `DefaultHeader` instead of `PageHeader` directly.
- The `viewSwitch` slot in `DefaultHeader` renders before `actions` so the toggle sits to the left of the primary action button.
- To add view switch to a new route in the future: define a `VIEWS` constant, call `useViewSwitch`, pass `ViewSwitchDropdown` to `DefaultHeader.viewSwitch`, render the appropriate view.
