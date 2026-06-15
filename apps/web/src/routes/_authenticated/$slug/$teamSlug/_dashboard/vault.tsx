import { useForm } from "@tanstack/react-form";
import { createCollection, ilike, or, useLiveQuery } from "@tanstack/react-db";
import {
   getCoreRowModel,
   getExpandedRowModel,
   getGroupedRowModel,
   useReactTable,
   type ColumnDef,
   type ColumnFiltersState,
   type SortingState,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { useUploadFiles } from "@better-upload/client";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import {
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
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
import { Archive, Download, Eye, Link, Plus, Trash2 } from "lucide-react";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableSkeleton } from "@/blocks/data-table/data-table-skeleton";
import { DataTableFilterChips } from "@/blocks/data-table/data-table-filter-chips";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { InlineEditSelect } from "@/blocks/data-table/inline-edit/inline-edit-select";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";
import { useDataTableLayout } from "@/blocks/data-table/use-data-table-layout";
import { useDebouncedSearch } from "@/blocks/data-table/use-debounced-search";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import {
   SelectionActionButton,
   useTableBulkActions,
} from "@/hooks/use-selection-toolbar";
import {
   bulkArchiveVaultDocumentsAction,
   bulkDeleteVaultDocumentsAction,
   createVaultDocumentAction,
   createVaultDocumentShareLink,
   createVaultFolderAction,
   vaultDocumentsCollectionOptions,
   updateVaultDocumentAction,
   vaultFoldersCollectionOptions,
   type VaultDocumentRow,
   type VaultFolderRow,
} from "@/integrations/tanstack-db/vault";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useSheet } from "@/hooks/use-sheet";
import { useContextPanelInfo } from "../-context-panel/use-context-panel";
import { DefaultHeader } from "../-layout/default-header";
import { useCallback, useMemo } from "react";

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
      grouping: z
         .array(z.string())
         .catch(["folderName"])
         .default(["folderName"]),
      search: z.string().catch("").default(""),
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
   "folderName",
   "title",
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
      case "folderName":
         return left.folderName.localeCompare(right.folderName, "pt-BR");
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

function buildVaultColumns(options?: {
   folders?: VaultFolderRow[];
   onUpdate?: (
      id: string,
      patch: {
         title?: string;
         description?: string | null;
         folderId?: string | null;
      },
   ) => Promise<void>;
}): ColumnDef<VaultDocumentRow>[] {
   const folders = options?.folders ?? [];
   const folderOptions = folders
      .filter((folder) => folder.id !== "all")
      .map((folder) => ({ value: folder.id, label: folder.name }));
   const onUpdate = options?.onUpdate;
   return [
      {
         accessorKey: "folderName",
         header: "Pasta",
         size: 180,
         meta: {
            label: "Pasta",
            filterVariant: "text",
            formatGroupLabel: (value) => String(value || "Sem pasta"),
            isEditable: true,
            editMode: "inline",
         },
         cell: ({ row }) =>
            onUpdate ? (
               <InlineEditSelect
                  ariaLabel="Pasta"
                  onSave={async (value) =>
                     onUpdate(row.original.id, { folderId: String(value) })
                  }
                  options={folderOptions}
                  placeholder="Sem pasta"
                  value={row.original.folderId ?? ""}
               />
            ) : (
               <span className="text-muted-foreground">
                  {row.original.folderName}
               </span>
            ),
      },
      {
         accessorKey: "title",
         header: "Nome",
         size: 260,
         meta: {
            label: "Nome",
            filterVariant: "text",
            isEditable: true,
            editMode: "inline",
         },
         cell: ({ row }) =>
            onUpdate ? (
               <InlineEditText
                  ariaLabel="Nome"
                  onSave={async (value) =>
                     onUpdate(row.original.id, { title: value.trim() })
                  }
                  placeholder="Nome do documento"
                  value={row.original.title}
               />
            ) : (
               <span className="truncate font-medium">
                  {row.original.title}
               </span>
            ),
      },
      {
         accessorKey: "description",
         header: "Descrição",
         size: 320,
         meta: {
            label: "Descrição",
            filterVariant: "text",
            isEditable: true,
            editMode: "inline",
         },
         cell: ({ row }) =>
            onUpdate ? (
               <InlineEditText
                  ariaLabel="Descrição"
                  onSave={async (value) =>
                     onUpdate(row.original.id, {
                        description: value.trim() ? value.trim() : null,
                     })
                  }
                  placeholder="—"
                  value={row.original.description ?? ""}
               />
            ) : (
               <span className="truncate text-muted-foreground">
                  {row.original.description ||
                     row.original.originalFileName ||
                     "—"}
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

function VaultDocumentViewer({ document }: { document: VaultDocumentRow }) {
   const href = document.fileKey ? `/api/files/${document.fileKey}` : undefined;
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{document.title}</CredenzaTitle>
            <CredenzaDescription>
               {document.description ||
                  document.originalFileName ||
                  "Documento do Vault"}
            </CredenzaDescription>
         </CredenzaHeader>
         <div className="min-h-[70vh] overflow-hidden rounded-md border bg-muted/20">
            {href ? (
               <iframe
                  className="h-[70vh] w-full"
                  src={href}
                  title={document.title}
               />
            ) : (
               <div className="flex h-[70vh] items-center justify-center text-sm text-muted-foreground">
                  Este documento ainda não tem arquivo.
               </div>
            )}
         </div>
         <CredenzaFooter>
            <Button asChild disabled={!href} type="button" variant="outline">
               <a download href={href ?? "#"}>
                  <Download />
                  Baixar
               </a>
            </Button>
         </CredenzaFooter>
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
                     com nome, descrição e pasta.
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

function downloadVaultFiles(rows: VaultDocumentRow[]) {
   for (const row of rows) {
      if (!row.fileKey) continue;
      const anchor = document.createElement("a");
      anchor.href = `/api/files/${row.fileKey}`;
      anchor.download = row.originalFileName ?? row.title;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
   }
}

function VaultContent() {
   const navigate = Route.useNavigate();
   const { openAlertDialog } = useAlertDialog();
   const { openCredenza } = useCredenza();
   const { queryClient } = Route.useRouteContext();
   const { sorting, columnFilters, search, page, pageSize, grouping } =
      Route.useSearch();
   const layout = useDataTableLayout("vault-documents-v2");

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
   const foldersCollection = useMemo(
      () => createCollection(vaultFoldersCollectionOptions({ queryClient })),
      [queryClient],
   );

   useContextPanelInfo(() => <VaultInfoContent />);

   const { data: liveDocuments, isLoading } = useLiveQuery(
      (q) => {
         let query = q.from({ document: documentsCollection });
         if (search.trim()) {
            const pattern = `%${search.trim()}%`;
            query = query.where(({ document }) =>
               or(
                  ilike(document.title, pattern),
                  ilike(document.description, pattern),
                  ilike(document.originalFileName, pattern),
                  ilike(document.folderName, pattern),
               ),
            );
         }
         return query.select(({ document }) => document);
      },
      [documentsCollection, search],
   );
   const { data: folders } = useLiveQuery(
      (q) =>
         q.from({ folder: foldersCollection }).select(({ folder }) => folder),
      [foldersCollection],
   );

   const documents = useMemo(() => {
      const activeDocuments = liveDocuments.filter(
         (document) => document.status !== "archived",
      );
      const filtered = filterVaultDocuments(activeDocuments, columnFilters);
      const sorted = sortVaultDocuments(filtered, sorting);
      const start = (page - 1) * pageSize;
      return {
         all: sorted,
         rows: sorted.slice(start, start + pageSize),
      };
   }, [columnFilters, liveDocuments, page, pageSize, sorting]);

   const handleUpdateDocument = useCallback(
      async (
         id: string,
         patch: {
            title?: string;
            description?: string | null;
            folderId?: string | null;
         },
      ) => {
         const updateDocument = updateVaultDocumentAction(documentsCollection);
         const action = updateDocument({ id, patch });
         await action.isPersisted.promise;
      },
      [documentsCollection],
   );

   const handleArchiveDocuments = useCallback(
      (rows: VaultDocumentRow[]) => {
         const ids = rows.map((row) => row.id);
         const bulkArchive =
            bulkArchiveVaultDocumentsAction(documentsCollection);
         const action = bulkArchive({ ids });
         action.isPersisted.promise
            .then(() => {
               toast.success(
                  `${ids.length} ${ids.length === 1 ? "documento arquivado" : "documentos arquivados"}.`,
               );
            })
            .catch((error: unknown) =>
               toast.error(
                  error instanceof Error
                     ? error.message
                     : "Erro ao arquivar documentos.",
               ),
            );
      },
      [documentsCollection],
   );

   const handleCreateShareLink = useCallback(async (documentId: string) => {
      const { url, expiresIn } = await createVaultDocumentShareLink(documentId);
      await navigator.clipboard.writeText(url);
      const minutes = Math.round(expiresIn / 60);
      toast.success(
         `Link público copiado. Ele expira em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
      );
   }, []);

   const handleDeleteDocuments = useCallback(
      (rows: VaultDocumentRow[]) => {
         const ids = rows.map((row) => row.id);
         openAlertDialog({
            title: `Excluir ${ids.length} ${ids.length === 1 ? "documento" : "documentos"}`,
            description:
               "Tem certeza que deseja excluir os documentos selecionados? Esta ação não pode ser desfeita.",
            actionLabel: "Excluir",
            cancelLabel: "Cancelar",
            variant: "destructive",
            onAction: async () => {
               const bulkDelete =
                  bulkDeleteVaultDocumentsAction(documentsCollection);
               const action = bulkDelete({ ids });
               await action.isPersisted.promise;
               toast.success(
                  `${ids.length} ${ids.length === 1 ? "documento excluído" : "documentos excluídos"}.`,
               );
            },
         });
      },
      [documentsCollection, openAlertDialog],
   );

   const columns = useMemo<ColumnDef<VaultDocumentRow>[]>(() => {
      const base = buildVaultColumns({
         folders,
         onUpdate: handleUpdateDocument,
      });
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
         size: 176,
         enableSorting: false,
         enableHiding: false,
         meta: { importIgnore: true, align: "right" },
         cell: ({ row }) => {
            const href = row.original.fileKey
               ? `/api/files/${row.original.fileKey}`
               : undefined;
            return (
               <div className="flex justify-end gap-2">
                  <Button
                     disabled={!href}
                     onClick={() =>
                        openCredenza({
                           className: "sm:max-w-5xl",
                           renderChildren: () => (
                              <VaultDocumentViewer document={row.original} />
                           ),
                        })
                     }
                     size="icon-sm"
                     tooltip="Visualizar"
                     type="button"
                     variant="ghost"
                  >
                     <Eye />
                     <span className="sr-only">Visualizar</span>
                  </Button>
                  <Button
                     asChild={Boolean(href)}
                     disabled={!href}
                     size="icon-sm"
                     tooltip="Baixar"
                     type="button"
                     variant="ghost"
                  >
                     {href ? (
                        <a download href={href}>
                           <Download className="size-4" />
                           <span className="sr-only">Baixar</span>
                        </a>
                     ) : (
                        <span>
                           <Download className="size-4" />
                           <span className="sr-only">Baixar</span>
                        </span>
                     )}
                  </Button>
                  <Button
                     disabled={!href}
                     onClick={() =>
                        handleCreateShareLink(row.original.id).catch(
                           (error: unknown) =>
                              toast.error(
                                 error instanceof Error
                                    ? error.message
                                    : "Erro ao gerar link de compartilhamento.",
                              ),
                        )
                     }
                     size="icon-sm"
                     tooltip="Compartilhar"
                     type="button"
                     variant="ghost"
                  >
                     <Link />
                     <span className="sr-only">Compartilhar</span>
                  </Button>
                  <Button
                     onClick={() => handleArchiveDocuments([row.original])}
                     size="icon-sm"
                     tooltip="Arquivar"
                     type="button"
                     variant="ghost"
                  >
                     <Archive />
                     <span className="sr-only">Arquivar</span>
                  </Button>
                  <Button
                     className="text-destructive hover:text-destructive"
                     onClick={() => handleDeleteDocuments([row.original])}
                     size="icon-sm"
                     tooltip="Excluir"
                     type="button"
                     variant="ghost"
                  >
                     <Trash2 />
                     <span className="sr-only">Excluir</span>
                  </Button>
               </div>
            );
         },
      };
      return [selectColumn, ...base, actionsColumn];
   }, [
      folders,
      handleArchiveDocuments,
      handleCreateShareLink,
      handleDeleteDocuments,
      handleUpdateDocument,
      openCredenza,
   ]);

   const urlState = useTableUrlState({
      search: { sorting, columnFilters, page, pageSize, grouping },
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
      groupedColumnMode: false,
      state: { ...urlState.state, ...layout.state, expanded: true },
      onSortingChange: urlState.onSortingChange,
      onColumnFiltersChange: urlState.onColumnFiltersChange,
      onPaginationChange: urlState.onPaginationChange,
      onRowSelectionChange: urlState.onRowSelectionChange,
      onGroupingChange: urlState.onGroupingChange,
      onColumnSizingChange: layout.onColumnSizingChange,
      onColumnOrderChange: layout.onColumnOrderChange,
      onColumnVisibilityChange: layout.onColumnVisibilityChange,
      onColumnPinningChange: layout.onColumnPinningChange,
      getCoreRowModel: getCoreRowModel(),
      getGroupedRowModel: getGroupedRowModel(),
      getExpandedRowModel: getExpandedRowModel(),
   });

   const selectedRows = table.getSelectedRowModel().rows;
   const selectedDocuments = selectedRows
      .filter((row) => !row.getIsGrouped())
      .map((row) => row.original);
   const downloadableDocuments = selectedDocuments.filter((row) => row.fileKey);
   useTableBulkActions({
      selectedCount: selectedDocuments.length,
      onClear: () => table.resetRowSelection(),
      children: (
         <>
            <SelectionActionButton
               disabled={downloadableDocuments.length === 0}
               icon={<Download className="size-4" />}
               onClick={() => downloadVaultFiles(downloadableDocuments)}
            >
               Baixar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Archive className="size-4" />}
               onClick={() => {
                  handleArchiveDocuments(selectedDocuments);
                  table.resetRowSelection();
               }}
            >
               Arquivar
            </SelectionActionButton>
            <SelectionActionButton
               icon={<Trash2 className="size-4" />}
               onClick={() => {
                  handleDeleteDocuments(selectedDocuments);
                  table.resetRowSelection();
               }}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </>
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
                  <DataTableBody<VaultDocumentRow>
                     renderGroupLabel={({ row }) => {
                        const folderName = String(
                           row.groupingValue || "Sem pasta",
                        );
                        const count = row.subRows.length;
                        return (
                           <div className="flex items-center gap-2">
                              <span className="font-medium">{folderName}</span>
                              <span className="text-muted-foreground text-xs">
                                 {count} {count === 1 ? "item" : "itens"}
                              </span>
                           </div>
                        );
                     }}
                     showGroupToggle={false}
                     table={table}
                  />
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
