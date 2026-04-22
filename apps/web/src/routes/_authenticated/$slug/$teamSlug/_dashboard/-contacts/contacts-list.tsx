import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ExternalLink, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
   DataTableBulkActions,
   SelectionActionButton,
} from "@/components/data-table/data-table-bulk-actions";
import { DataTableContent } from "@/components/data-table/data-table-content";
import { DataTableEmptyState } from "@/components/data-table/data-table-empty-state";
import { DataTableImportButton } from "@/components/data-table/data-table-import";
import type { DataTableImportConfig } from "@/components/data-table/data-table-import";
import { DataTableRoot } from "@/components/data-table/data-table-root";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import { buildContactColumns, type ContactRow } from "./contacts-columns";

const routeApi = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts",
);

export function ContactsList() {
   const navigate = routeApi.useNavigate();
   const { typeFilter, search } = routeApi.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const queryClient = useQueryClient();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { parse: parseCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const [isDraftActive, setIsDraftActive] = useState(false);

   const handleSearch = useCallback(
      (value: string) => {
         navigate({
            search: (prev) => ({ ...prev, search: value }),
            replace: true,
         });
      },
      [navigate],
   );

   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({
         input: typeFilter !== "all" ? { type: typeFilter } : {},
      }),
   );

   const filteredContacts = useMemo(() => {
      if (!search) return contacts;
      const lower = search.toLowerCase();
      return contacts.filter(
         (c) =>
            c.name.toLowerCase().includes(lower) ||
            c.email?.toLowerCase().includes(lower) ||
            c.phone?.toLowerCase().includes(lower),
      );
   }, [contacts, search]);

   const createMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         onSuccess: () => {
            toast.success("Contato criado com sucesso.");
            setIsDraftActive(false);
         },
         onError: (e) => toast.error(e.message || "Erro ao criar contato."),
      }),
   );

   const importMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         meta: { skipGlobalInvalidation: true },
      }),
   );

   const deleteMutation = useMutation(
      orpc.contacts.remove.mutationOptions({
         onSuccess: () => toast.success("Contato excluído."),
         onError: (e) => toast.error(e.message || "Erro ao excluir contato."),
      }),
   );

   const bulkDeleteMutation = useMutation(
      orpc.contacts.bulkRemove.mutationOptions({
         onError: () => toast.error("Erro ao excluir contatos."),
      }),
   );

   const handleCreate = useCallback(() => setIsDraftActive(true), []);
   const handleDiscardDraft = useCallback(() => setIsDraftActive(false), []);

   const handleAddContact = useCallback(
      async (data: Record<string, string | string[]>) => {
         const name = String(data.name ?? "").trim();
         if (!name) return;
         const rawType = String(data.type ?? "ambos").toLowerCase();
         const type = (
            ["cliente", "fornecedor", "ambos"].includes(rawType)
               ? rawType
               : "ambos"
         ) as "cliente" | "fornecedor" | "ambos";
         await createMutation.mutateAsync({
            name,
            type,
            email: String(data.email ?? "").trim() || null,
            phone: String(data.phone ?? "").trim() || null,
         });
      },
      [createMutation],
   );

   const handleDelete = useCallback(
      (contact: ContactRow) => {
         openAlertDialog({
            title: "Excluir contato",
            description: `Excluir "${contact.name}"? Esta ação não pode ser desfeita.`,
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               await deleteMutation.mutateAsync({ id: contact.id });
            },
         });
      },
      [openAlertDialog, deleteMutation],
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
         mapRow: (row, i) => ({
            id: `__import_${i}`,
            name: String(row.name ?? "").trim(),
            type: (["cliente", "fornecedor", "ambos"].includes(
               String(row.type ?? "").toLowerCase(),
            )
               ? String(row.type).toLowerCase()
               : "ambos") as "cliente" | "fornecedor" | "ambos",
            email: String(row.email ?? "").trim() || null,
            phone: String(row.phone ?? "").trim() || null,
            document: String(row.document ?? "").trim() || null,
         }),
         onImport: async (rows) => {
            const results = await Promise.allSettled(
               rows.map((r) => {
                  const name = String(r.name ?? "").trim();
                  if (!name) return Promise.reject(new Error("skip"));
                  const rawType = String(r.type ?? "ambos").toLowerCase();
                  const type = (
                     ["cliente", "fornecedor", "ambos"].includes(rawType)
                        ? rawType
                        : "ambos"
                  ) as "cliente" | "fornecedor" | "ambos";
                  return importMutation.mutateAsync({
                     name,
                     type,
                     email: r.email ? String(r.email) : null,
                     phone: r.phone ? String(r.phone) : null,
                     document: r.document ? String(r.document) : null,
                  });
               }),
            );
            const ok = results.filter((r) => r.status === "fulfilled").length;
            const failed = results.filter(
               (r) =>
                  r.status === "rejected" &&
                  (r.reason as Error)?.message !== "skip",
            ).length;
            if (ok > 0) toast.success(`${ok} contato(s) importado(s).`);
            if (failed > 0) toast.error(`${failed} contato(s) com erro.`);
            await queryClient.invalidateQueries({
               queryKey: orpc.contacts.getAll.queryKey(),
            });
         },
      }),
      [parseCsv, parseXlsx, importMutation, queryClient],
   );

   const columns = useMemo(
      () => buildContactColumns({ slug, teamSlug }),
      [slug, teamSlug],
   );

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <DataTableRoot
            columns={columns}
            data={filteredContacts}
            getRowId={(row) => row.id}
            isDraftRowActive={isDraftActive}
            onAddRow={handleAddContact}
            onDiscardAddRow={handleDiscardDraft}
            renderActions={({ row }) => (
               <>
                  <Button
                     size="icon"
                     tooltip="Ver detalhes"
                     variant="ghost"
                     onClick={() =>
                        navigate({
                           to: "/$slug/$teamSlug/contacts/$contactId",
                           params: {
                              slug,
                              teamSlug,
                              contactId: row.original.id,
                           },
                        })
                     }
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
            storageKey="montte:datatable:contacts"
         >
            <DataTableToolbar
               searchPlaceholder="Buscar por nome, email ou telefone..."
               searchDefaultValue={search}
               onSearch={handleSearch}
            >
               <DataTableImportButton importConfig={importConfig} />
               <Button
                  onClick={handleCreate}
                  size="icon-sm"
                  tooltip="Novo Contato"
                  variant="outline"
               >
                  <Plus />
                  <span className="sr-only">Novo Contato</span>
               </Button>
            </DataTableToolbar>
            <DataTableEmptyState>
               <Empty>
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Users className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhum contato</EmptyTitle>
                     <EmptyDescription>
                        {search
                           ? "Nenhum contato encontrado para a busca."
                           : "Cadastre clientes e fornecedores para organizar suas transações."}
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </DataTableEmptyState>
            <DataTableContent className="flex-1 overflow-auto min-h-0" />
            <DataTableBulkActions<ContactRow>>
               {({ selectedRows, clearSelection }) => {
                  const ids = selectedRows.map((r) => r.id);
                  return (
                     <SelectionActionButton
                        icon={<Trash2 />}
                        variant="destructive"
                        onClick={() =>
                           openAlertDialog({
                              title: `Excluir ${ids.length} ${ids.length === 1 ? "contato" : "contatos"}`,
                              description:
                                 "Tem certeza que deseja excluir os contatos selecionados? Esta ação não pode ser desfeita.",
                              actionLabel: "Excluir",
                              cancelLabel: "Cancelar",
                              variant: "destructive",
                              onAction: async () => {
                                 await bulkDeleteMutation.mutateAsync({ ids });
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
         </DataTableRoot>
      </div>
   );
}
