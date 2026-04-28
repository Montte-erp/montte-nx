import { Button } from "@packages/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tabs,
   TabsContent,
   TabsList,
   TabsTrigger,
} from "@packages/ui/components/tabs";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
   Archive,
   ArchiveRestore,
   Copy,
   MoreVertical,
   Trash2,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import { QueryBoundary } from "@/components/query-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import {
   closeContextPanel,
   openContextPanel,
   useContextPanelInfo,
} from "@/features/context-panel/use-context-panel";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
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
   const { openAlertDialog } = useAlertDialog();

   const { data: service } = useSuspenseQuery(
      orpc.services.getById.queryOptions({ input: { id: serviceId } }),
   );

   const updateMutation = useMutation(
      orpc.services.update.mutationOptions({
         onSuccess: () => toast.success("Serviço atualizado."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const createMutation = useMutation(
      orpc.services.create.mutationOptions({
         onSuccess: (created) => {
            toast.success("Serviço duplicado.");
            globalNavigate({
               to: "/$slug/$teamSlug/services/$serviceId",
               params: { slug, teamSlug, serviceId: created.id },
            });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const deleteMutation = useMutation(
      orpc.services.remove.mutationOptions({
         onSuccess: () => {
            toast.success("Serviço excluído.");
            globalNavigate({
               to: "/$slug/$teamSlug/services",
               params: { slug, teamSlug },
            });
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   useEffect(() => {
      openContextPanel();
      return () => closeContextPanel();
   }, []);

   useContextPanelInfo(() => <ServicePropertiesPanel service={service} />);

   function handleDuplicate() {
      createMutation.mutate({
         name: `${service.name} (cópia)`,
         description: service.description,
         categoryId: service.categoryId,
         tagId: service.tagId,
      });
   }

   function handleArchiveToggle() {
      updateMutation.mutate({
         id: service.id,
         isActive: !service.isActive,
      });
   }

   function handleDelete() {
      openAlertDialog({
         title: "Excluir serviço",
         description: `Excluir "${service.name}"? Assinaturas vinculadas impedirão a exclusão.`,
         actionLabel: "Excluir",
         cancelLabel: "Cancelar",
         variant: "destructive",
         onAction: async () => {
            await deleteMutation.mutateAsync({ id: service.id });
         },
      });
   }

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
            actions={
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button size="icon" tooltip="Ações" variant="ghost">
                        <MoreVertical />
                        <span className="sr-only">Ações</span>
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                     <DropdownMenuItem onClick={handleDuplicate}>
                        <Copy />
                        Duplicar serviço
                     </DropdownMenuItem>
                     <DropdownMenuItem onClick={handleArchiveToggle}>
                        {service.isActive ? <Archive /> : <ArchiveRestore />}
                        {service.isActive ? "Arquivar" : "Reativar"}
                     </DropdownMenuItem>
                     <DropdownMenuSeparator />
                     <DropdownMenuItem
                        className="text-destructive"
                        onClick={handleDelete}
                     >
                        <Trash2 />
                        Excluir
                     </DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
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
