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
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   type BankAccountRow,
   buildBankAccountColumns,
} from "@/features/bank-accounts/ui/bank-accounts-columns";
import { BankAccountForm } from "@/features/bank-accounts/ui/bank-accounts-form";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/bank-accounts",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
   },
   component: BankAccountsPage,
});

// =============================================================================
// Skeleton
// =============================================================================

function BankAccountsSkeleton() {
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

function BankAccountsList() {
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

   const columns = buildBankAccountColumns();

   if (accounts.length === 0) {
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
         data={accounts}
         getRowId={(row) => row.id}
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
   const { openCredenza, closeCredenza } = useCredenza();

   function handleCreate() {
      openCredenza({
         children: <BankAccountForm mode="create" onSuccess={closeCredenza} />,
      });
   }

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4 mr-1" />
                  Nova Conta
               </Button>
            }
            description="Gerencie suas contas bancárias e saldos"
            title="Contas Bancárias"
         />
         <Suspense fallback={<BankAccountsSkeleton />}>
            <BankAccountsList />
         </Suspense>
      </main>
   );
}
