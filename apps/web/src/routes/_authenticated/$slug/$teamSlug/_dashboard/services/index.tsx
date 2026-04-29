import { Tabs, TabsList, TabsTrigger } from "@packages/ui/components/tabs";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import { buildServiceColumns } from "./-services/services-columns";
import { ServicesList } from "./-services/services-list";
import { requestTour } from "./-tour/store";
import { TourHelpButton } from "./-tour/tour-help-button";

type ViewFilter = "todos" | "ativos" | "arquivados";

const skeletonColumns = buildServiceColumns();

const servicesSearchSchema = z.object({
   view: z
      .enum(["todos", "ativos", "arquivados"])
      .catch("todos")
      .default("todos"),
   search: z.string().catch("").default(""),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/services/",
)({
   validateSearch: servicesSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.services.getAll.queryOptions({}));
      context.queryClient.prefetchQuery(
         orpc.services.getAllStats.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
   },
   onEnter: () => {
      requestTour("services-overview");
   },
   pendingMs: 300,
   pendingComponent: () => (
      <main className="flex h-full flex-col gap-4">
         <DataTableSkeleton columns={skeletonColumns} />
      </main>
   ),
   head: () => ({
      meta: [{ title: "Gestão de Serviços — Montte" }],
   }),
   component: ServicesPage,
});

function ServicesPage() {
   const navigate = Route.useNavigate();
   const { view } = Route.useSearch();

   const handleViewChange = useCallback(
      (next: string) => {
         navigate({
            search: (prev) => ({
               ...prev,
               view: next as ViewFilter,
               search: "",
            }),
            replace: true,
         });
      },
      [navigate],
   );

   return (
      <main className="flex h-full flex-col gap-4">
         <DefaultHeader
            actions={<TourHelpButton tourId="services-overview" />}
            description="Gerencie o catálogo de serviços"
            title="Serviços"
            secondaryActions={
               <div id="tour-services-tabs">
                  <Tabs onValueChange={handleViewChange} value={view}>
                     <TabsList>
                        <TabsTrigger value="todos">Todos</TabsTrigger>
                        <TabsTrigger value="ativos">Ativos</TabsTrigger>
                        <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
                     </TabsList>
                  </Tabs>
               </div>
            }
         />
         <div className="flex flex-1 flex-col min-h-0">
            <QueryBoundary
               fallback={<DataTableSkeleton columns={skeletonColumns} />}
               errorTitle="Erro ao carregar serviços"
            >
               <ServicesList />
            </QueryBoundary>
         </div>
      </main>
   );
}
