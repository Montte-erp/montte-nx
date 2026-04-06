import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { DataTable } from "@packages/ui/components/data-table";
import type { DataTableStoredState } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Skeleton } from "@packages/ui/components/skeleton";
import { TooltipProvider } from "@packages/ui/components/tooltip";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import type { ColumnFiltersState, SortingState } from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { createLocalStorageState } from "foxact/create-local-storage-state";
import {
   Briefcase,
   Download,
   Pencil,
   Plus,
   Search,
   Trash2,
   Upload,
} from "lucide-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DefaultHeader } from "@/components/default-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { ServiceImportDialogStack } from "@/features/services/ui/service-import-dialog-stack";
import { ServicesAnalyticsHeader } from "@/features/services/ui/services-analytics-header";
import {
   buildServiceColumns,
   type ServiceRow,
} from "@/features/services/ui/services-columns";
import { ServiceForm } from "@/features/services/ui/services-form";
import { exportServicesCsv } from "@/features/services/utils/export-services-csv";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useDialogStack } from "@/hooks/use-dialog-stack";
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
];

const [useServicesTableState] =
   createLocalStorageState<DataTableStoredState | null>(
      "montte:datatable:services",
      null,
   );

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
// Filters
// =============================================================================

interface FiltersState {
   search: string;
   type: string;
   categoryId: string;
}

function ServiceFilters({
   filters,
   onChange,
   categories,
}: {
   filters: FiltersState;
   onChange: (f: FiltersState) => void;
   categories: { id: string; name: string }[] | undefined;
}) {
   return (
      <div className="flex flex-wrap items-center gap-2">
         <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
               className="pl-8"
               onChange={(e) =>
                  onChange({ ...filters, search: e.target.value })
               }
               placeholder="Buscar serviços..."
               value={filters.search}
            />
         </div>
         <Select
            onValueChange={(v) =>
               onChange({ ...filters, type: v === "all" ? "" : v })
            }
            value={filters.type || "all"}
         >
            <SelectTrigger className="w-[180px]">
               <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="all">Todos os tipos</SelectItem>
               {TYPE_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                     {opt.label}
                  </SelectItem>
               ))}
            </SelectContent>
         </Select>
         <Select
            onValueChange={(v) =>
               onChange({ ...filters, categoryId: v === "all" ? "" : v })
            }
            value={filters.categoryId || "all"}
         >
            <SelectTrigger className="w-[180px]">
               <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="all">Todas categorias</SelectItem>
               {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                     {cat.name}
                  </SelectItem>
               ))}
            </SelectContent>
         </Select>
      </div>
   );
}

// =============================================================================
// List
// =============================================================================

function ServicesList({ filters }: { filters: FiltersState }) {
   const [sorting, setSorting] = useState<SortingState>([]);
   const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
   const [tableState, setTableState] = useServicesTableState();
   const { data: servicesList } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({}),
   );

   const { openDialogStack, closeDialogStack } = useDialogStack();
   const { openAlertDialog } = useAlertDialog();

   const deleteMutation = useMutation(
      orpc.services.remove.mutationOptions({
         onSuccess: () => toast.success("Serviço excluído com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao excluir serviço."),
      }),
   );

   const filtered = useMemo(() => {
      let result = servicesList as ServiceRow[];
      if (filters.search) {
         const q = filters.search.toLowerCase();
         result = result.filter(
            (s) =>
               s.name.toLowerCase().includes(q) ||
               s.description?.toLowerCase().includes(q),
         );
      }
      if (filters.categoryId) {
         result = result.filter((s) => s.categoryId === filters.categoryId);
      }
      return result;
   }, [servicesList, filters]);

   const handleEdit = useCallback(
      (row: ServiceRow) => {
         openDialogStack({
            children: (
               <ServiceForm
                  mode="edit"
                  onSuccess={closeDialogStack}
                  service={row}
               />
            ),
         });
      },
      [openDialogStack, closeDialogStack],
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
      <div className="space-y-2">
         <div className="flex items-center gap-2">
            <Badge variant="secondary">{filtered.length} serviços</Badge>
         </div>
         <TooltipProvider>
            <DataTable
               columns={columns}
               data={filtered}
               getRowId={(row) => row.id}
               sorting={sorting}
               onSortingChange={setSorting}
               columnFilters={columnFilters}
               onColumnFiltersChange={setColumnFilters}
               tableState={tableState}
               onTableStateChange={setTableState}
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
            />
         </TooltipProvider>
      </div>
   );
}

// =============================================================================
// Page
// =============================================================================

function ServicesPage() {
   const { openDialogStack, closeDialogStack } = useDialogStack();

   const [filters, setFilters] = useState<FiltersState>({
      search: "",
      type: "",
      categoryId: "",
   });

   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const categories = categoriesResult;

   const { data: servicesList } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({}),
   );

   const handleCreate = useCallback(() => {
      openDialogStack({
         children: <ServiceForm mode="create" onSuccess={closeDialogStack} />,
      });
   }, [openDialogStack, closeDialogStack]);

   const handleImport = useCallback(() => {
      openDialogStack({
         children: <ServiceImportDialogStack />,
      });
   }, [openDialogStack]);

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
                     <Upload className="size-4 mr-1" />
                     Importar
                  </Button>
                  <Button onClick={handleExport} variant="outline">
                     <Download className="size-4 mr-1" />
                     Exportar
                  </Button>
                  <Button onClick={handleCreate}>
                     <Plus className="size-4 mr-1" />
                     Novo Serviço
                  </Button>
               </div>
            }
            description="Gerencie o catálogo de serviços"
            title="Serviços"
         />
         <ServicesAnalyticsHeader />
         <EarlyAccessBanner template={SERVICES_BANNER} />
         <ServiceFilters
            categories={categories}
            filters={filters}
            onChange={setFilters}
         />
         <Suspense fallback={<ServicesSkeleton />}>
            <ServicesList filters={filters} />
         </Suspense>
      </main>
   );
}
