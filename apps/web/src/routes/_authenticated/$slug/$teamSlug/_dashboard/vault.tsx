import { useForm } from "@tanstack/react-form";
import {
   useMutation,
   useQueryClient,
   useSuspenseQueries,
} from "@tanstack/react-query";
import {
   getCoreRowModel,
   useReactTable,
   type ColumnDef,
   type SortingState,
} from "@tanstack/react-table";
import { createFileRoute } from "@tanstack/react-router";
import { useUploadFiles } from "@better-upload/client";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
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
import { Skeleton } from "@packages/ui/components/skeleton";
import { Table } from "@packages/ui/components/table";
import { UploadDropzone } from "@packages/ui/components/upload-dropzone";
import { UploadProgress } from "@packages/ui/components/upload-progress";
import { Archive, FileText, FolderPlus, Plus, ReceiptText } from "lucide-react";
import { DataTableBody } from "@/blocks/data-table/data-table-body";
import { DataTableColumnVisibility } from "@/blocks/data-table/data-table-column-visibility";
import { DataTableHeader } from "@/blocks/data-table/data-table-header";
import { DataTablePagination } from "@/blocks/data-table/data-table-pagination";
import { useTableUrlState } from "@/blocks/data-table/use-table-url-state";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
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
   head: () => ({
      meta: [{ title: "Vault — Montte" }],
   }),
   component: VaultPage,
});

type VaultDocumentRow = Outputs["vault"]["listDocuments"]["items"][number];
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

const vaultSortIdSchema = z.enum(["title", "status", "source", "updatedAt"]);

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

function documentIcon(document: VaultDocumentRow) {
   if (document.source === "fiscal") return ReceiptText;
   if (document.source === "finance") return Archive;
   return FileText;
}

function buildVaultColumns(): ColumnDef<VaultDocumentRow>[] {
   return [
      {
         accessorKey: "title",
         header: "Documento",
         size: 420,
         cell: ({ row }) => {
            const document = row.original;
            const Icon = documentIcon(document);
            return (
               <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                     <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                     <div className="truncate font-medium">
                        {document.title}
                     </div>
                     <div className="truncate text-xs text-muted-foreground">
                        {document.description ||
                           document.originalFileName ||
                           "Sem descrição"}
                     </div>
                  </div>
               </div>
            );
         },
      },
      {
         accessorKey: "folderName",
         header: "Pasta",
         enableSorting: false,
         size: 180,
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
         cell: ({ row }) => (
            <Badge variant="outline">{row.original.statusLabel}</Badge>
         ),
      },
      {
         accessorKey: "source",
         header: "Origem",
         size: 140,
         cell: ({ row }) => (
            <span className="text-muted-foreground">
               {row.original.sourceLabel}
            </span>
         ),
      },
      {
         id: "actions",
         header: "Ações",
         enableSorting: false,
         size: 96,
         meta: { align: "right" },
         cell: ({ row }) => {
            const href = row.original.fileKey
               ? `/api/files/${row.original.fileKey}`
               : undefined;
            return (
               <Button
                  asChild={Boolean(href)}
                  disabled={!href}
                  size="sm"
                  type="button"
                  variant="ghost"
               >
                  {href ? (
                     <a href={href} rel="noreferrer" target="_blank">
                        Abrir
                     </a>
                  ) : (
                     <span>Abrir</span>
                  )}
               </Button>
            );
         },
      },
   ];
}

function UploadDocumentSheet() {
   const queryClient = useQueryClient();
   const { closeTopSheet } = useSheet();
   const mutation = useMutation(
      orpc.vault.createDocument.mutationOptions({
         onSuccess: async () => {
            await Promise.all([
               queryClient.invalidateQueries(
                  orpc.vault.listDocuments.queryOptions({ input: {} }),
               ),
               queryClient.invalidateQueries(
                  orpc.vault.listFolders.queryOptions(),
               ),
               queryClient.invalidateQueries(
                  orpc.vault.getSummary.queryOptions(),
               ),
            ]);
            toast.success("Documento salvo no Vault.");
            closeTopSheet();
         },
         onError: (error) => toast.error(error.message),
      }),
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
         mutation.mutate({
            title: value.title,
            description: value.description || undefined,
            folderId: value.folderId || undefined,
            fileKey: value.fileKey || undefined,
            originalFileName: value.originalFileName || undefined,
            mimeType: value.mimeType || undefined,
            fileSize: value.fileSize || undefined,
            status: value.fileKey ? "stored" : "draft",
            source: "manual",
         });
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
                        !canSubmit ||
                        isSubmitting ||
                        mutation.isPending ||
                        upload.control.isPending
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

function CreateFolderSheet() {
   const queryClient = useQueryClient();
   const { closeTopSheet } = useSheet();
   const mutation = useMutation(
      orpc.vault.createFolder.mutationOptions({
         onSuccess: async () => {
            await Promise.all([
               queryClient.invalidateQueries(
                  orpc.vault.listFolders.queryOptions(),
               ),
               queryClient.invalidateQueries(
                  orpc.vault.getSummary.queryOptions(),
               ),
            ]);
            toast.success("Pasta criada no Vault.");
            closeTopSheet();
         },
         onError: (error) => toast.error(error.message),
      }),
   );
   const form = useForm({
      defaultValues: { name: "" },
      validators: {
         onSubmit: z.object({
            name: z.string().trim().min(1, "Nome obrigatório"),
         }),
      },
      onSubmit: ({ value }) => mutation.mutate({ name: value.name }),
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Nova pasta</SheetTitle>
            <SheetDescription>
               Organize documentos do Vault por pasta.
            </SheetDescription>
         </SheetHeader>
         <div className="min-h-0 flex-1 overflow-auto px-4">
            <form
               className="flex flex-col gap-4"
               id="create-vault-folder-form"
               onSubmit={(event) => {
                  event.preventDefault();
                  form.handleSubmit();
               }}
            >
               <form.Field
                  name="name"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name} required>
                              Nome da pasta
                           </FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onInput={(event) =>
                                 field.handleChange(event.currentTarget.value)
                              }
                              placeholder="Ex.: Jurídico"
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
            </form>
         </div>
         <SheetFooter>
            <Button
               disabled={mutation.isPending}
               form="create-vault-folder-form"
               type="submit"
            >
               Criar pasta
            </Button>
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
   table,
}: {
   table: ReturnType<typeof useReactTable<VaultDocumentRow>>;
}) {
   const { search } = Route.useSearch();
   const navigate = Route.useNavigate();
   const { openSheet } = useSheet();

   return (
      <div className="flex flex-wrap items-center justify-between gap-2">
         <SearchInput
            aria-label="Buscar documentos"
            className="max-w-sm"
            onChange={(event) =>
               navigate({
                  search: (prev) => ({
                     ...prev,
                     search: event.target.value,
                     page: 1,
                  }),
                  replace: true,
               })
            }
            placeholder="Buscar documentos..."
            value={search}
         />
         <div className="flex flex-wrap items-center gap-2">
            <Button
               onClick={() =>
                  openSheet({
                     className: "sm:max-w-md",
                     renderChildren: () => <CreateFolderSheet />,
                  })
               }
               size="icon-sm"
               tooltip="Nova pasta"
               type="button"
               variant="outline"
            >
               <FolderPlus />
               <span className="sr-only">Nova pasta</span>
            </Button>
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
   return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
         <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-9 w-full max-w-sm" />
            <Skeleton className="h-8 w-20" />
         </div>
         <Skeleton className="min-h-0 flex-1 rounded-md" />
      </div>
   );
}

function VaultContent() {
   const search = Route.useSearch();
   const navigate = Route.useNavigate();
   const columns = useMemo(() => buildVaultColumns(), []);
   const documentInput = {
      search: search.search,
      folderId: search.folderId === "all" ? undefined : search.folderId,
      page: search.page,
      pageSize: search.pageSize,
      sorting: normalizeVaultSorting(search.sorting),
   };
   useContextPanelInfo(() => <VaultInfoContent />);

   const [documentsQuery] = useSuspenseQueries({
      queries: [
         orpc.vault.listDocuments.queryOptions({ input: documentInput }),
      ],
   });
   const tableUrlState = useTableUrlState({
      search,
      totalRows: documentsQuery.data.total,
      onUpdate: (next) =>
         navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
         }),
   });
   const table = useReactTable({
      data: documentsQuery.data.items,
      columns,
      getCoreRowModel: getCoreRowModel(),
      manualFiltering: true,
      manualPagination: true,
      manualSorting: true,
      pageCount: tableUrlState.pageCount,
      rowCount: documentsQuery.data.total,
      state: tableUrlState.state,
      onSortingChange: tableUrlState.onSortingChange,
      onColumnFiltersChange: tableUrlState.onColumnFiltersChange,
      onPaginationChange: tableUrlState.onPaginationChange,
      onRowSelectionChange: tableUrlState.onRowSelectionChange,
      enableRowSelection: false,
   });

   return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
         <VaultToolbar table={table} />
         <ScrollArea className="min-h-0 flex-1 rounded-md border bg-card">
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
                        Envie um arquivo ou ajuste a busca para ver documentos
                        do Vault.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            ) : null}
         </ScrollArea>
         <DataTablePagination table={table} />
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
         <QueryBoundary
            errorTitle="Erro ao carregar Vault"
            fallback={<VaultSkeleton />}
         >
            <VaultContent />
         </QueryBoundary>
      </main>
   );
}
