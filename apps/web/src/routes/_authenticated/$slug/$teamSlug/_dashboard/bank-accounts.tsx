import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import type {
   ColumnFiltersState,
   OnChangeFn,
   SortingState,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import {
   type BankAccountRow,
   buildBankAccountColumns,
} from "./-bank-accounts/bank-accounts-columns";
import { BankAccountsFilterBar } from "./-bank-accounts/bank-accounts-filter-bar";
import { BankAccountForm } from "@/features/bank-accounts/ui/bank-accounts-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const bankAccountsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .optional()
      .default([]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .optional()
      .default([]),
   type: z
      .enum(["checking", "savings", "investment", "payment", "cash"])
      .optional(),
});

export type BankAccountsSearch = z.infer<typeof bankAccountsSearchSchema>;

const [useBankAccountsTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:bank-accounts",
      null,
   );

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

// =============================================================================
// Skeleton
// =============================================================================

function BankAccountsSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-12 w-full" key={`skeleton-${index + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

interface BankAccountsListProps {
   navigate: ReturnType<typeof Route.useNavigate>;
}

function BankAccountsList({ navigate }: BankAccountsListProps) {
   const { sorting, columnFilters, type } = Route.useSearch();
   const [tableState, setTableState] = useBankAccountsTableState();
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const handleSortingChange: OnChangeFn<SortingState> = useCallback(
      (updater) => {
         const next =
            typeof updater === "function"
               ? updater(sorting as SortingState)
               : updater;
         navigate({
            search: (prev: BankAccountsSearch) => ({ ...prev, sorting: next }),
         });
      },
      [sorting, navigate],
   );

   const handleColumnFiltersChange: OnChangeFn<ColumnFiltersState> =
      useCallback(
         (updater) => {
            const next =
               typeof updater === "function"
                  ? updater(columnFilters as ColumnFiltersState)
                  : updater;
            navigate({
               search: (prev: BankAccountsSearch) => ({
                  ...prev,
                  columnFilters: next,
               }),
            });
         },
         [columnFilters, navigate],
      );

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
            children: (
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
   const columns = buildBankAccountColumns();

   if (filtered.length === 0) {
      return (
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
      );
   }

   return (
      <DataTable
         columns={columns}
         data={filtered}
         getRowId={(row) => row.id}
         sorting={sorting as SortingState}
         onSortingChange={handleSortingChange}
         columnFilters={columnFilters as ColumnFiltersState}
         onColumnFiltersChange={handleColumnFiltersChange}
         tableState={tableState}
         onTableStateChange={setTableState}
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
      />
   );
}

// =============================================================================
// Page
// =============================================================================

function BankAccountsPage() {
   const navigate = Route.useNavigate();
   const { type } = Route.useSearch();
   const { openCredenza, closeCredenza } = useCredenza();

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <BankAccountForm mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

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
            title="Contas Bancárias"
         />
         <BankAccountsFilterBar type={type} />
         <Suspense fallback={<BankAccountsSkeleton />}>
            <BankAccountsList navigate={navigate} />
         </Suspense>
      </main>
   );
}
