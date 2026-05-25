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
   "/_authenticated/$slug/$teamSlug/_dashboard/suppliers",
)({
   validateSearch: relationshipsSearchSchema,
   ssr: false,
   pendingMs: 300,
   pendingComponent: RelationshipsTableSkeleton,
   head: () => ({
      meta: [{ title: "Fornecedores — Montte" }],
   }),
   component: SuppliersPage,
});

function SuppliersPage() {
   const search = Route.useSearch();
   const navigate = Route.useNavigate();
   const { queryClient } = Route.useRouteContext();

   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Gerencie fornecedores ativos e arquivados"
            title="Fornecedores"
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<RelationshipsTableSkeleton />}
               errorTitle="Erro ao carregar fornecedores"
            >
               <RelationshipsTable
                  createLabel="Adicionar fornecedor"
                  emptyDescription="Adicione um fornecedor para vincular lançamentos e manter a base organizada."
                  emptyTitle="Nenhum fornecedor encontrado"
                  onSearchChange={(next) =>
                     navigate({
                        search: (prev) => ({ ...prev, ...next }),
                        replace: true,
                     })
                  }
                  queryClient={queryClient}
                  role="supplier"
                  searchState={search}
                  storageKey="relationships-suppliers"
               />
            </QueryBoundary>
         </div>
      </main>
   );
}
