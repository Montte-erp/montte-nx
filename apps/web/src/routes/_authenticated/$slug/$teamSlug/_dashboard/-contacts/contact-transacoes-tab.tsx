import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import dayjs from "dayjs";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { buildTransactionColumns } from "../-transactions/transactions-columns";

type Contact = Outputs["contacts"]["getById"];

const TX_TYPES = ["income", "expense", "transfer"] as const;
type TxType = (typeof TX_TYPES)[number];
function isTxType(v: string): v is TxType {
   return (TX_TYPES as readonly string[]).includes(v);
}

const TX_STATUSES = ["pending", "paid", "cancelled"] as const;
type TxStatus = (typeof TX_STATUSES)[number];
function isTxStatus(v: string): v is TxStatus {
   return (TX_STATUSES as readonly string[]).includes(v);
}

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

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         onSuccess: () => {
            toast.success("Lançamento criado.");
            onDiscardDraft();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const handleUpdate = useCallback(
      async (id: string, patch: Record<string, unknown>) => {
         await updateMutation.mutateAsync({ id, ...patch });
      },
      [updateMutation],
   );

   const handleAddTransaction = useCallback(
      async (data: Record<string, string | string[]>) => {
         const rawType = String(data.type || "");
         const type = isTxType(rawType) ? rawType : "income";
         const name = String(data.name ?? "").trim() || null;
         const amount = String(data.amount || "");
         const date =
            String(data.date || "").trim() || dayjs().format("YYYY-MM-DD");
         const bankAccountId = String(data.bankAccountName || "") || null;
         const categoryId = String(data.categoryName || "") || null;
         const creditCardId = String(data.creditCardName || "") || null;
         const dueDate = String(data.dueDate || "").trim() || null;
         const rawStatus = String(data.status || "");
         const txStatus = isTxStatus(rawStatus) ? rawStatus : "pending";

         await createMutation.mutateAsync({
            name,
            type,
            amount,
            date,
            bankAccountId,
            contactId,
            categoryId,
            creditCardId: creditCardId || null,
            dueDate,
            status: txStatus,
         });
      },
      [createMutation, contactId],
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

   return (
      <DataTableRoot
         storageKey="montte:datatable:contact-transactions"
         columns={columns}
         data={result.data}
         getRowId={(row) => row.id}
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddTransaction}
         onDiscardAddRow={onDiscardDraft}
         renderActions={() => <></>}
      >
         <DataTableToolbar hideExport />
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
         <DataTableContent />
      </DataTableRoot>
   );
}
