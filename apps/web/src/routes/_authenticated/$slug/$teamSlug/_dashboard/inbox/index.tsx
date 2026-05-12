import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import { QuickStartChecklist } from "./-inbox/quick-start-checklist";
import { InboxFilters, type InboxSeverityFilter } from "./-inbox/inbox-filters";
import { InboxList } from "./-inbox/inbox-list";

const searchSchema = z.object({
   severity: z
      .enum(["all", "urgent", "warning", "info"])
      .catch("all")
      .default("all"),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/inbox/",
)({
   validateSearch: searchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.inbox.list.queryOptions());
   },
   pendingMs: 300,
   pendingComponent: InboxPageSkeleton,
   head: () => ({ meta: [{ title: "Inbox — Montte" }] }),
   component: InboxPage,
});

function InboxPageSkeleton() {
   return (
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto">
         <Skeleton className="h-9 w-72" />
         <Skeleton className="h-9 w-96" />
         <Skeleton className="h-32" />
         <Skeleton className="h-32" />
         <Skeleton className="h-32" />
      </main>
   );
}

function InboxPageContent() {
   const navigate = Route.useNavigate();
   const { severity } = Route.useSearch();
   const { data } = useSuspenseQuery(orpc.inbox.list.queryOptions());

   const onSeverityChange = (value: InboxSeverityFilter) => {
      navigate({
         search: (prev) => ({ ...prev, severity: value }),
         replace: true,
      });
   };

   return (
      <main className="flex flex-1 flex-col gap-4 overflow-y-auto">
         <header className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">Inbox</h1>
            <p className="text-muted-foreground text-sm">
               Sinais acionáveis do seu negócio: vencimentos, categorização
               pendente e eventos do sistema.
            </p>
         </header>
         <QuickStartChecklist />
         <InboxFilters
            value={severity}
            counts={data.counts}
            onChange={onSeverityChange}
         />
         <InboxList severity={severity} />
      </main>
   );
}

function InboxPage() {
   return (
      <QueryBoundary
         fallback={<InboxPageSkeleton />}
         errorTitle="Erro ao carregar inbox"
         errorDescription="Não foi possível carregar a inbox."
         retryText="Tentar novamente"
      >
         <InboxPageContent />
      </QueryBoundary>
   );
}
