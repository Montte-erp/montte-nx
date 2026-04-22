import { Skeleton } from "@packages/ui/components/skeleton";
import { Button } from "@packages/ui/components/button";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import { z } from "zod";
import {
   Archive,
   ArchiveRestore,
   ArrowRight,
   Plus,
   Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   openContextPanel,
   closeContextPanel,
   useContextPanelInfo,
} from "@/features/context-panel/use-context-panel";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { orpc } from "@/integrations/orpc/client";
import {
   Tabs,
   TabsList,
   TabsTrigger,
   TabsContent,
} from "@packages/ui/components/tabs";
import { AddSubscriptionForm } from "../-contacts/add-subscription-form";
import { ContactAssinaturasTab } from "../-contacts/contact-assinaturas-tab";
import { ContactPropertiesPanel } from "../-contacts/contact-properties-panel";
import { ContactTransacoesTab } from "../-contacts/contact-transacoes-tab";

const searchSchema = z.object({});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts/$contactId",
)({
   validateSearch: searchSchema,
   loader: ({ context, params }) => {
      context.queryClient.prefetchQuery(
         orpc.contacts.getById.queryOptions({
            input: { id: params.contactId },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.contacts.getStats.queryOptions({
            input: { id: params.contactId },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.transactions.getAll.queryOptions({
            input: { contactId: params.contactId, page: 1, pageSize: 10 },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.bankAccounts.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.creditCards.getAll.queryOptions({ input: { pageSize: 100 } }),
      );
      context.queryClient.prefetchQuery(
         orpc.services.getContactSubscriptions.queryOptions({
            input: { contactId: params.contactId },
         }),
      );
   },
   pendingMs: 300,
   pendingComponent: ContactDetailSkeleton,
   head: () => ({ meta: [{ title: "Contato — Montte" }] }),
   component: ContactDetailPage,
});

function ContactDetailSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <Skeleton className="h-10 w-64" />
         <Skeleton className="h-64 w-full" />
         <Skeleton className="h-64 w-full" />
      </div>
   );
}

function ContactDetailPage() {
   return (
      <QueryBoundary
         fallback={<ContactDetailSkeleton />}
         errorTitle="Erro ao carregar contato"
      >
         <ContactDetailContent />
      </QueryBoundary>
   );
}

const TYPE_LABELS = {
   cliente: "Cliente",
   fornecedor: "Fornecedor",
   ambos: "Ambos",
} as const;

const VALID_TABS = ["transacoes", "servicos"] as const;
type ActiveTab = (typeof VALID_TABS)[number];
function isValidTab(v: string): v is ActiveTab {
   return (VALID_TABS as readonly string[]).includes(v);
}

function ContactDetailContent() {
   const { contactId } = Route.useParams();
   const globalNavigate = useNavigate();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { openAlertDialog } = useAlertDialog();
   const [activeTab, setActiveTab] = useState<ActiveTab>("transacoes");
   const [subscriptionOpen, setSubscriptionOpen] = useState(false);
   const [isDraftActive, setIsDraftActive] = useState(false);

   const { data: contact } = useSuspenseQuery(
      orpc.contacts.getById.queryOptions({ input: { id: contactId } }),
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

   useEffect(() => {
      openContextPanel();
      return () => closeContextPanel();
   }, []);

   useContextPanelInfo(() => <ContactPropertiesPanel contact={contact} />);

   const documentDescription = contact.document
      ? contact.documentType
         ? `${contact.documentType.toUpperCase()} ${contact.document}`
         : contact.document
      : TYPE_LABELS[contact.type];

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

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            title={contact.name}
            description={documentDescription}
            onBack={() =>
               globalNavigate({
                  to: "/$slug/$teamSlug/contacts",
                  params: { slug, teamSlug },
               })
            }
         />

         <Tabs
            value={activeTab}
            onValueChange={(v) => {
               if (isValidTab(v)) setActiveTab(v);
            }}
         >
            <div className="flex items-center gap-2">
               <TabsList>
                  <TabsTrigger value="transacoes">Transações</TabsTrigger>
                  <TabsTrigger value="servicos">Serviços</TabsTrigger>
               </TabsList>
               <div className="ml-auto flex items-center gap-2">
                  {activeTab === "transacoes" && (
                     <>
                        <Button
                           onClick={() => setIsDraftActive(true)}
                           tooltip="Novo lançamento"
                           variant="outline"
                           size="icon-sm"
                        >
                           <Plus />
                           <span className="sr-only">Novo lançamento</span>
                        </Button>
                        <Button
                           onClick={handleViewHistory}
                           tooltip="Ver histórico completo"
                           variant="outline"
                           size="icon-sm"
                        >
                           <ArrowRight />
                           <span className="sr-only">
                              Ver histórico completo
                           </span>
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
                     </>
                  )}
                  {activeTab === "servicos" && (
                     <Popover
                        open={subscriptionOpen}
                        onOpenChange={setSubscriptionOpen}
                     >
                        <PopoverTrigger asChild>
                           <Button
                              tooltip="Vincular serviço"
                              variant="outline"
                              size="icon-sm"
                           >
                              <Plus />
                              <span className="sr-only">Vincular serviço</span>
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
                  )}
               </div>
            </div>

            <TabsContent value="transacoes">
               <QueryBoundary fallback={null}>
                  <ContactTransacoesTab
                     contactId={contactId}
                     contact={contact}
                     isDraftActive={isDraftActive}
                     onDiscardDraft={() => setIsDraftActive(false)}
                  />
               </QueryBoundary>
            </TabsContent>
            <TabsContent value="servicos">
               <QueryBoundary fallback={null}>
                  <ContactAssinaturasTab contactId={contactId} />
               </QueryBoundary>
            </TabsContent>
         </Tabs>
      </main>
   );
}
