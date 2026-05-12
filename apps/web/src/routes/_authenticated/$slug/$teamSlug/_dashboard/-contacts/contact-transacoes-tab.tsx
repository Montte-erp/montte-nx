import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { Table } from "@packages/ui/components/table";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
   getCoreRowModel,
   getSortedRowModel,
   useReactTable,
   type SortingState,
} from "@tanstack/react-table";
import { Receipt } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { buildTransactionColumns } from "../-transactions/transactions-columns";

type Contact = Outputs["contacts"]["getById"];

export function ContactTransacoesTab({
   contactId,
   contact,
}: {
   contactId: string;
   contact: Contact;
}) {
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
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: { sorting, ...layout.state },
      onSortingChange: setSorting,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
   });

   return (
      <div className="flex flex-col gap-4">
         <ScrollArea className="rounded-md border bg-card">
            <Table>
               <DataTableHeader table={table} />
               <DataTableBody table={table} />
            </Table>
         </ScrollArea>
         {result.data.length === 0 && (
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
         )}
      </div>
   );
}
