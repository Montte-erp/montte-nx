import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import {
   closeContextPanel,
   openContextPanel,
   useContextPanelInfo,
} from "@/features/context-panel/use-context-panel";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { orpc } from "@/integrations/orpc/client";
import { ServicePricesTab } from "../-services/service-prices-tab";
import { ServicePropertiesPanel } from "../-services/service-properties-panel";

const VALID_TABS = ["precos", "beneficios", "assinantes", "overview"] as const;

const searchSchema = z.object({
   tab: z.enum(VALID_TABS).catch("precos").default("precos"),
});

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/erp/services/$serviceId",
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
         <Skeleton className="h-10 w-64" />
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
                  to: "/$slug/$teamSlug/erp/services",
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
            <div className="flex items-center gap-2">
               <TabsList>
                  <TabsTrigger value="precos">Preços</TabsTrigger>
                  <TabsTrigger value="beneficios">Benefícios</TabsTrigger>
                  <TabsTrigger value="assinantes">Assinantes</TabsTrigger>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
               </TabsList>
            </div>

            <TabsContent value="precos">
               <QueryBoundary fallback={null}>
                  <ServicePricesTab serviceId={serviceId} />
               </QueryBoundary>
            </TabsContent>
            <TabsContent value="beneficios">
               <QueryBoundary fallback={null}>
                  <PlaceholderTab label="Benefícios" />
               </QueryBoundary>
            </TabsContent>
            <TabsContent value="assinantes">
               <QueryBoundary fallback={null}>
                  <PlaceholderTab label="Assinantes" />
               </QueryBoundary>
            </TabsContent>
            <TabsContent value="overview">
               <QueryBoundary fallback={null}>
                  <PlaceholderTab label="Overview" />
               </QueryBoundary>
            </TabsContent>
         </Tabs>
      </main>
   );
}

function PlaceholderTab({ label }: { label: string }) {
   return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
         {label} — em construção
      </div>
   );
}
