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
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { Suspense, useCallback } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import { ServicesAnalyticsHeader } from "@/features/services/ui/services-analytics-header";
import {
   buildServiceColumns,
   type ServiceRow,
} from "@/features/services/ui/services-columns";
import { ServiceForm } from "@/features/services/ui/services-form";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { orpc } from "@/integrations/orpc/client";

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

function ServicesList() {
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

   const columns = buildServiceColumns(handleEdit, handleDelete);

   return (
      <DataTable
         columns={columns}
         data={servicesList as ServiceRow[]}
         getRowId={(row) => row.id}
         renderMobileCard={({ row }) => (
            <div className="rounded-lg border bg-background p-4 space-y-3">
               <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                     <p className="font-medium truncate">{row.original.name}</p>
                     {row.original.category && (
                        <p className="text-xs text-muted-foreground mt-1">
                           {row.original.category}
                        </p>
                     )}
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <Button
                     onClick={() => handleEdit(row.original)}
                     variant="outline"
                  >
                     <Pencil className="size-3 mr-1" />
                     Editar
                  </Button>
                  <Button
                     className="text-destructive"
                     onClick={() => handleDelete(row.original)}
                     variant="ghost"
                  >
                     <Trash2 className="size-3 mr-1" />
                     Excluir
                  </Button>
               </div>
            </div>
         )}
      />
   );
}

// =============================================================================
// Page
// =============================================================================

function ServicesPage() {
   const { openCredenza, closeCredenza } = useCredenza();

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
         />
         <ServicesAnalyticsHeader />
         <EarlyAccessBanner template={SERVICES_BANNER} />
         <Suspense fallback={<ServicesSkeleton />}>
            <ServicesList />
         </Suspense>
      </main>
   );
}
