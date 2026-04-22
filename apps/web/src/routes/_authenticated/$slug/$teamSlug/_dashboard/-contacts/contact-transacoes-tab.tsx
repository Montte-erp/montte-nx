import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Button } from "@packages/ui/components/button";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
   Archive,
   ArchiveRestore,
   ArrowRight,
   Plus,
   Receipt,
   RefreshCcw,
   Trash2,
} from "lucide-react";
import dayjs from "dayjs";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import type { Outputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";
import { buildTransactionColumns } from "../-transactions/transactions-columns";
import { AddSubscriptionForm } from "./add-subscription-form";

type Contact = Outputs["contacts"]["getById"];

export function ContactTransacoesTab({
   contactId,
   contact,
}: {
   contactId: string;
   contact: Contact;
}) {
   const globalNavigate = useNavigate();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { openAlertDialog } = useAlertDialog();
   const [subscriptionOpen, setSubscriptionOpen] = useState(false);
   const [isDraftActive, setIsDraftActive] = useState(false);

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

   const deleteMutation = useMutation(
      orpc.contacts.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Contato excluído.");
            globalNavigate({
               to: "/$slug/$teamSlug/contacts",
               params: { slug, teamSlug },
            });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const archiveMutation = useMutation(
      orpc.contacts.archive.mutationOptions({
         onSuccess: () => {
            toast.success("Contato arquivado.");
            globalNavigate({
               to: "/$slug/$teamSlug/contacts",
               params: { slug, teamSlug },
            });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const reactivateMutation = useMutation(
      orpc.contacts.reactivate.mutationOptions({
         onSuccess: () => toast.success("Contato reativado."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         onSuccess: () => {
            toast.success("Lançamento criado.");
            setIsDraftActive(false);
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
         const type = String(data.type || "income") as
            | "income"
            | "expense"
            | "transfer";
         const name = String(data.name ?? "").trim() || null;
         const amount = String(data.amount || "");
         const date =
            String(data.date || "").trim() || dayjs().format("YYYY-MM-DD");
         const bankAccountId = String(data.bankAccountName || "") || null;
         const categoryId = String(data.categoryName || "") || null;
         const creditCardId = String(data.creditCardName || "") || null;
         const dueDate = String(data.dueDate || "").trim() || null;
         const txStatus = String(data.status || "pending") as
            | "pending"
            | "paid"
            | "cancelled";

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

   function handleViewHistory() {
      globalNavigate({
         to: "/$slug/$teamSlug/transactions",
         params: { slug, teamSlug },
         search: {
            contactId,
            page: 1,
            pageSize: 20,
            search: "",
            view: "all",
            overdueOnly: false,
            status: [],
         },
      });
   }

   function handleDelete() {
      openAlertDialog({
         title: "Excluir contato",
         description: `Excluir "${contact.name}"? Lançamentos vinculados impedirão a exclusão.`,
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: contact.id });
         },
      });
   }

   function handleArchive() {
      openAlertDialog({
         title: "Arquivar contato",
         description: `Arquivar "${contact.name}"? O contato ficará oculto mas seus lançamentos serão mantidos.`,
         actionLabel: "Arquivar",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await archiveMutation.mutateAsync({ id: contact.id });
         },
      });
   }

   function handleReactivate() {
      reactivateMutation.mutate({ id: contact.id });
   }

   return (
      <DataTableRoot
         storageKey="montte:datatable:contact-transactions"
         columns={columns}
         data={result.data}
         getRowId={(row) => row.id}
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddTransaction}
         onDiscardAddRow={() => setIsDraftActive(false)}
      >
         <DataTableToolbar hideExport>
            <Button
               onClick={() => setIsDraftActive(true)}
               tooltip="Novo lançamento"
               variant="outline"
               size="icon-sm"
            >
               <Plus />
               <span className="sr-only">Novo lançamento</span>
            </Button>
            <Popover open={subscriptionOpen} onOpenChange={setSubscriptionOpen}>
               <PopoverTrigger asChild>
                  <Button
                     tooltip="Vincular assinatura"
                     variant="outline"
                     size="icon-sm"
                  >
                     <RefreshCcw />
                     <span className="sr-only">Vincular assinatura</span>
                  </Button>
               </PopoverTrigger>
               <PopoverContent className="w-96 p-0" align="end">
                  <Suspense fallback={null}>
                     <AddSubscriptionForm
                        contactId={contactId}
                        onSuccess={() => setSubscriptionOpen(false)}
                     />
                  </Suspense>
               </PopoverContent>
            </Popover>
            <Button
               onClick={handleViewHistory}
               tooltip="Ver histórico completo"
               variant="outline"
               size="icon-sm"
            >
               <ArrowRight />
               <span className="sr-only">Ver histórico completo</span>
            </Button>
            {contact.isArchived ? (
               <Button
                  onClick={handleReactivate}
                  disabled={reactivateMutation.isPending}
                  tooltip="Reativar contato"
                  variant="outline"
                  size="icon-sm"
               >
                  <ArchiveRestore />
                  <span className="sr-only">Reativar contato</span>
               </Button>
            ) : (
               <Button
                  onClick={handleArchive}
                  disabled={archiveMutation.isPending}
                  tooltip="Arquivar contato"
                  variant="outline"
                  size="icon-sm"
               >
                  <Archive />
                  <span className="sr-only">Arquivar contato</span>
               </Button>
            )}
            <Button
               onClick={handleDelete}
               disabled={deleteMutation.isPending}
               tooltip="Excluir contato"
               variant="outline"
               size="icon-sm"
            >
               <Trash2 className="text-destructive" />
               <span className="sr-only">Excluir contato</span>
            </Button>
         </DataTableToolbar>
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
