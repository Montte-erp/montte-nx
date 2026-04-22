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
import { ArrowRight, Receipt, RefreshCcw, Trash2 } from "lucide-react";
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

   return (
      <DataTableRoot
         storageKey="montte:datatable:contact-transactions"
         columns={columns}
         data={result.data}
         getRowId={(row) => row.id}
      >
         <DataTableToolbar hideExport>
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
