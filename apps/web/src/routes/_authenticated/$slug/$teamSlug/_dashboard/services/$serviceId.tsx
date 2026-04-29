import { Skeleton } from "@packages/ui/components/skeleton";
import { Tabs, TabsContent } from "@packages/ui/components/tabs";
import { ServiceTabsList } from "./-services/service-tabs-list";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import {
   closeContextPanel,
   openContextPanel,
   useContextPanelInfo,
} from "@/features/context-panel/use-context-panel";
import { orpc } from "@/integrations/orpc/client";
import { ServiceBenefitsTab } from "./-services/service-benefits-tab";
import { ServiceOverviewTab } from "./-services/service-overview-tab";
import { ServicePricesTab } from "./-services/service-prices-tab";
import { ServicePropertiesPanel } from "./-services/service-properties-panel";
import { ServiceSubscribersTab } from "./-services/service-subscribers-tab";

const VALID_TABS = ["precos", "beneficios", "assinantes", "overview"] as const;

const searchSchema = z.object({
   tab: z.enum(VALID_TABS).catch("precos").default("precos"),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/services/$serviceId",
)({
   validateSearch: searchSchema,
   loader: ({ context, params }) => {
      context.queryClient.prefetchQuery(
         orpc.services.getById.queryOptions({
            input: { id: params.serviceId },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.services.getVariants.queryOptions({
            input: { serviceId: params.serviceId },
         }),
      );
      context.queryClient.prefetchQuery(
         orpc.benefits.getServiceBenefits.queryOptions({
            input: { serviceId: params.serviceId },
         }),
      );
      context.queryClient.prefetchQuery(orpc.meters.getMeters.queryOptions({}));
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
      context.queryClient.prefetchQuery(
         orpc.tags.getAll.queryOptions({ input: {} }),
      );
   },
   pendingMs: 300,
   pendingComponent: ServiceDetailSkeleton,
   head: () => ({ meta: [{ title: "Serviço — Montte" }] }),
   component: ServiceDetailPage,
});

function ServiceDetailSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-64 w-full" />
      </div>
   );
}

function ServiceDetailPage() {
   return (
      <QueryBoundary
         fallback={<ServiceDetailSkeleton />}
         errorTitle="Erro ao carregar serviço"
      >
         <ServiceDetailContent />
      </QueryBoundary>
   );
}

function ServiceDetailContent() {
   const { serviceId } = Route.useParams();
   const navigate = Route.useNavigate();
   const globalNavigate = useNavigate();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { tab: activeTab } = Route.useSearch();

   const { data: service } = useSuspenseQuery(
      orpc.services.getById.queryOptions({ input: { id: serviceId } }),
   );

   useEffect(() => {
      openContextPanel();
      return () => closeContextPanel();
   }, []);

   useContextPanelInfo(() => <ServicePropertiesPanel service={service} />);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            title={service.name}
            description={service.description ?? "Sem descrição"}
            onBack={() =>
               globalNavigate({
                  to: "/$slug/$teamSlug/services",
                  params: { slug, teamSlug },
               })
            }
         />
         <Tabs
            value={activeTab}
            onValueChange={(v) => {
               const next = VALID_TABS.find((t) => t === v);
               if (!next) return;
               navigate({
                  search: (prev) => ({ ...prev, tab: next }),
                  replace: true,
               });
            }}
         >
            <ServiceTabsList />
            <TabsContent value="precos">
               <QueryBoundary fallback={null}>
                  <ServicePricesTab serviceId={serviceId} />
               </QueryBoundary>
            </TabsContent>
            <TabsContent value="beneficios">
               <QueryBoundary fallback={null}>
                  <ServiceBenefitsTab serviceId={serviceId} />
               </QueryBoundary>
            </TabsContent>
            <TabsContent value="assinantes">
               <QueryBoundary fallback={null}>
                  <ServiceSubscribersTab serviceId={serviceId} />
               </QueryBoundary>
            </TabsContent>
            <TabsContent value="overview">
               <QueryBoundary fallback={null}>
                  <ServiceOverviewTab serviceId={serviceId} />
               </QueryBoundary>
            </TabsContent>
         </Tabs>
      </main>
   );
}
