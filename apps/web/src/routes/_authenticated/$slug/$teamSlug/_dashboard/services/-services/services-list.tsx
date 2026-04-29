import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   useMutation,
   useQueryClient,
   useSuspenseQueries,
} from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { Briefcase, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "@packages/ui/components/sonner";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import {
   DataTableImportButton,
   type DataTableImportConfig,
} from "@/components/data-table/data-table-import";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import { buildServiceColumns, type ServiceRow } from "./services-columns";

const routeApi = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard/services/",
);

export function ServicesList() {
   const routeNavigate = routeApi.useNavigate();
   const navigate = useNavigate();
   const { search, view } = routeApi.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const queryClient = useQueryClient();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleSearch = useCallback(
      (value: string) => {
         routeNavigate({
            search: (prev) => ({ ...prev, search: value }),
            replace: true,
         });
      },
      [routeNavigate],
   );

   const [{ data: servicesList }, { data: stats }] = useSuspenseQueries({
      queries: [
         orpc.services.getAll.queryOptions({}),
         orpc.services.getAllStats.queryOptions({}),
      ],
   });

   const statsById = useMemo(
      () =>
         stats.reduce<
            Record<
               string,
               { priceCount: number; subscriberCount: number; mrr: string }
            >
         >((acc, s) => {
            acc[s.serviceId] = {
               priceCount: s.priceCount,
               subscriberCount: s.subscriberCount,
               mrr: s.mrr,
            };
            return acc;
         }, {}),
      [stats],
   );

   const filtered = useMemo(() => {
      let result: ServiceRow[] = servicesList.map((s) => {
         const st = statsById[s.id] ?? {
            priceCount: 0,
            subscriberCount: 0,
            mrr: "0",
         };
         return {
            id: s.id,
            name: s.name,
            description: s.description,
            categoryId: s.categoryId,
            categoryName: s.category?.name ?? null,
            categoryColor: s.category?.color ?? null,
            tagId: s.tagId,
            tagName: s.tag?.name ?? null,
            tagColor: s.tag?.color ?? null,
            isActive: s.isActive,
            priceCount: st.priceCount,
            subscriberCount: st.subscriberCount,
            mrr: st.mrr,
         };
      });
      if (view === "ativos") result = result.filter((s) => s.isActive);
      if (view === "arquivados") result = result.filter((s) => !s.isActive);
      if (search) {
         const q = search.toLowerCase();
         result = result.filter(
            (s) =>
               s.name.toLowerCase().includes(q) ||
               s.description?.toLowerCase().includes(q),
         );
      }
      return result;
   }, [servicesList, statsById, search, view]);

   const createMutation = useMutation(
      orpc.services.create.mutationOptions({
         onSuccess: () => toast.success("Serviço criado com sucesso."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const importMutation = useMutation(
      orpc.services.bulkCreate.mutationOptions({
         meta: { skipGlobalInvalidation: true },
      }),
   );

   const deleteMutation = useMutation(
      orpc.services.remove.mutationOptions({
         onSuccess: () => toast.success("Serviço excluído com sucesso."),
         onError: (e) => toast.error(e.message || "Erro ao excluir serviço."),
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.services.bulkRemove.mutationOptions({
         onError: (e) => toast.error(e.message || "Erro ao excluir serviços."),
      }),
   );

   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddService = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         if (!name) return;
         await createMutation.mutateAsync({ name });
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
         }),
         onImport: async (rows) => {
            const items: { name: string; description?: string }[] = [];
            for (const r of rows) {
               const name = String(r.name ?? "").trim();
               if (!name) continue;
               const description =
                  r.description != null
                     ? String(r.description) || undefined
                     : undefined;
               items.push({ name, description });
            }
            if (items.length === 0) {
               toast.error("Nenhum serviço válido para importar.");
               return;
            }
            const created = await importMutation
               .mutateAsync({ items })
               .catch(() => null);
            if (!created) {
               toast.error(`${items.length} serviço(s) com erro.`);
               return;
            }
            const ok = created.length;
            const failed = items.length - ok;
            if (ok > 0) toast.success(`${ok} serviço(s) importado(s).`);
            if (failed > 0) toast.error(`${failed} serviço(s) com erro.`);
            await queryClient.invalidateQueries({
               queryKey: orpc.services.getAll.queryKey(),
            });
         },
      }),
      [parseCsv, parseXlsx, importMutation, queryClient],
   );

   const handleDelete = useCallback(
      (row: ServiceRow) => {
         openAlertDialog({
            title: "Excluir serviço",
            description: `Excluir "${row.name}"? Esta ação não pode ser desfeita.`,
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

   const groupBy = useCallback(
      (row: ServiceRow) => row.categoryName ?? "Sem categoria",
      [],
   );

   return (
      <DataTableRoot
         columns={columns}
         data={filtered}
         getRowId={(r) => r.id}
         groupBy={groupBy}
         isDraftRowActive={isDraftActive}
         onAddRow={handleAddService}
         onDiscardAddRow={handleDiscardDraft}
         renderActions={({ row }) => (
            <>
               <Button
                  onClick={() =>
                     navigate({
                        to: "/$slug/$teamSlug/services/$serviceId",
                        params: {
                           slug,
                           teamSlug,
                           serviceId: row.original.id,
                        },
                     })
                  }
                  size="icon"
                  tooltip="Ver detalhes"
                  variant="ghost"
               >
                  <ExternalLink className="size-4" />
                  <span className="sr-only">Ver detalhes</span>
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  size="icon"
                  tooltip="Excluir"
                  variant="ghost"
               >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Excluir</span>
               </Button>
            </>
         )}
         storageKey="montte:datatable:services"
      >
         <div className="flex flex-col gap-4">
            <DataTableToolbar
               searchPlaceholder="Buscar serviços..."
               searchDefaultValue={search}
               onSearch={handleSearch}
            >
               <DataTableImportButton importConfig={importConfig} />
               <Button
                  id="tour-services-create"
                  onClick={() => setIsDraftActive(true)}
                  size="icon-sm"
                  tooltip="Novo Serviço"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo Serviço</span>
               </Button>
            </DataTableToolbar>
            <DataTableContent />
            <DataTableEmptyState>
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Briefcase className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum serviço cadastrado</EmptyTitle>
                     <EmptyDescription>
                        {search ? (
                           "Nenhum serviço encontrado para a busca."
                        ) : (
                           <>
                              Crie seu primeiro serviço. Antes, configure{" "}
                              <Link
                                 className="underline underline-offset-2"
                                 params={{ slug, teamSlug }}
                                 to="/$slug/$teamSlug/services/meters"
                              >
                                 medidores
                              </Link>{" "}
                              de consumo se cobra por uso.
                           </>
                        )}
                     </EmptyDescription>
                  </EmptyHeader>
                  {!search && (
                     <EmptyContent>
                        <Button onClick={() => setIsDraftActive(true)}>
                           <Plus />
                           Novo serviço
                        </Button>
                     </EmptyContent>
                  )}
               </Empty>
            </DataTableEmptyState>
            <DataTableBulkActions<ServiceRow>>
               {({ selectedRows, clearSelection }) => {
                  const ids = selectedRows.map((r) => r.id);
                  return (
                     <SelectionActionButton
                        icon={<Trash2 />}
                        variant="destructive"
                        onClick={() =>
                           openAlertDialog({
                              title: `Excluir ${ids.length} ${ids.length === 1 ? "serviço" : "serviços"}`,
                              description:
                                 "Tem certeza que deseja excluir os serviços selecionados? Esta ação não pode ser desfeita.",
                              actionLabel: "Excluir",
                              cancelLabel: "Cancelar",
                              variant: "destructive",
                              onAction: async () => {
                                 const res = await bulkDeleteMutation
                                    .mutateAsync({ ids })
                                    .catch(() => null);
                                 if (res) {
                                    if (res.deleted > 0)
                                       toast.success(
                                          `${res.deleted} serviço(s) excluído(s).`,
                                       );
                                    if (res.failed > 0)
                                       toast.error(
                                          `${res.failed} serviço(s) com erro.`,
                                       );
                                 }
                                 clearSelection();
                              },
                           })
                        }
                     >
                        Excluir
                     </SelectionActionButton>
                  );
               }}
            </DataTableBulkActions>
         </div>
      </DataTableRoot>
   );
}
