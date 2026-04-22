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
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DefaultHeader } from "@/components/default-header";
import {
   EarlyAccessBanner,
   type EarlyAccessBannerTemplate,
} from "@/features/billing/ui/early-access-banner";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { QueryBoundary } from "@/components/query-boundary";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableExternalFilter,
   DataTableRoot,
} from "@/components/data-table/data-table-root";
import { DataTableSkeleton } from "@/components/data-table/data-table-skeleton";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import {
   buildServiceColumns,
   type ServiceRow,
} from "./-services/services-columns";
import { ServicesAnalyticsHeader } from "./-services/services-analytics-header";

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

const servicesSearchSchema = z.object({
   search: z.string().catch("").default(""),
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
   const { search, categoryId } = Route.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();

   const { data: servicesList } = useSuspenseQuery(
      orpc.services.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.services.create.mutationOptions({
         onSuccess: () => toast.success("Serviço criado com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
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

   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddService = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         if (!name) return;
         const basePrice = String(data.basePrice ?? "0") || "0";
         await createMutation.mutateAsync({ name, basePrice });
         setIsDraftActive(false);
      },
      [createMutation],
   );

   const importConfig: DataTableImportConfig = useMemo(
      () => ({
         accept: {
            "text/csv": [".csv"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
               [".xlsx"],
            "application/vnd.ms-excel": [".xls"],
         },
         parseFile: async (file: File) => {
            const ext = file.name.split(".").pop()?.toLowerCase();
            if (ext === "xlsx" || ext === "xls") return parseXlsx(file);
            return parseCsv(file);
         },
         mapRow: (row, i): Record<string, unknown> => ({
            id: `__import_${i}`,
            name: String(row.name ?? "").trim(),
            description: String(row.description ?? "").trim() || null,
            basePrice:
               String(row.basePrice ?? row.price ?? "0")
                  .replace(/[R$\s.]/g, "")
                  .replace(",", ".") || "0",
            categoryId: null,
            categoryName: null,
            categoryColor: null,
            tagId: null,
            tagName: null,
            tagColor: null,
            isActive: true,
         }),
         onImport: async (rows) => {
            await Promise.allSettled(
               rows.map((r) =>
                  createMutation.mutateAsync({
                     name: String(r.name ?? "").trim(),
                     basePrice: String(r.basePrice ?? "0") || "0",
                     description:
                        r.description != null
                           ? String(r.description) || undefined
                           : undefined,
                  }),
               ),
            );
         },
      }),
      [createMutation, parseCsv, parseXlsx],
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
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddService}
         onDiscardAddRow={handleDiscardDraft}
         renderActions={({ row }) => (
            <Button
               className="text-destructive hover:text-destructive"
               onClick={() => handleDelete(row.original)}
               tooltip="Excluir"
               variant="outline"
            >
               <Trash2 className="size-4" />
            </Button>
         )}
      >
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
         >
            <DataTableImportButton importConfig={importConfig} />
            <Button
               onClick={() => setIsDraftActive(true)}
               size="icon-sm"
               tooltip="Novo Serviço"
               variant="outline"
            >
               <Plus />
            </Button>
         </DataTableToolbar>
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
   return (
      <main className="flex flex-col gap-4">
         <DefaultHeader
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
