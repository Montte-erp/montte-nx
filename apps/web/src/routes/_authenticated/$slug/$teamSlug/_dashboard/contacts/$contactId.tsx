import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import { ContactDadosTab } from "../-contacts/contact-dados-tab";
import { ContactAssinaturasTab } from "../-contacts/contact-assinaturas-tab";
import { ContactTransacoesTab } from "../-contacts/contact-transacoes-tab";
import { ContactInfoSidebar } from "../-contacts/contact-info-sidebar";

const searchSchema = z.object({
   tab: z
      .enum(["dados", "assinaturas", "transacoes"])
      .catch("dados")
      .default("dados"),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().catch(20).default(20),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts/$contactId",
)({
   validateSearch: searchSchema,
   loaderDeps: ({ search: { page, pageSize } }) => ({ page, pageSize }),
   loader: ({ context, params, deps }) => {
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
         orpc.contacts.getTransactions.queryOptions({
            input: {
               id: params.contactId,
               page: deps.page,
               pageSize: deps.pageSize,
            },
         }),
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
         <div className="flex gap-4">
            <Skeleton className="h-96 flex-1" />
            <Skeleton className="h-96 w-72" />
         </div>
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
   const { tab } = Route.useSearch();
   const navigate = Route.useNavigate();
   const globalNavigate = useNavigate();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();

   const { data: contact } = useSuspenseQuery(
      orpc.contacts.getById.queryOptions({ input: { id: contactId } }),
   );

   const documentDescription = contact.document
      ? `${contact.documentType?.toUpperCase()} ${contact.document}`
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
         <div className="flex items-start gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-4">
               <Tabs
                  value={tab}
                  onValueChange={(v) =>
                     navigate({
                        search: (p) => ({
                           ...p,
                           tab: v as "dados" | "assinaturas" | "transacoes",
                        }),
                        replace: true,
                     })
                  }
               >
                  <TabsList>
                     <TabsTrigger value="dados">Dados</TabsTrigger>
                     <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
                     <TabsTrigger value="transacoes">Transações</TabsTrigger>
                  </TabsList>
                  <TabsContent value="dados" className="mt-4">
                     <QueryBoundary fallback={null}>
                        <ContactDadosTab contact={contact} />
                     </QueryBoundary>
                  </TabsContent>
                  <TabsContent value="assinaturas" className="mt-4">
                     <QueryBoundary fallback={null}>
                        <ContactAssinaturasTab contactId={contactId} />
                     </QueryBoundary>
                  </TabsContent>
                  <TabsContent value="transacoes" className="mt-4">
                     <QueryBoundary fallback={null}>
                        <ContactTransacoesTab contactId={contactId} />
                     </QueryBoundary>
                  </TabsContent>
               </Tabs>
            </div>
            <ContactInfoSidebar contact={contact} />
         </div>
      </main>
   );
}
