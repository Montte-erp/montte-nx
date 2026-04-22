# Bank Accounts DataTable Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the old monolithic `DataTable` from `@packages/ui` with the new composable `DataTableRoot` pattern, and replace the custom `BankAccountsFilterBar` component with `DataTableExternalFilter`.

**Architecture:** `DataTableRoot` wraps the table and manages all state (localStorage persistence, sorting, column filters) internally. External filters (account type) are registered via `DataTableExternalFilter` render-only components. The custom filter bar file is deleted.

**Tech Stack:** TanStack Router, TanStack Query, `DataTableRoot` + `DataTableContent` + `DataTableEmptyState` + `DataTableExternalFilter` + `DataTableSkeleton` + `DataTableToolbar` from `@/components/data-table/`

---

### Task 1: Delete `bank-accounts-filter-bar.tsx`

**Files:**
- Delete: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/bank-accounts-filter-bar.tsx`

**Step 1: Verify no other file imports the filter bar**

```bash
grep -r "bank-accounts-filter-bar" apps/web/src --include="*.tsx" --include="*.ts"
```
Expected: only the `bank-accounts.tsx` route file.

**Step 2: Delete the file**

```bash
rm apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-bank-accounts/bank-accounts-filter-bar.tsx
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove orphaned bank-accounts-filter-bar"
```

---

### Task 2: Rewrite `bank-accounts.tsx` to use `DataTableRoot`

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx`

**Step 1: Replace the file content**

Replace the entire file with this implementation:

```tsx
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Landmark, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { DefaultHeader } from "@/components/default-header";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { PanelAction } from "@/features/context-panel/context-panel-store";
import {
   type BankAccountRow,
   buildBankAccountColumns,
} from "./-bank-accounts/bank-accounts-columns";
import { BankAccountExportCredenza } from "./-bank-accounts/bank-account-export-credenza";
import { BankAccountImportCredenza } from "./-bank-accounts/bank-account-import-credenza";
import { BankAccountForm } from "@/features/bank-accounts/ui/bank-accounts-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const ACCOUNT_TYPE_OPTIONS = [
   { value: "checking", label: "Conta Corrente" },
   { value: "savings", label: "Poupança" },
   { value: "investment", label: "Investimento" },
   { value: "payment", label: "Pagamento" },
   { value: "cash", label: "Dinheiro" },
] as const;

type AccountType = (typeof ACCOUNT_TYPE_OPTIONS)[number]["value"];

const bankAccountsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   type: z
      .enum(["checking", "savings", "investment", "payment", "cash"])
      .optional()
      .catch(undefined),
});

const skeletonColumns = buildBankAccountColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts",
)({
   validateSearch: bankAccountsSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: BankAccountsSkeleton,
   head: () => ({
      meta: [{ title: "Contas Bancárias — Montte" }],
   }),
   component: BankAccountsPage,
});

function BankAccountsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function BankAccountsList() {
   const { sorting, columnFilters, type } = Route.useSearch();
   const navigate = Route.useNavigate();
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: accounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const deleteMutation = useMutation(
      orpc.bankAccounts.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Conta bancária excluída com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir conta bancária.");
         },
      }),
   );

   const handleEdit = useCallback(
      (account: BankAccountRow) => {
         openCredenza({
            renderChildren: () => (
               <BankAccountForm
                  account={account}
                  mode="edit"
                  onSuccess={closeCredenza}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (account: BankAccountRow) => {
         openAlertDialog({
            title: "Excluir conta bancária",
            description: `Tem certeza que deseja excluir a conta "${account.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: account.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const filtered = type ? accounts.filter((a) => a.type === type) : accounts;
   const columns = useMemo(() => buildBankAccountColumns(), []);

   return (
      <DataTableRoot
         columns={columns}
         data={filtered}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:bank-accounts"
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
                  onClick={() => handleEdit(row.original)}
                  tooltip="Editar"
                  variant="outline"
               >
                  <Pencil className="size-4" />
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </>
         )}
      >
         {ACCOUNT_TYPE_OPTIONS.map((opt) => (
            <DataTableExternalFilter
               key={opt.value}
               id={`type:${opt.value}`}
               label={opt.label}
               group="Tipo de conta"
               active={type === opt.value}
               onToggle={(active) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        type: active ? opt.value : undefined,
                     }),
                     replace: true,
                  })
               }
            />
         ))}
         <DataTableToolbar />
         <DataTableContent />
         <DataTableEmptyState>
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <Landmark className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma conta bancária</EmptyTitle>
                  <EmptyDescription>
                     Adicione uma conta bancária para começar a organizar suas
                     finanças.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
      </DataTableRoot>
   );
}

function BankAccountsPage() {
   const { type } = Route.useSearch();
   const { openCredenza, closeCredenza } = useCredenza();

   const handleCreate = useCallback(() => {
      openCredenza({
         renderChildren: () => (
            <BankAccountForm mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   const panelActions: PanelAction[] = [
      {
         icon: Upload,
         label: "Importar",
         onClick: () =>
            openCredenza({
               renderChildren: () => (
                  <BankAccountImportCredenza onClose={closeCredenza} />
               ),
            }),
      },
      {
         icon: Download,
         label: "Exportar",
         onClick: () =>
            openCredenza({
               renderChildren: () => (
                  <BankAccountExportCredenza onClose={closeCredenza} />
               ),
            }),
      },
   ];

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4" />
                  Nova Conta
               </Button>
            }
            description="Gerencie suas contas bancárias e saldos"
            panelActions={panelActions}
            title="Contas Bancárias"
         />
         <QueryBoundary fallback={<BankAccountsSkeleton />}>
            <BankAccountsList />
         </QueryBoundary>
      </main>
   );
}
```

Key changes from the old version:
- Removed `createLocalStorageState` (DataTableRoot handles persistence via `storageKey`)
- Removed `BankAccountsFilterBar` import — type filters are now `DataTableExternalFilter` components inside `DataTableRoot`
- Removed `OnChangeFn`, `ColumnFiltersState`, `SortingState` imports (inline handlers)
- `BankAccountsSkeleton` now uses `DataTableSkeleton` with the actual column defs
- `BankAccountsPage` no longer needs `navigate` prop — `BankAccountsList` calls `Route.useNavigate()` directly
- `type` param still exists in search schema; filter bar buttons replaced by `DataTableExternalFilter`

**Step 2: TypeCheck**

```bash
bun run typecheck 2>&1 | grep -A3 "bank-accounts"
```
Expected: no errors related to this file.

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/bank-accounts.tsx
git commit -m "feat(bank-accounts): migrate to DataTableRoot composable pattern"
```
