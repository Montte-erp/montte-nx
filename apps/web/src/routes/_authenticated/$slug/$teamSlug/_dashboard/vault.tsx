import { useForm } from "@tanstack/react-form";
import { createCollection, eq, ilike, useLiveQuery } from "@tanstack/react-db";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type SortingState,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { useUploadFiles } from "@better-upload/client";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import { Combobox } from "@packages/ui/components/combobox";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import {
   ContextPanel,
   ContextPanelContent,
   ContextPanelHeader,
   ContextPanelTitle,
} from "@packages/ui/components/context-panel";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { SearchInput } from "@packages/ui/components/search-input";
import { Table } from "@packages/ui/components/table";
import { UploadDropzone } from "@packages/ui/components/upload-dropzone";
import { UploadProgress } from "@packages/ui/components/upload-progress";
import { Archive, ExternalLink, Plus } from "lucide-react";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { DataTableFilterChips } from "@/blocks/data-table/data-table-filter-chips";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import {
   bulkArchiveVaultDocumentsAction,
   createVaultDocumentAction,
   createVaultFolderAction,
   vaultDocumentsCollectionOptions,
   vaultFoldersCollectionOptions,
   type VaultDocumentRow,
} from "@/integrations/tanstack-db/vault";
import { useSheet } from "@/hooks/use-sheet";
import { useContextPanelInfo } from "../-context-panel/use-context-panel";
import { DefaultHeader } from "../-layout/default-header";
import { useMemo } from "react";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/vault",
)({
   validateSearch: z.object({
      sorting: z
         .array(z.object({ id: z.string(), desc: z.boolean() }))
         .catch([])
         .default([]),
      columnFilters: z
         .array(z.object({ id: z.string(), value: z.unknown() }))
         .catch([])
         .default([]),
      page: z.number().int().min(1).catch(1).default(1),
      pageSize: z.number().int().min(1).max(100).catch(20).default(20),
      search: z.string().catch("").default(""),
      folderId: z.string().catch("all").default("all"),
   }),
   pendingMs: 300,
   pendingComponent: VaultSkeleton,
   head: () => ({
      meta: [{ title: "Vault — Montte" }],
   }),
   component: VaultPage,
});

type UploadedVaultFile = {
   fileKey: string;
   name: string;
   type: string;
   size: number;
};

const createDocumentSchema = z.object({
   title: z.string().trim().min(1, "Nome obrigatório"),
   description: z.string().trim().max(500),
   folderId: z.string(),
   fileKey: z.string().trim(),
   originalFileName: z.string().trim(),
   mimeType: z.string().trim(),
   fileSize: z.number().int().nonnegative(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === "object" && value !== null;
}

function getMetadataString(metadata: unknown, key: string) {
   if (!isRecord(metadata)) return undefined;
   const value = metadata[key];
   return typeof value === "string" ? value : undefined;
}

const vaultSortIdSchema = z.enum([
   "description",
   "title",
   "status",
   "source",
   "updatedAt",
]);

function normalizeVaultSorting(sorting: SortingState) {
   const normalized: Array<{
      id: z.infer<typeof vaultSortIdSchema>;
      desc: boolean;
   }> = [];
   for (const rule of sorting) {
      const result = vaultSortIdSchema.safeParse(rule.id);
      if (!result.success) continue;
      normalized.push({ id: result.data, desc: rule.desc });
   }
   return normalized;
}

const skeletonColumns = buildVaultColumns();

type LiveVaultDocumentRow = VaultDocumentRow & {
   $synced: boolean;
};

function vaultDocumentDedupeKey(document: VaultDocumentRow) {
   return `${document.teamId}:${document.fileKey ?? ""}:${document.title.trim().toLocaleLowerCase()}`;
}

function removeConfirmedOptimisticDuplicates(
   documents: LiveVaultDocumentRow[],
) {
   const syncedKeys = new Set<string>();
   for (const document of documents) {
      if (!document.$synced) continue;
      syncedKeys.add(vaultDocumentDedupeKey(document));
   }

   return documents.filter(
      (document) =>
         document.$synced || !syncedKeys.has(vaultDocumentDedupeKey(document)),
   );
}

function compareVaultDocumentValues(
   left: VaultDocumentRow,
   right: VaultDocumentRow,
   sortId: z.infer<typeof vaultSortIdSchema>,
) {
   switch (sortId) {
      case "description":
         return String(left.description ?? "").localeCompare(
            String(right.description ?? ""),
            "pt-BR",
         );
      case "source":
         return left.source.localeCompare(right.source, "pt-BR");
      case "status":
         return left.status.localeCompare(right.status, "pt-BR");
      case "title":
         return left.title.localeCompare(right.title, "pt-BR");
      case "updatedAt":
         return (
            new Date(left.updatedAt).getTime() -
            new Date(right.updatedAt).getTime()
         );
   }
}

function sortVaultDocuments(rows: VaultDocumentRow[], sorting: SortingState) {
   const normalized = normalizeVaultSorting(sorting);
   return [...rows].sort((left, right) => {
      if (normalized.length === 0) {
         return (
            new Date(right.updatedAt).getTime() -
            new Date(left.updatedAt).getTime()
         );
      }
      for (const rule of normalized) {
         const result = compareVaultDocumentValues(left, right, rule.id);
         if (result !== 0) return rule.desc ? -result : result;
      }
      return left.title.localeCompare(right.title, "pt-BR");
   });
}

function matchesVaultFilter(
   document: VaultDocumentRow,
   filter: ColumnFiltersState[number],
) {
   if (typeof filter.value !== "string") return true;
   const value = filter.value.trim().toLowerCase();
   if (!value) return true;
   if (filter.id === "title") {
      return document.title.toLowerCase().includes(value);
   }
   if (filter.id === "description") {
      return String(document.description ?? "")
         .toLowerCase()
         .includes(value);
   }
   if (filter.id === "folderName") {
      return document.folderName.toLowerCase().includes(value);
   }
   if (filter.id === "status") return document.status === value;
   if (filter.id === "source") return document.source === value;
   return true;
}

function filterVaultDocuments(
   rows: VaultDocumentRow[],
   filters: ColumnFiltersState,
) {
   if (filters.length === 0) return rows;
   return rows.filter((document) =>
      filters.every((filter) => matchesVaultFilter(document, filter)),
   );
}

function documentMatchesSearch(document: VaultDocumentRow, search: string) {
   const value = search.trim().toLowerCase();
   if (!value) return true;
   return (
      document.title.toLowerCase().includes(value) ||
      String(document.description ?? "")
         .toLowerCase()
         .includes(value) ||
      String(document.originalFileName ?? "")
         .toLowerCase()
         .includes(value)
   );
}

function buildVaultColumns(): ColumnDef<VaultDocumentRow>[] {
   return [
      {
         accessorKey: "title",
         header: "Nome",
         size: 260,
         meta: { label: "Nome", filterVariant: "text" },
         cell: ({ row }) => (
            <span className="truncate font-medium">{row.original.title}</span>
         ),
      },
      {
         accessorKey: "description",
         header: "Descrição",
         size: 320,
         meta: { label: "Descrição", filterVariant: "text" },
         cell: ({ row }) => (
            <span className="truncate text-muted-foreground">
               {row.original.description ||
                  row.original.originalFileName ||
                  "—"}
            </span>
         ),
      },
      {
         accessorKey: "folderName",
         header: "Pasta",
         enableSorting: false,
         size: 180,
         meta: { label: "Pasta", filterVariant: "text" },
         cell: ({ row }) => (
            <span className="text-muted-foreground">
               {row.original.folderName}
            </span>
         ),
      },
      {
         accessorKey: "status",
         header: "Status",
         size: 140,
         meta: { label: "Status", filterVariant: "select" },
         cell: ({ row }) => (
            <Badge variant="outline">{row.original.statusLabel}</Badge>
         ),
      },
      {
         accessorKey: "source",
         header: "Origem",
         size: 140,
         meta: { label: "Origem", filterVariant: "select" },
         cell: ({ row }) => (
            <span className="text-muted-foreground">
               {row.original.sourceLabel}
            </span>
         ),
      },
   ];
}

function UploadDocumentSheet() {
   const { queryClient } = Route.useRouteContext();
   const { closeTopSheet } = useSheet();
   const documentsCollection = useMemo(
      () => createCollection(vaultDocumentsCollectionOptions({ queryClient })),
      [queryClient],
   );
   const foldersCollection = useMemo(
      () => createCollection(vaultFoldersCollectionOptions({ queryClient })),
      [queryClient],
   );
   const { data: folders, isLoading: isLoadingFolders } = useLiveQuery(
      (q) =>
         q.from({ folder: foldersCollection }).select(({ folder }) => folder),
      [foldersCollection],
   );
   const documentAction = useMemo(
      () => createVaultDocumentAction(documentsCollection),
      [documentsCollection],
   );
   const folderAction = useMemo(
      () => createVaultFolderAction(foldersCollection),
      [foldersCollection],
   );

   const form = useForm({
      defaultValues: {
         title: "",
         description: "",
         folderId: "",
         fileKey: "",
         originalFileName: "",
         mimeType: "",
         fileSize: 0,
      },
      validators: { onSubmit: createDocumentSchema },
      onSubmit: ({ value }) => {
         const action = documentAction({
            input: {
               title: value.title,
               description: value.description || undefined,
               folderId: value.folderId || undefined,
               fileKey: value.fileKey || undefined,
               originalFileName: value.originalFileName || undefined,
               mimeType: value.mimeType || undefined,
               fileSize: value.fileSize || undefined,
               status: value.fileKey ? "stored" : "draft",
               source: "manual",
            },
         });
         action.isPersisted.promise
            .then(() => {
               toast.success("Documento salvo no Vault.");
               closeTopSheet();
            })
            .catch((error: unknown) =>
               toast.error(
                  error instanceof Error
                     ? error.message
                     : "Falha ao salvar documento no Vault.",
               ),
            );
      },
   });

   const upload = useUploadFiles({
      api: "/api/upload",
      route: "vaultDocument",
      onUploadComplete: ({ files, metadata }) => {
         const [file] = files;
         if (!file) return;
         const fileKey =
            getMetadataString(metadata, "fileKey") ?? file.objectInfo.key;
         const uploaded: UploadedVaultFile = {
            fileKey,
            name: file.name,
            type: file.type,
            size: file.size,
         };
         form.setFieldValue("fileKey", uploaded.fileKey);
         form.setFieldValue("originalFileName", uploaded.name);
         form.setFieldValue("mimeType", uploaded.type);
         form.setFieldValue("fileSize", uploaded.size);
         if (!form.getFieldValue("title")) {
            form.setFieldValue("title", uploaded.name.replace(/\.[^.]+$/, ""));
         }
         toast.success("Arquivo enviado para o bucket.");
      },
      onUploadFail: ({ failedFiles }) => {
         for (const file of failedFiles)
            toast.error(`${file.name}: falha no upload.`);
      },
      onError: (error) => toast.error(error.message),
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo documento</SheetTitle>
            <SheetDescription>
               Envie o arquivo para o bucket e salve os metadados no GED do
               Montte.
            </SheetDescription>
         </SheetHeader>
         <div className="min-h-0 flex-1 overflow-auto px-4">
            <form
               className="flex flex-col gap-4"
               id="create-vault-document-form"
               onSubmit={(event) => {
                  event.preventDefault();
                  form.handleSubmit();
               }}
            >
               <form.Field
                  name="title"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name} required>
                              Nome do documento
                           </FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onInput={(event) =>
                                 field.handleChange(event.currentTarget.value)
                              }
                              placeholder="Ex.: Contrato de prestação de serviços"
                              value={field.state.value}
                           />
                           {isInvalid ? (
                              <FieldError>
                                 {String(field.state.meta.errors[0])}
                              </FieldError>
                           ) : null}
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="description"
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                        <Input
                           id={field.name}
                           name={field.name}
                           onBlur={field.handleBlur}
                           onInput={(event) =>
                              field.handleChange(event.currentTarget.value)
                           }
                           placeholder="Ex.: Documento assinado pelo fornecedor"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               />
               <form.Field
                  name="folderId"
                  children={(field) => {
                     const options = folders
                        .filter((folder) => folder.id !== "all")
                        .map((folder) => ({
                           value: folder.id,
                           label: folder.name,
                        }));

                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Pasta</FieldLabel>
                           <Combobox
                              className="w-full"
                              createLabel="Criar pasta"
                              disabled={isLoadingFolders}
                              emptyMessage="Nenhuma pasta encontrada."
                              id={field.name}
                              onBlur={field.handleBlur}
                              onCreate={(name) => {
                                 const action = folderAction({
                                    input: { name },
                                 });
                                 action.isPersisted.promise
                                    .then((folder) => {
                                       form.setFieldValue(
                                          "folderId",
                                          folder.id,
                                       );
                                       toast.success("Pasta criada no Vault.");
                                    })
                                    .catch((error: unknown) =>
                                       toast.error(
                                          error instanceof Error
                                             ? error.message
                                             : "Falha ao criar pasta no Vault.",
                                       ),
                                    );
                              }}
                              onValueChange={field.handleChange}
                              options={options}
                              placeholder="Selecionar pasta"
                              searchPlaceholder="Buscar ou criar pasta..."
                              value={field.state.value}
                           />
                           <p className="text-sm text-muted-foreground">
                              Busque uma pasta existente ou digite um nome para
                              criar uma nova.
                           </p>
                        </Field>
                     );
                  }}
               />
               <Field>
                  <FieldLabel>Arquivo</FieldLabel>
                  <UploadDropzone
                     accept="image/*,application/pdf,text/xml,application/xml,application/json,text/plain,.doc,.docx"
                     control={upload.control}
                     description={{
                        maxFiles: 1,
                        maxFileSize: "25MB",
                        fileTypes: "PDF, XML, imagem ou documento",
                     }}
                  />
                  <UploadProgress control={upload.control} />
                  <form.Subscribe
                     selector={(state) => state.values.originalFileName}
                  >
                     {(fileName) =>
                        fileName ? (
                           <p className="text-sm text-muted-foreground">
                              Arquivo enviado: {fileName}
                           </p>
                        ) : null
                     }
                  </form.Subscribe>
               </Field>
            </form>
         </div>
         <SheetFooter>
            <form.Subscribe
               selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={
                        !canSubmit || isSubmitting || upload.control.isPending
                     }
                     form="create-vault-document-form"
                     type="submit"
                  >
                     Salvar documento
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}

function VaultInfoContent() {
   return (
      <ContextPanel className="h-auto shrink-0">
         <ContextPanelHeader>
            <ContextPanelTitle>Sobre o Vault</ContextPanelTitle>
         </ContextPanelHeader>
         <ContextPanelContent className="flex-none gap-4">
            <p className="px-2 text-sm text-muted-foreground">
               O Vault é o GED do Montte. Use para centralizar documentos
               fiscais, contratos, documentos da empresa e anexos gerados por
               outros módulos.
            </p>
            <div className="grid gap-2 px-2 text-sm">
               <div>
                  <div className="font-medium">Pasta Anexos</div>
                  <p className="text-muted-foreground">
                     Pasta padrão criada automaticamente. Anexos de lançamentos
                     financeiros entram aqui.
                  </p>
               </div>
               <div>
                  <div className="font-medium">Documentos</div>
                  <p className="text-muted-foreground">
                     Arquivos são enviados para o bucket e registrados no Vault
                     com pasta, origem e status.
                  </p>
               </div>
            </div>
         </ContextPanelContent>
      </ContextPanel>
   );
}

function VaultToolbar({
   searchInput,
   table,
}: {
   searchInput: ReturnType<typeof useDebouncedSearch>;
   table: ReturnType<typeof useReactTable<VaultDocumentRow>>;
}) {
   const { openSheet } = useSheet();

   return (
      <div className="flex flex-wrap items-center justify-between gap-2">
         <SearchInput
            aria-label="Buscar documentos"
            className="max-w-sm"
            onChange={(event) => searchInput.onChange(event.target.value)}
            placeholder="Buscar documentos..."
            value={searchInput.value}
         />
         <div className="flex flex-wrap items-center gap-2">
            <DataTableColumnVisibility table={table} />
            <Button
               onClick={() =>
                  openSheet({
                     className: "sm:max-w-lg",
                     renderChildren: () => <UploadDocumentSheet />,
                  })
               }
               size="icon-sm"
               tooltip="Novo documento"
               type="button"
               variant="outline"
            >
               <Plus />
               <span className="sr-only">Novo documento</span>
            </Button>
         </div>
      </div>
   );
}

function VaultSkeleton() {
   return <DataTableSkeleton columns={skeletonColumns} />;
}

function VaultContent() {
   const navigate = Route.useNavigate();
   const { queryClient } = Route.useRouteContext();
   const { sorting, columnFilters, folderId, search, page, pageSize } =
      Route.useSearch();
   const layout = useDataTableLayout("vault-documents");

   const searchInput = useDebouncedSearch({
      value: search,
      onCommit: (value) =>
         navigate({
            search: (prev) => ({ ...prev, search: value, page: 1 }),
            replace: true,
         }),
   });

   const documentsCollection = useMemo(
      () => createCollection(vaultDocumentsCollectionOptions({ queryClient })),
      [queryClient],
   );

   useContextPanelInfo(() => <VaultInfoContent />);

   const { data: liveDocuments, isLoading } = useLiveQuery(
      (q) => {
         let query = q.from({ document: documentsCollection });
         if (folderId !== "all") {
            query = query.where(({ document }) =>
               eq(document.folderId, folderId),
            );
         }
         if (search.trim()) {
            query = query.where(({ document }) =>
               ilike(document.title, `%${search.trim()}%`),
            );
         }
         return query.select(({ document }) => document);
      },
      [documentsCollection, folderId, search],
   );

   const documents = useMemo(() => {
      const normalized = removeConfirmedOptimisticDuplicates(
         liveDocuments as LiveVaultDocumentRow[],
      );
      const searched = normalized.filter((document) =>
         documentMatchesSearch(document, search),
      );
      const filtered = filterVaultDocuments(searched, columnFilters);
      const sorted = sortVaultDocuments(filtered, sorting);
      const start = (page - 1) * pageSize;
      return {
         all: sorted,
         rows: sorted.slice(start, start + pageSize),
      };
   }, [columnFilters, liveDocuments, page, pageSize, search, sorting]);

   const columns = useMemo<ColumnDef<VaultDocumentRow>[]>(() => {
      const base = buildVaultColumns();
      const selectColumn: ColumnDef<VaultDocumentRow> = {
         id: "__select",
         size: 40,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true },
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
               onCheckedChange={(value) =>
                  table.toggleAllPageRowsSelected(Boolean(value))
               }
            />
         ),
         cell: ({ row }) => (
            <Checkbox
               aria-label="Selecionar linha"
               checked={row.getIsSelected()}
               disabled={!row.getCanSelect()}
               onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            />
         ),
      };
      const actionsColumn: ColumnDef<VaultDocumentRow> = {
         id: "__actions",
         size: 48,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true, align: "right" },
         cell: ({ row }) => {
            const href = row.original.fileKey
               ? `/api/files/${row.original.fileKey}`
               : undefined;
            return (
               <div className="flex justify-end">
                  <Button
                     asChild={Boolean(href)}
                     disabled={!href}
                     size="icon-sm"
                     tooltip="Abrir documento"
                     type="button"
                     variant="ghost"
                  >
                     {href ? (
                        <a href={href} rel="noreferrer" target="_blank">
                           <ExternalLink className="size-4" />
                           <span className="sr-only">Abrir documento</span>
                        </a>
                     ) : (
                        <span>
                           <ExternalLink className="size-4" />
                           <span className="sr-only">Abrir documento</span>
                        </span>
                     )}
                  </Button>
               </div>
            );
         },
      };
      return [selectColumn, ...base, actionsColumn];
   }, []);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize },
      totalRows: documents.all.length,
      onUpdate: (next) =>
         navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
   });

   const table = useReactTable({
      data: documents.rows,
      columns,
      getRowId: (row) => row.id,
      rowCount: documents.all.length,
      pageCount: urlState.pageCount,
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      columnResizeMode: "onChange",
      defaultColumn: { minSize: 80, size: 160, maxSize: 600 },
      state: { ...urlState.state, ...layout.state },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
   });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedIds = selectedRows.map((row) => row.original.id);
   useTableBulkActions({
      selectedCount: selectedRows.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <SelectionActionButton
            icon={<Archive className="size-4" />}
            onClick={() => {
               const bulkArchive =
                  bulkArchiveVaultDocumentsAction(documentsCollection);
               const action = bulkArchive({ ids: selectedIds });
               action.isPersisted.promise
                  .then(() => {
                     toast.success(
                        `${selectedIds.length} ${selectedIds.length === 1 ? "documento arquivado" : "documentos arquivados"}.`,
                     );
                     table.resetRowSelection();
                  })
                  .catch((error: unknown) =>
                     toast.error(
                        error instanceof Error
                           ? error.message
                           : "Erro ao arquivar documentos.",
                     ),
                  );
            }}
         >
            Arquivar
         </SelectionActionButton>
      ),
   });

   if (isLoading) return <VaultSkeleton />;

   return (
      <div className="flex flex-1 flex-col gap-4 min-h-0">
         <div className="flex flex-1 flex-col gap-4 min-h-0">
            <VaultToolbar searchInput={searchInput} table={table} />
            <DataTableFilterChips table={table} />
            <ScrollArea className="flex-1 min-h-0 rounded-md border bg-card">
               <Table>
                  <DataTableHeader table={table} />
                  <DataTableBody<VaultDocumentRow> table={table} />
               </Table>
               {table.getRowCount() === 0 ? (
                  <Empty>
                     <EmptyHeader>
                        <EmptyMedia variant="icon">
                           <Archive className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhum documento encontrado</EmptyTitle>
                        <EmptyDescription>
                           Envie um arquivo ou ajuste a busca para ver
                           documentos do Vault.
                        </EmptyDescription>
                     </EmptyHeader>
                  </Empty>
               ) : null}
            </ScrollArea>
            {documents.all.length > 0 ? (
               <DataTablePagination table={table} />
            ) : null}
         </div>
      </div>
   );
}

function VaultPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="Organize documentos fiscais, contratos e anexos do espaço."
            title="Vault"
         />
         <VaultContent />
      </main>
   );
}
