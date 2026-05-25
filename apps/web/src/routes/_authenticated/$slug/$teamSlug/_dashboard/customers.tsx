import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import {
   RelationshipsTable,
   RelationshipsTableSkeleton,
} from "@/features/relationships/relationships-table";
import { DefaultHeader } from "../-layout/default-header";

const relationshipsSearchSchema = z.object({
   sorting: z
      .array(z.object({ id: z.string(), desc: z.boolean() }))
      .catch([{ id: "name", desc: false }])
      .default([{ id: "name", desc: false }]),
   columnFilters: z
      .array(z.object({ id: z.string(), value: z.unknown() }))
      .catch([])
      .default([]),
   search: z.string().catch("").default(""),
   view: z.enum(["active", "archived"]).catch("active").default("active"),
   page: z.number().int().min(1).catch(1).default(1),
   pageSize: z.number().int().min(1).max(100).catch(20).default(20),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/customers",
)({
   validateSearch: relationshipsSearchSchema,
   ssr: false,
   pendingMs: 300,
   pendingComponent: RelationshipsTableSkeleton,
   head: () => ({
      meta: [{ title: "Clientes — Montte" }],
   }),
   component: CustomersPage,
});

function CustomersPage() {
   const search = Route.useSearch();
   const navigate = Route.useNavigate();
   const { queryClient } = Route.useRouteContext();

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Gerencie clientes ativos e arquivados"
            title="Clientes"
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<RelationshipsTableSkeleton />}
               errorTitle="Erro ao carregar clientes"
            >
               <RelationshipsTable
                  createLabel="Adicionar cliente"
                  emptyDescription="Adicione um cliente para vincular lançamentos e acompanhar o relacionamento."
                  emptyTitle="Nenhum cliente encontrado"
                  onSearchChange={(next) =>
                     navigate({
                        search: (prev) => ({ ...prev, ...next }),
                        replace: true,
                     })
                  }
                  queryClient={queryClient}
                  role="customer"
                  searchState={search}
                  storageKey="relationships-customers"
               />
            </QueryBoundary>
         </div>
      </main>
   );
}
