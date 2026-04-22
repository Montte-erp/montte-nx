import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
   Briefcase,
   Download,
   Pencil,
   Plus,
   Trash2,
   Upload,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { ServiceImportCredenza } from "@/features/services/ui/service-import-credenza";
import { ServicesAnalyticsHeader } from "@/features/services/ui/services-analytics-header";
import {
   buildServiceColumns,
   type ServiceRow,
} from "@/features/services/ui/services-columns";
import { ServiceForm } from "@/features/services/ui/services-form";
import { exportServicesCsv } from "@/features/services/utils/export-services-csv";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { QueryBoundary } from "@/components/query-boundary";
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

const TYPE_FILTER_OPTIONS = [
   { value: "service", label: "Prestação de serviço" },
   { value: "product", label: "Produto" },
   { value: "subscription", label: "Assinatura" },
] as const;

const servicesSearchSchema = z.object({
   search: z.string().catch("").default(""),
   type: z
      .enum(["service", "product", "subscription"])
      .optional()
      .catch(undefined),
   categoryId: z.string().optional().catch(undefined),
});

const skeletonColumns = buildServiceColumns();

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/erp/services",
)({
   validateSearch: servicesSearchSchema,
   loader: ({ context }) => {
      context.queryClient.prefetchQuery(orpc.services.getAll.queryOptions({}));
      context.queryClient.prefetchQuery(
         orpc.categories.getAll.queryOptions({}),
      );
   },
   pendingMs: 300,
   pendingComponent: ServicesSkeleton,
   head: () => ({
      meta: [{ title: "Gestão de Serviços — Montte" }],
   }),
   component: ServicesPage,
});

function ServicesSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function ServicesList() {
   const navigate = Route.useNavigate();
   const { search, type, categoryId } = Route.useSearch();
   const { openCredenza, closeCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();

   const { data: servicesList } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const deleteMutation = useMutation(
      orpc.services.remove.mutationOptions({
         onSuccess: () => toast.success("Serviço excluído com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao excluir serviço."),
      }),
   );

   const filtered = useMemo(() => {
      let result = servicesList as ServiceRow[];
      if (search) {
         const q = search.toLowerCase();
         result = result.filter(
            (s) =>
               s.name.toLowerCase().includes(q) ||
               s.description?.toLowerCase().includes(q),
         );
      }
      if (categoryId) {
         result = result.filter((s) => s.categoryId === categoryId);
      }
      return result;
   }, [servicesList, search, categoryId]);

   const handleEdit = useCallback(
      (row: ServiceRow) => {
         openCredenza({
            renderChildren: () => (
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

   const columns = useMemo(() => buildServiceColumns(), []);

   return (
      <DataTableRoot
         columns={columns}
         data={filtered}
         getRowId={(row) => row.id}
         storageKey="montte:datatable:services"
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
      >
         {TYPE_FILTER_OPTIONS.map((opt) => (
            <DataTableExternalFilter
               key={opt.value}
               id={`type:${opt.value}`}
               label={opt.label}
               group="Tipo"
               active={type === opt.value}
               onToggle={(active) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        type: active ? opt.value : undefined,
                     }),
                     replace: true,
                  })
               }
            />
         ))}
         {categories?.map((cat) => (
            <DataTableExternalFilter
               key={cat.id}
               id={`category:${cat.id}`}
               label={cat.name}
               group="Categoria"
               active={categoryId === cat.id}
               onToggle={(active) =>
                  navigate({
                     search: (prev) => ({
                        ...prev,
                        categoryId: active ? cat.id : undefined,
                     }),
                     replace: true,
                  })
               }
            />
         ))}
         <DataTableToolbar
            searchPlaceholder="Buscar serviços..."
            searchDefaultValue={search}
            onSearch={(value) =>
               navigate({
                  search: (prev) => ({ ...prev, search: value }),
                  replace: true,
               })
            }
         />
         <DataTableContent />
         <DataTableEmptyState>
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
         </DataTableEmptyState>
      </DataTableRoot>
   );
}

function ServicesPage() {
   const { openCredenza, closeCredenza } = useCredenza();

   const { data: servicesList } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({}),
   );

   const handleCreate = useCallback(() => {
      openCredenza({
         renderChildren: () => (
            <ServiceForm mode="create" onSuccess={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   const handleImport = useCallback(() => {
      openCredenza({
         renderChildren: () => (
            <ServiceImportCredenza onClose={closeCredenza} />
         ),
      });
   }, [openCredenza, closeCredenza]);

   const handleExport = useCallback(() => {
      if (servicesList && servicesList.length > 0) {
         exportServicesCsv(servicesList as ServiceRow[]);
         toast.success("CSV exportado.");
      } else {
         toast.info("Nenhum serviço para exportar.");
      }
   }, [servicesList]);

   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
            actions={
               <div className="flex items-center gap-2">
                  <Button onClick={handleImport} variant="outline">
                     <Upload className="size-4" />
                     Importar
                  </Button>
                  <Button onClick={handleExport} variant="outline">
                     <Download className="size-4" />
                     Exportar
                  </Button>
                  <Button onClick={handleCreate}>
                     <Plus className="size-4" />
                     Novo Serviço
                  </Button>
               </div>
            }
            description="Gerencie o catálogo de serviços"
            title="Serviços"
         />
         <ServicesAnalyticsHeader />
         <EarlyAccessBanner template={SERVICES_BANNER} />
         <QueryBoundary fallback={<ServicesSkeleton />}>
            <ServicesList />
         </QueryBoundary>
      </main>
   );
}
