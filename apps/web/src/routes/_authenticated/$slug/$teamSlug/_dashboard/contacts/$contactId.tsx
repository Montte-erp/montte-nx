import { Skeleton } from "@packages/ui/components/skeleton";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";

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

function ContactDetailContent() {
   return <div />;
}
