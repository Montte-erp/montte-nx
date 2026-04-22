import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   openContextPanel,
   closeContextPanel,
   useContextPanelInfo,
} from "@/features/context-panel/use-context-panel";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
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

function ContactDetailContent() {
   const { contactId } = Route.useParams();
   const globalNavigate = useNavigate();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();

   const { data: contact } = useSuspenseQuery(
      orpc.contacts.getById.queryOptions({ input: { id: contactId } }),
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

         <QueryBoundary fallback={null}>
            <ContactTransacoesTab contactId={contactId} contact={contact} />
         </QueryBoundary>
      </main>
   );
}
