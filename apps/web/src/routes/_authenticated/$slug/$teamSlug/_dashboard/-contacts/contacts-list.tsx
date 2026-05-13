import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import {
   getCoreRowModel,
   getSortedRowModel,
   useReactTable,
   type ColumnDef,
   type RowSelectionState,
   type SortingState,
} from "@tanstack/react-table";
import { ExternalLink, Plus, Trash2, Users } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { DataImportButton } from "@/blocks/data-table/data-import/data-import-button";
import { DataImportSection } from "@/blocks/data-table/data-import/data-import-section";
import { ExportButton } from "@/components/export-button/export-button";
import { useDataImport } from "@/blocks/data-table/data-import/use-data-import";
import type { DataImportConfig } from "@/blocks/data-table/data-import/use-data-import";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useOrgSlug, useTeamSlug } from "@/hooks/use-dashboard-slugs";
import { useCsvFile } from "@/hooks/use-csv-file";
import { useSheet } from "@/hooks/use-sheet";
import { useXlsxFile } from "@/hooks/use-xlsx-file";
import { orpc } from "@/integrations/orpc/client";
import { ContactFormSheet } from "./contact-form-sheet";
import { buildContactColumns, type ContactRow } from "./contacts-columns";

const routeApi = getRouteApi(
   "/_authenticated/$slug/$teamSlug/_dashboard/contacts/",
);

export function ContactsList() {
   const routeNavigate = routeApi.useNavigate();
   const navigate = useNavigate();
   const { typeFilter, search } = routeApi.useSearch();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const queryClient = useQueryClient();
   const slug = useOrgSlug();
   const teamSlug = useTeamSlug();
   const { parse: parseCsv, generate: generateCsv } = useCsvFile();
   const { parse: parseXlsx } = useXlsxFile();
   const layout = useDataTableLayout("contacts");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         routeNavigate({
            search: (prev) => ({ ...prev, search: value }),
            replace: true,
         }),
   });

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

   const importMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         meta: { skipGlobalInvalidation: true },
      }),
   );

   const updateMutation = useMutation(
      orpc.contacts.update.mutationOptions({
         onError: (e) => toast.error(e.message || "Erro ao atualizar contato."),
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

   const handleOpenCreate = useCallback(() => {
      openSheet({ renderChildren: () => <ContactFormSheet /> });
   }, [openSheet]);

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

   const importConfig: DataImportConfig = useMemo(
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
         template: {
            filename: "modelo-contatos.csv",
            label: "Baixar modelo CSV",
            description:
               "Inclui Nome, Tipo, Documento, Email e Telefone com exemplos de preenchimento.",
            createBlob: () =>
               generateCsv(
                  [
                     {
                        name: "Maria Oliveira",
                        type: "cliente",
                        document: "12345678901",
                        email: "maria@exemplo.com",
                        phone: "(11) 99999-0000",
                     },
                     {
                        name: "Fornecedor Alfa Ltda",
                        type: "fornecedor",
                        document: "12345678000190",
                        email: "financeiro@fornecedoralfa.com.br",
                        phone: "(11) 3333-4444",
                     },
                     {
                        name: "João Souza",
                        type: "ambos",
                        document: "98765432100",
                        email: "joao@exemplo.com",
                        phone: "(21) 98888-1111",
                     },
                  ],
                  ["name", "type", "document", "email", "phone"],
               ),
         },
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
      [parseCsv, parseXlsx, generateCsv, importMutation, queryClient],
   );

   const handleUpdate = useCallback(
      async (id: string, patch: Record<string, unknown>) => {
         await updateMutation.mutateAsync({ id, ...patch });
      },
      [updateMutation],
   );

   const columns = useMemo<ColumnDef<ContactRow>[]>(() => {
      const base = buildContactColumns({ slug, teamSlug }, handleUpdate);
      const selectColumn: ColumnDef<ContactRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         header: ({ table }) => (
            <Checkbox
               aria-label="Selecionar todos"
               checked={
                  table.getIsAllPageRowsSelected()
                     ? true
                     : table.getIsSomePageRowsSelected()
                       ? "indeterminate"
                       : false
               }
               onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onCheckedChange={(v) => row.toggleSelected(!!v)}
            />
         ),
      };
      const actionsColumn: ColumnDef<ContactRow> = {
         id: "__actions",
         size: 100,
         enableSorting: false,
         enableHiding: false,
         meta: { align: "right" },
         cell: ({ row }) => (
            <div className="flex justify-end gap-2">
               <Button
                  size="icon-sm"
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
                  <ExternalLink />
                  <span className="sr-only">Ver detalhes</span>
               </Button>
               <Button
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(row.original)}
                  size="icon-sm"
                  tooltip="Excluir"
                  variant="ghost"
               >
                  <Trash2 />
                  <span className="sr-only">Excluir</span>
               </Button>
            </div>
         ),
      };
      return [selectColumn, ...base, actionsColumn];
   }, [slug, teamSlug, handleUpdate, navigate, handleDelete]);

   const [sorting, setSorting] = useState<SortingState>([]);
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const table = useReactTable({
      data: filteredContacts,
      columns,
      getRowId: (row) => row.id,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: { sorting, rowSelection, ...layout.state },
      onSortingChange: setSorting,
      onRowSelectionChange: setRowSelection,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
   });

   const importApi = useDataImport({ table, config: importConfig });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((r) => r.original.id);

   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <SelectionActionButton
            icon={<Trash2 />}
            variant="destructive"
            onClick={() =>
               openAlertDialog({
                  title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "contato" : "contatos"}`,
                  description:
                     "Tem certeza que deseja excluir os contatos selecionados? Esta ação não pode ser desfeita.",
                  actionLabel: "Excluir",
                  cancelLabel: "Cancelar",
                  variant: "destructive",
                  onAction: async () => {
                     await bulkDeleteMutation.mutateAsync({ ids: selectedIds });
                     table.resetRowSelection();
                  },
               })
            }
         >
            Excluir
         </SelectionActionButton>
      ),
   });

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex flex-wrap items-center gap-2 justify-between">
               <SearchInput
                  className="max-w-sm"
                  aria-label="Buscar contatos"
                  onChange={(e) => searchInput.onChange(e.target.value)}
                  placeholder="Buscar por nome, email ou telefone..."
                  value={searchInput.value}
               />
               <div className="flex flex-wrap items-center gap-2">
                  <DataTableColumnVisibility table={table} />
                  <ExportButton table={table} fileBase="contatos" />
                  <DataImportButton api={importApi} config={importConfig} />
                  <Button
                     onClick={handleOpenCreate}
                     size="icon-sm"
                     tooltip="Novo Contato"
                     variant="outline"
                  >
                     <Plus />
                     <span className="sr-only">Novo Contato</span>
                  </Button>
               </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<ContactRow> table={table} />
                  <DataImportSection
                     api={importApi}
                     config={importConfig}
                     table={table}
                  />
               </Table>
               {table.getRowCount() === 0 && (
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
               )}
            </ScrollArea>
         </div>
      </div>
   );
}
