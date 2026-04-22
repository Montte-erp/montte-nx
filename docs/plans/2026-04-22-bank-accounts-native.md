# Bank Accounts — Native Table Create & Import

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `BankAccountForm` credenza + `BankAccountImportCredenza` + `BankAccountExportCredenza` + `panelActions` with native `onAddRow` + `DataTableImportButton`. Delete deprecated files.

**Architecture:** Add `cellComponent` meta to `name` and `type` columns so `DraftRow` renders inline inputs. Wire `isDraftRowActive`/`onAddRow`/`onDiscardAddRow` on `DataTableRoot`. Add `DataTableImportConfig` + `DataTableImportButton` inside `DataTableToolbar`. Remove `panelActions` from `DefaultHeader` and all create/import/export credenzas.

**Tech Stack:** TanStack Query, `DataTableRoot`, `DataTableImportButton`, `DataTableImportConfig`, `useCsvFile`/`useXlsxFile` from foxact, `orpc.bankAccounts.create`

---

### Task 1: Update `bank-accounts-columns.tsx` — add `cellComponent` meta

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/bank-accounts-columns.tsx`

**Step 1: Add z import and editOptions constant**

Add at the top of the file (after existing imports):
```typescript
import { z } from "zod";
```

Add after `TYPE_LABELS`:
```typescript
const TYPE_EDIT_OPTIONS = [
   { value: "checking", label: "Conta Corrente" },
   { value: "savings", label: "Conta Poupança" },
   { value: "investment", label: "Conta Investimento" },
   { value: "payment", label: "Conta Pagamento" },
   { value: "cash", label: "Caixa Físico" },
];
```

**Step 2: Update `name` column — add meta**

Replace the `name` column def's closing with meta:
```typescript
{
   accessorKey: "name",
   header: "Nome",
   meta: {
      label: "Nome",
      cellComponent: "text" as const,
      editSchema: z.string().min(1, "Nome é obrigatório."),
   },
   cell: ({ row }) => (
      <span className="font-medium truncate">{row.original.name}</span>
   ),
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
      editOptions: TYPE_EDIT_OPTIONS,
      editSchema: z.enum(["checking", "savings", "investment", "payment", "cash"]),
   },
   cell: ({ row }) => (
      <Announcement>
         <AnnouncementTag className="flex items-center">
            {TYPE_ICONS[row.original.type]}
         </AnnouncementTag>
         <AnnouncementTitle>
            {TYPE_LABELS[row.original.type]}
         </AnnouncementTitle>
      </Announcement>
   ),
},
```

**Step 4: Typecheck column file only**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "bank-accounts-columns" | head -20
```

---

### Task 2: Rewrite `bank-accounts.tsx` — remove forms/credenzas, add native create/import

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts.tsx`

**Step 1: Replace the entire file content**

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
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
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
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import {
   buildBankAccountColumns,
   type BankAccountRow,
} from "./-bank-accounts/bank-accounts-columns";

const searchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([])
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   typeFilter: z
      .enum(["all", "checking", "savings", "investment", "payment", "cash"])
      .catch("all")
      .default("all"),
});

type TypeFilter =
   | "all"
   | "checking"
   | "savings"
   | "investment"
   | "payment"
   | "cash";

const skeletonColumns = buildBankAccountColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts",
)({
   validateSearch: searchSchema,
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
   const navigate = Route.useNavigate();
   const { sorting, columnFilters, typeFilter } = Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.bankAccounts.create.mutationOptions({
         onSuccess: () => toast.success("Conta criada com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.bankAccounts.remove.mutationOptions({
         onSuccess: () => toast.success("Conta excluída com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddAccount = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         const type = String(data.type ?? "") as BankAccountRow["type"];
         if (!name || !type) return;
         await createMutation.mutateAsync({
            name,
            type,
            color: "#6366f1",
            initialBalance: "0",
         });
         setIsDraftActive(false);
      },
      [createMutation],
   );

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
         mapRow: (row, i) => ({
            id: `__import_${i}`,
            teamId: "",
            name: String(row.name ?? "").trim(),
            type: (String(row.type ?? "checking") as BankAccountRow["type"]) || "checking",
            color: "#6366f1",
            iconUrl: null,
            initialBalance: String(row.initialBalance ?? "0"),
            currentBalance: "0",
            projectedBalance: "0",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
         }),
         onImport: async (rows) => {
            await Promise.allSettled(
               rows.map((r) =>
                  createMutation.mutateAsync({
                     name: r.name,
                     type: r.type,
                     color: "#6366f1",
                     initialBalance: r.initialBalance || "0",
                  }),
               ),
            );
         },
      }),
      [createMutation, parseCsv, parseXlsx],
   );

   const handleDelete = useCallback(
      (account: BankAccountRow) => {
         openAlertDialog({
            title: "Excluir conta",
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

   const filtered = useMemo(() => {
      if (typeFilter === "all") return bankAccounts as BankAccountRow[];
      return (bankAccounts as BankAccountRow[]).filter(
         (a) => a.type === typeFilter,
      );
   }, [bankAccounts, typeFilter]);

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
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddAccount}
         onDiscardAddRow={handleDiscardDraft}
         renderActions={({ row }) => (
            <Button
               className="text-destructive hover:text-destructive"
               onClick={() => handleDelete(row.original)}
               tooltip="Excluir"
               variant="outline"
            >
               <Trash2 className="size-4" />
            </Button>
         )}
      >
         {(
            ["checking", "savings", "investment", "payment", "cash"] as const
         ).map((key) => (
            <DataTableExternalFilter
               key={key}
               id={`type:${key}`}
               label={
                  {
                     checking: "Conta Corrente",
                     savings: "Conta Poupança",
                     investment: "Conta Investimento",
                     payment: "Conta Pagamento",
                     cash: "Caixa Físico",
                  }[key]
               }
               group="Tipo"
               active={typeFilter === key}
               onToggle={(active) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        typeFilter: active ? key : "all",
                     }),
                     replace: true,
                  })
               }
            />
         ))}
         <DataTableToolbar>
            <DataTableImportButton importConfig={importConfig} />
            <Button
               onClick={() => setIsDraftActive(true)}
               size="icon-sm"
               tooltip="Nova Conta"
               variant="outline"
            >
               <Plus />
            </Button>
         </DataTableToolbar>
         <DataTableContent />
         <DataTableEmptyState>
            <Empty>
               <EmptyMedia>
                  <Landmark className="size-10" />
               </EmptyMedia>
               <EmptyHeader>
                  <EmptyTitle>Nenhuma conta bancária</EmptyTitle>
                  <EmptyDescription>
                     Adicione uma conta para começar a gerenciar suas finanças.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
      </DataTableRoot>
   );
}

function BankAccountsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie suas contas bancárias"
            title="Contas Bancárias"
         />
         <QueryBoundary
            fallback={<BankAccountsSkeleton />}
            errorTitle="Erro ao carregar contas"
         >
            <BankAccountsList />
         </QueryBoundary>
      </main>
   );
}
```

Note: if `useCsvFile` / `useXlsxFile` don't exist as shown, check their actual import paths in `tags.tsx` or `transactions-list.tsx` and use those instead.

**Step 2: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "bank-accounts" | head -20
```

Fix any type errors before proceeding.

---

### Task 3: Delete deprecated files

**Files to delete:**
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/bank-account-export-credenza.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/bank-account-import-credenza.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-bank-accounts/use-bank-account-import.tsx`
- `apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx`
- `apps/web/src/features/bank-accounts/hooks/use-brazilian-banks.ts`

**Step 1: Verify no other file imports these**

```bash
cd /home/yorizel/Documents/montte-nx && grep -r "bank-account-export\|bank-account-import\|use-bank-account-import\|bank-accounts-form\|use-brazilian-banks" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Expected: 0 results after Task 2 is complete.

**Step 2: Delete them**

```bash
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-bank-accounts/bank-account-export-credenza.tsx"
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-bank-accounts/bank-account-import-credenza.tsx"
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-bank-accounts/use-bank-account-import.tsx"
rm "apps/web/src/features/bank-accounts/ui/bank-accounts-form.tsx"
rm "apps/web/src/features/bank-accounts/hooks/use-brazilian-banks.ts"
```

**Step 3: Remove empty directories if they exist**

```bash
rmdir "apps/web/src/features/bank-accounts/ui" 2>/dev/null || true
rmdir "apps/web/src/features/bank-accounts/hooks" 2>/dev/null || true
rmdir "apps/web/src/features/bank-accounts" 2>/dev/null || true
```

**Step 4: Final typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "bank" | head -20
```

**Step 5: Commit**

```bash
cd /home/yorizel/Documents/montte-nx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-bank-accounts/bank-accounts-columns.tsx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/bank-accounts.tsx
git add -u
git commit -m "feat(bank-accounts): native inline create, import, remove deprecated files"
```
