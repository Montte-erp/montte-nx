# Credit Cards — Native Table Create & Import

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace `CreditCardForm` credenza + `CreditCardsImportCredenza` + `CreditCardsExportCredenza` + `panelActions` with native `onAddRow` + `DataTableImportButton`. Delete all deprecated files.

**Architecture:** Add `cellComponent: "text"` to `name`, `closingDay`, `dueDay` columns; add a new `bankAccountName` column with `cellComponent: "combobox"` backed by loaded bank accounts. `buildCreditCardColumns` accepts optional bank account options. Wire `isDraftRowActive`/`onAddRow`/`onDiscardAddRow`. Add `DataTableImportButton` in toolbar. Remove `panelActions` from `DefaultHeader`.

**Tech Stack:** TanStack Query, `DataTableRoot`, `DataTableImportButton`, `orpc.creditCards.create`, `orpc.bankAccounts.getAll`

---

### Task 1: Update `credit-cards-columns.tsx` — add `cellComponent` meta and bank account combobox

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-credit-cards/credit-cards-columns.tsx`

**Step 1: Read the file first to verify `CreditCardRow` has the needed fields**

Read: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-credit-cards/credit-cards-columns.tsx`

Verify that `CreditCardRow = Outputs["creditCards"]["getAll"]["data"][number]` contains: `name`, `brand`, `creditLimit`, `closingDay`, `dueDay`, `status`, and ideally `bankAccountId` / `bankAccountName`.

**Step 2: Update function signature to accept options**

Change:
```typescript
export function buildCreditCardColumns(): ColumnDef<CreditCardRow>[]
```
To:
```typescript
export function buildCreditCardColumns(options?: {
   bankAccounts?: Array<{ id: string; name: string }>;
}): ColumnDef<CreditCardRow>[]
```

**Step 3: Add z import**

```typescript
import { z } from "zod";
```

**Step 4: Update `name` column — add meta**

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
      <div className="flex items-center gap-2 min-w-0">
         <span
            className="size-3 rounded-full shrink-0"
            style={{ backgroundColor: row.original.color }}
         />
         <span className="font-medium truncate">{row.original.name}</span>
      </div>
   ),
   // ...keep existing meta.label
},
```

**Step 5: Update `closingDay` column — add meta**

```typescript
{
   accessorKey: "closingDay",
   header: "Fechamento",
   meta: {
      label: "Fechamento",
      cellComponent: "text" as const,
      editSchema: z.coerce.number().int().min(1).max(31),
   },
   cell: ({ row }) => (
      <Announcement>
         <AnnouncementTag className="flex items-center text-muted-foreground">
            <CalendarClock className="size-3" />
         </AnnouncementTag>
         <AnnouncementTitle>
            Dia {row.original.closingDay}
         </AnnouncementTitle>
      </Announcement>
   ),
},
```

**Step 6: Update `dueDay` column — add meta**

```typescript
{
   accessorKey: "dueDay",
   header: "Vencimento",
   meta: {
      label: "Vencimento",
      cellComponent: "text" as const,
      editSchema: z.coerce.number().int().min(1).max(31),
   },
   cell: ({ row }) => (
      <Announcement>
         <AnnouncementTag className="flex items-center text-muted-foreground">
            <Calendar className="size-3" />
         </AnnouncementTag>
         <AnnouncementTitle>Dia {row.original.dueDay}</AnnouncementTitle>
      </Announcement>
   ),
},
```

**Step 7: Add new `bankAccountId` column for the draft row**

Add this column at the end (before status if desired, or after dueDay). This column is needed so the DraftRow has a combobox to pick the bank account. For existing rows it shows nothing (empty cell) since there's no `bankAccountId` display needed separately.

However, if `CreditCardRow` has a `bankAccountName` field, use that as `accessorKey` to also show the bank account name for existing rows:

```typescript
{
   accessorKey: "bankAccountId",  // or "bankAccountName" if that exists on CreditCardRow
   header: "Conta Bancária",
   meta: {
      label: "Conta Bancária",
      cellComponent: "combobox" as const,
      editOptions: options?.bankAccounts?.map((a) => ({
         value: a.id,
         label: a.name,
      })),
   },
   cell: ({ row }) => {
      // Show bankAccountName if available on row, else empty
      const name = (row.original as unknown as { bankAccountName?: string }).bankAccountName;
      if (!name) return <span className="text-muted-foreground">—</span>;
      return <span className="text-sm">{name}</span>;
   },
},
```

If `CreditCardRow` already has `bankAccountName`: use `accessorKey: "bankAccountName"` and the `onAddRow` callback should read `data.bankAccountName` as the selected bank account ID (combobox value = ID).

**Step 8: Typecheck columns file**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "credit-cards-columns" | head -20
```

---

### Task 2: Rewrite `credit-cards.tsx` — remove forms/credenzas, add native create/import

**Files:**
- Modify: `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/credit-cards.tsx`

**Step 1: Replace the file content**

```tsx
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Spinner } from "@packages/ui/components/spinner";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { orpc } from "@/integrations/orpc/client";
import {
   buildCreditCardColumns,
   type CreditCardRow,
} from "./-credit-cards/credit-cards-columns";
import { CreditCardFaturaRow } from "./-credit-cards/credit-card-fatura-row";

const creditCardsSearchSchema = z.object({
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().max(100).catch("").default(""),
   status: z
      .enum(["active", "blocked", "cancelled"])
      .optional()
      .catch(undefined),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

const skeletonColumns = buildCreditCardColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/credit-cards",
)({
   validateSearch: creditCardsSearchSchema,
   loaderDeps: ({ search: { page, pageSize, search, status } }) => ({
      page,
      pageSize,
      search,
      status,
   }),
   loader: ({ context, deps }) => {
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({
            input: {
               page: deps.page,
               pageSize: deps.pageSize,
               search: deps.search || undefined,
               status: deps.status,
            },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: CreditCardsSkeleton,
   head: () => ({
      meta: [{ title: "Cartões de Crédito — Montte" }],
   }),
   component: CreditCardsPage,
});

function CreditCardsSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function CreditCardsList() {
   const navigate = Route.useNavigate();
   const { columnFilters, page, pageSize, search, status } = Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   const { data: result } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({
         input: { page, pageSize, search: search || undefined, status },
      }),
   );

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.creditCards.create.mutationOptions({
         onSuccess: () => toast.success("Cartão criado com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.creditCards.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito excluído com sucesso.");
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartão de crédito.");
         },
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.creditCards.bulkRemove.mutationOptions({
         onSuccess: ({ deleted }) => {
            toast.success(
               `${deleted} ${deleted === 1 ? "cartão excluído" : "cartões excluídos"} com sucesso.`,
            );
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao excluir cartões.");
         },
      }),
   );

   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddCard = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         const closingDay = parseInt(String(data.closingDay ?? ""), 10);
         const dueDay = parseInt(String(data.dueDay ?? ""), 10);
         // bankAccountId comes from the combobox — value is the bank account ID
         const bankAccountId = String(data.bankAccountId ?? data.bankAccountName ?? "").trim();
         if (!name || !closingDay || !dueDay || !bankAccountId) return;
         await createMutation.mutateAsync({
            name,
            closingDay,
            dueDay,
            bankAccountId,
            color: "#6366f1",
            creditLimit: "0",
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
         mapRow: (row, i): CreditCardRow => ({
            id: `__import_${i}`,
            name: String(row.name ?? "").trim(),
            brand: String(row.brand ?? "") || null,
            color: "#6366f1",
            creditLimit: String(row.creditLimit ?? row.limite ?? "0"),
            closingDay: parseInt(String(row.closingDay ?? row.fechamento ?? "1"), 10) || 1,
            dueDay: parseInt(String(row.dueDay ?? row.vencimento ?? "1"), 10) || 1,
            status: "active",
         } as CreditCardRow),
         onImport: async (rows) => {
            const firstBankAccountId = bankAccounts?.[0]?.id;
            if (!firstBankAccountId) {
               toast.error("Nenhuma conta bancária disponível para importação.");
               return;
            }
            await Promise.allSettled(
               rows.map((r) =>
                  createMutation.mutateAsync({
                     name: r.name,
                     closingDay: r.closingDay,
                     dueDay: r.dueDay,
                     bankAccountId: firstBankAccountId,
                     color: "#6366f1",
                     creditLimit: String(r.creditLimit) || "0",
                  }),
               ),
            );
         },
      }),
      [createMutation, parseCsv, parseXlsx, bankAccounts],
   );

   const handleDelete = useCallback(
      (card: CreditCardRow) => {
         openAlertDialog({
            title: "Excluir cartão de crédito",
            description: `Tem certeza que deseja excluir o cartão "${card.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: card.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   const columns = useMemo(
      () =>
         buildCreditCardColumns({
            bankAccounts: (bankAccounts ?? []) as Array<{
               id: string;
               name: string;
            }>,
         }),
      [bankAccounts],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={result.data}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:credit-cards"
         columnFilters={columnFilters}
         onColumnFiltersChange={(updater) => {
            const next =
               typeof updater === "function"
                  ? updater(columnFilters)
                  : updater;
            const statusFilter = next.find((f) => f.id === "status");
            navigate({
               search: (prev) => ({
                  ...prev,
                  columnFilters: next,
                  status:
                     (statusFilter?.value as
                        | "active"
                        | "blocked"
                        | "cancelled") ?? undefined,
                  page: 1,
               }),
               replace: true,
            });
         }}
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddCard}
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
         <DataTableToolbar>
            <DataTableImportButton importConfig={importConfig} />
            <Button
               onClick={() => setIsDraftActive(true)}
               size="icon-sm"
               tooltip="Novo Cartão"
               variant="outline"
            >
               <Plus />
            </Button>
         </DataTableToolbar>
         <DataTableEmptyState>
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <CreditCard className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhum cartão de crédito</EmptyTitle>
                  <EmptyDescription>
                     Adicione um cartão de crédito para controlar seus gastos.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
         <DataTableContent
            renderExpandedRow={(props) => (
               <CreditCardFaturaRow creditCardId={props.row.original.id} />
            )}
         />
         <DataTableBulkActions<CreditCardRow>>
            {({ selectedRows, clearSelection }) => (
               <SelectionActionButton
                  icon={<Trash2 className="size-3.5" />}
                  variant="destructive"
                  onClick={() => {
                     const ids = selectedRows.map((r) => r.id);
                     openAlertDialog({
                        title: `Excluir ${ids.length} ${ids.length === 1 ? "cartão" : "cartões"}`,
                        description:
                           "Tem certeza que deseja excluir os cartões selecionados? Esta ação não pode ser desfeita.",
                        actionLabel: "Excluir",
                        cancelLabel: "Cancelar",
                        variant: "destructive",
                        onAction: async () => {
                           await bulkDeleteMutation.mutateAsync({ ids });
                           clearSelection();
                        },
                     });
                  }}
               >
                  Excluir
               </SelectionActionButton>
            )}
         </DataTableBulkActions>
         <DataTablePagination
            currentPage={page}
            pageSize={pageSize}
            totalPages={result.totalPages}
            totalCount={result.totalCount}
            onPageChange={(p) =>
               navigate({
                  search: (prev) => ({ ...prev, page: p }),
                  replace: true,
               })
            }
            onPageSizeChange={(s) =>
               navigate({
                  search: (prev) => ({ ...prev, pageSize: s, page: 1 }),
                  replace: true,
               })
            }
         />
      </DataTableRoot>
   );
}

function CreditCardsPage() {
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            description="Gerencie seus cartões de crédito"
            title="Cartões de Crédito"
         />
         <QueryBoundary
            fallback={<CreditCardsSkeleton />}
            errorTitle="Erro ao carregar cartões"
         >
            <CreditCardsList />
         </QueryBoundary>
      </main>
   );
}
```

**Step 2: Typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "credit-card" | head -20
```

Fix all type errors. Key issues to watch for:
- `CreditCardRow` may not have `bankAccountId`/`bankAccountName` — adjust the `bankAccountId` column and `handleAddCard` accordingly
- `orpc.creditCards.create` — verify this is the correct mutation name
- `mapRow` return type must match `CreditCardRow` — cast as needed

---

### Task 3: Delete deprecated files

**Files to delete:**
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-credit-cards/credit-cards-form.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-credit-cards/credit-cards-export-credenza.tsx`
- `apps/web/src/routes/_authenticated/$slug/$teamSlug/_dashboard/-credit-cards/credit-cards-import-credenza.tsx`

**Step 1: Verify no imports remain**

```bash
cd /home/yorizel/Documents/montte-nx && grep -r "credit-cards-form\|credit-cards-export\|credit-cards-import" apps/web/src --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Expected: 0 results.

**Step 2: Delete**

```bash
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-credit-cards/credit-cards-form.tsx"
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-credit-cards/credit-cards-export-credenza.tsx"
rm "apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-credit-cards/credit-cards-import-credenza.tsx"
```

**Step 3: Final typecheck**

```bash
cd /home/yorizel/Documents/montte-nx && bun run typecheck 2>&1 | grep -i "credit" | head -20
```

**Step 4: Commit**

```bash
cd /home/yorizel/Documents/montte-nx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/-credit-cards/credit-cards-columns.tsx
git add apps/web/src/routes/_authenticated/\$slug/\$teamSlug/_dashboard/credit-cards.tsx
git add -u
git commit -m "feat(credit-cards): native inline create, import, remove deprecated files"
```
