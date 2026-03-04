import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   Briefcase,
   LayoutGrid,
   LayoutList,
   Pencil,
   Plus,
   Trash2,
} from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { ServicesAnalyticsHeader } from "@/features/services/ui/services-analytics-header";
import {
   buildServiceColumns,
   type ServiceRow,
} from "@/features/services/ui/services-columns";
import { ServiceForm } from "@/features/services/ui/services-form";
import {
   useViewSwitch,
   type ViewConfig,
} from "@/features/view-switch/hooks/use-view-switch";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

const SERVICE_VIEWS: [
   ViewConfig<"table" | "card">,
   ViewConfig<"table" | "card">,
] = [
   { id: "table", label: "Tabela", icon: <LayoutList className="size-4" /> },
   { id: "card", label: "Cards", icon: <LayoutGrid className="size-4" /> },
];

const SERVICES_BANNER: EarlyAccessBannerTemplate = {
   badgeLabel: "Serviços",
   message: "Esta funcionalidade está em conceito.",
   ctaLabel: "Deixar feedback",
   stage: "concept",
   icon: Briefcase,
   bullets: [
      "Cadastre serviços e defina preços",
      "Vincule serviços a cobranças e projetos",
      "Seu feedback nos ajuda a melhorar",
   ],
};

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/erp/services",
)({
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.services.getAll.queryOptions({}));
   },
   component: ServicesPage,
});

// =============================================================================
// Skeleton
// =============================================================================

function ServicesSkeleton() {
   return (
      <div className="space-y-3">
         {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton className="h-12 w-full" key={`skel-${i + 1}`} />
         ))}
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

function ServicesList({ view }: { view: "table" | "card" }) {
   const { data: servicesList } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({}),
   );

   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const deleteMutation = useMutation(
      orpc.services.remove.mutationOptions({
         onSuccess: () => toast.success("Serviço excluído com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao excluir serviço."),
      }),
   );

   const handleEdit = useCallback(
      (row: ServiceRow) => {
         openCredenza({
            children: (
               <ServiceForm
                  mode="edit"
                  onSuccess={closeCredenza}
                  service={row}
               />
            ),
         });
      },
      [openCredenza, closeCredenza],
   );

   const handleDelete = useCallback(
      (row: ServiceRow) => {
         openAlertDialog({
            title: "Excluir serviço",
            description: `Tem certeza que deseja excluir o serviço "${row.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: row.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
   );

   if (servicesList.length === 0) {
      return (
         <Empty>
            <EmptyMedia>
               <Briefcase className="size-10" />
            </EmptyMedia>
            <EmptyHeader>
               <EmptyTitle>Nenhum serviço cadastrado</EmptyTitle>
               <EmptyDescription>
                  Adicione serviços para começar a gerenciar seu catálogo.
               </EmptyDescription>
            </EmptyHeader>
         </Empty>
      );
   }

   const columns = buildServiceColumns();

   return (
      <DataTable
         columns={columns}
         data={servicesList as ServiceRow[]}
         getRowId={(row) => row.id}
         renderActions={({ row }) => (
            <>
               <Button
                  onClick={() => handleEdit(row.original)}
                  tooltip="Editar"
                  variant="outline"
               >
                  <Pencil className="size-4" />
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  tooltip="Excluir"
                  variant="outline"
               >
                  <Trash2 className="size-4" />
               </Button>
            </>
         )}
         view={view}
      />
   );
}

// =============================================================================
// Page
// =============================================================================

function ServicesPage() {
   const { openCredenza, closeCredenza } = useCredenza();
   const { currentView, setView, views } = useViewSwitch(
      "erp:services:view",
      SERVICE_VIEWS,
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         children: <ServiceForm mode="create" onSuccess={closeCredenza} />,
      });
   }, [openCredenza, closeCredenza]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <Button onClick={handleCreate}>
                  <Plus className="size-4 mr-1" />
                  Novo Serviço
               </Button>
            }
            description="Gerencie o catálogo de serviços"
            title="Serviços"
            viewSwitch={{ options: views, currentView, onViewChange: setView }}
         />
         <ServicesAnalyticsHeader />
         <EarlyAccessBanner template={SERVICES_BANNER} />
         <Suspense fallback={<ServicesSkeleton />}>
            <ServicesList view={currentView} />
         </Suspense>
      </main>
   );
}
