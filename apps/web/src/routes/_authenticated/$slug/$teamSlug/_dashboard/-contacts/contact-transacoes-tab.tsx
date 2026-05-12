import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
   getCoreRowModel,
   getSortedRowModel,
   useReactTable,
   type SortingState,
} from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTableBody } from "@/components/data-table-v2/data-table-body";
import { DataTableContainer } from "@/components/data-table-v2/data-table-container";
import { DataTableEmptyState } from "@/components/data-table-v2/data-table-empty-state";
import { DataTableHeader } from "@/components/data-table-v2/data-table-header";
import { DataTableRoot } from "@/components/data-table-v2/data-table-root";
import { useDataTableLayout } from "@/components/data-table-v2/use-data-table-layout";
import { useSheet } from "@/hooks/use-sheet";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { TransactionFormSheet } from "../-transactions/transaction-form-sheet";
import { buildTransactionColumns } from "../-transactions/transactions-columns";

type Contact = Outputs["contacts"]["getById"];

export function ContactTransacoesTab({
   contactId,
   contact,
   isDraftActive,
   onDiscardDraft,
}: {
   contactId: string;
   contact: Contact;
   isDraftActive: boolean;
   onDiscardDraft: () => void;
}) {
   const { openSheet } = useSheet();
   const layout = useDataTableLayout("contact-transactions");

   const { data: result } = useSuspenseQuery(
      orpc.transactions.getAll.queryOptions({
         input: { contactId, page: 1, pageSize: 10 },
      }),
   );

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const { data: creditCardsResult } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({ input: { pageSize: 100 } }),
   );

   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleUpdate = useCallback(
      async (id: string, patch: Record<string, unknown>) => {
         await updateMutation.mutateAsync({ id, ...patch });
      },
      [updateMutation],
   );

   useEffect(() => {
      if (!isDraftActive) return;
      openSheet({ renderChildren: () => <TransactionFormSheet /> });
      onDiscardDraft();
   }, [isDraftActive, openSheet, onDiscardDraft]);

   const columns = useMemo(
      () =>
         buildTransactionColumns({
            bankAccounts,
            contacts: [{ id: contact.id, name: contact.name }],
            categories: categoriesResult,
            creditCards: creditCardsResult?.data,
            onUpdate: handleUpdate,
            getRowStatus: (id) => result.data.find((r) => r.id === id)?.status,
         }),
      [
         bankAccounts,
         contact,
         categoriesResult,
         creditCardsResult,
         handleUpdate,
         result.data,
      ],
   );

   const [sorting, setSorting] = useState<SortingState>([]);

   const table = useReactTable({
      data: result.data,
      columns,
      getRowId: (row) => row.id,
      state: { sorting },
      onSortingChange: setSorting,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      initialState: {
         columnSizing: layout.initialState.columnSizing,
         columnOrder: layout.initialState.columnOrder,
         columnVisibility: layout.initialState.columnVisibility,
         columnPinning: layout.initialState.columnPinning,
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
   });

   return (
      <DataTableRoot table={table}>
         <DataTableContainer>
            <DataTableHeader />
            <DataTableBody />
         </DataTableContainer>
         <DataTableEmptyState>
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <Receipt className="size-6" />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma transação</EmptyTitle>
                  <EmptyDescription>
                     Este contato ainda não possui transações vinculadas.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         </DataTableEmptyState>
      </DataTableRoot>
   );
}
