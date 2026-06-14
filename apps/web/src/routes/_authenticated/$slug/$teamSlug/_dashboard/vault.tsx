import { useForm } from "@tanstack/react-form";
import {
   useMutation,
   useQueryClient,
   useSuspenseQueries,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useUploadFiles } from "@better-upload/client";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { Separator } from "@packages/ui/components/separator";
import { Skeleton } from "@packages/ui/components/skeleton";
import { UploadDropzone } from "@packages/ui/components/upload-dropzone";
import { UploadProgress } from "@packages/ui/components/upload-progress";
import {
   Archive,
   Building2,
   FileCheck2,
   FileText,
   Plus,
   ReceiptText,
   Search,
} from "lucide-react";
import { Fragment } from "react";
import { QueryBoundary } from "@/components/query-boundary";
import { orpc } from "@/integrations/orpc/client";
import type { Outputs } from "@/integrations/orpc/client";
import { useCredenza } from "@/hooks/use-credenza";
import { DefaultHeader } from "../-layout/default-header";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/vault",
)({
   validateSearch: z.object({
      q: z.string().catch("").default(""),
      folderId: z.string().catch("all").default("all"),
   }),
   head: () => ({
      meta: [{ title: "Vault — Montte" }],
   }),
   component: VaultPage,
});

type VaultFolderRow = Outputs["vault"]["listFolders"][number];
type VaultDocumentRow = Outputs["vault"]["listDocuments"]["items"][number];
type VaultSummary = Outputs["vault"]["getSummary"];

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

const folderIcons: Record<string, typeof Archive> = {
   all: Archive,
   attachments: Archive,
   fiscal: ReceiptText,
   contracts: FileText,
   company: Building2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
   return typeof value === "object" && value !== null;
}

function getMetadataString(metadata: unknown, key: string) {
   if (!isRecord(metadata)) return undefined;
   const value = metadata[key];
   return typeof value === "string" ? value : undefined;
}

function folderIcon(folder: string) {
   return folderIcons[folder] ?? FileText;
}

function documentIcon(document: VaultDocumentRow) {
   if (document.source === "fiscal") return ReceiptText;
   if (document.source === "finance") return Archive;
   return FileText;
}

function UploadDocumentCredenza() {
   const queryClient = useQueryClient();
   const { closeTopCredenza } = useCredenza();
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
            closeTopCredenza();
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
         <CredenzaHeader>
            <CredenzaTitle>Novo documento</CredenzaTitle>
            <CredenzaDescription>
               Envie o arquivo para o bucket e salve os metadados no GED do
               Montte.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
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
         </CredenzaBody>
         <CredenzaFooter>
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
         </CredenzaFooter>
      </>
   );
}

function CreateFolderCredenza() {
   const queryClient = useQueryClient();
   const { closeTopCredenza } = useCredenza();
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
            closeTopCredenza();
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
         <CredenzaHeader>
            <CredenzaTitle>Nova pasta</CredenzaTitle>
            <CredenzaDescription>
               Organize documentos do Vault por pasta.
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
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
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               disabled={mutation.isPending}
               form="create-vault-folder-form"
               type="submit"
            >
               Criar pasta
            </Button>
         </CredenzaFooter>
      </>
   );
}

function FolderItem({ folder }: { folder: VaultFolderRow }) {
   const Icon = folderIcon(folder.id);
   const { folderId: selectedFolder } = Route.useSearch();
   const navigate = Route.useNavigate();
   const active = selectedFolder === folder.id;

   return (
      <Item size="sm" asChild variant={active ? "muted" : "default"}>
         <li>
            <button
               className="contents text-left"
               onClick={() =>
                  navigate({
                     search: (prev) => ({ ...prev, folderId: folder.id }),
                     replace: true,
                  })
               }
               type="button"
            >
               <ItemMedia>
                  <Icon className="size-4 text-muted-foreground" />
               </ItemMedia>
               <ItemContent>
                  <ItemTitle>{folder.name}</ItemTitle>
               </ItemContent>
               <ItemActions>
                  <span className="text-sm text-muted-foreground">
                     {folder.total}
                  </span>
               </ItemActions>
            </button>
         </li>
      </Item>
   );
}

function DocumentItem({ document }: { document: VaultDocumentRow }) {
   const Icon = documentIcon(document);
   const href = document.fileKey ? `/api/files/${document.fileKey}` : undefined;

   return (
      <Item asChild>
         <li>
            <ItemMedia variant="icon">
               <Icon className="text-muted-foreground" />
            </ItemMedia>
            <ItemContent>
               <ItemTitle>{document.title}</ItemTitle>
               <ItemDescription>
                  {document.description || "Documento sem descrição."}
               </ItemDescription>
               <ItemDescription>
                  {document.folderName} · {document.sourceLabel}
               </ItemDescription>
            </ItemContent>
            <ItemActions>
               <Badge variant="outline">{document.statusLabel}</Badge>
               <Button
                  asChild={Boolean(href)}
                  size="sm"
                  type="button"
                  variant="outline"
               >
                  {href ? (
                     <a href={href} rel="noreferrer" target="_blank">
                        Abrir
                     </a>
                  ) : (
                     <span>Abrir</span>
                  )}
               </Button>
            </ItemActions>
         </li>
      </Item>
   );
}

function VaultFoldersPanel({ folders }: { folders: VaultFolderRow[] }) {
   const { openCredenza } = useCredenza();

   return (
      <aside className="flex flex-col gap-3 lg:w-64 lg:shrink-0">
         <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
               <h2 className="text-sm font-medium">Pastas</h2>
               <p className="text-sm text-muted-foreground">
                  Anexos é a pasta padrão do GED.
               </p>
            </div>
            <Button
               onClick={() =>
                  openCredenza({
                     className: "sm:max-w-md",
                     renderChildren: () => <CreateFolderCredenza />,
                  })
               }
               size="icon-sm"
               type="button"
               variant="outline"
            >
               <Plus className="size-4" />
               <span className="sr-only">Nova pasta</span>
            </Button>
         </div>
         <ItemGroup className="overflow-hidden rounded-lg border bg-card">
            {folders.map((folder, index) => (
               <Fragment key={folder.id}>
                  {index > 0 ? <ItemSeparator /> : null}
                  <FolderItem folder={folder} />
               </Fragment>
            ))}
         </ItemGroup>
      </aside>
   );
}

function VaultDocumentsPanel({ documents }: { documents: VaultDocumentRow[] }) {
   const { openCredenza } = useCredenza();
   const { q } = Route.useSearch();
   const navigate = Route.useNavigate();

   return (
      <section className="flex min-w-0 flex-1 flex-col gap-4">
         <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
               <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
               <Input
                  className="pl-9"
                  onChange={(event) =>
                     navigate({
                        search: (prev) => ({ ...prev, q: event.target.value }),
                        replace: true,
                     })
                  }
                  placeholder="Buscar documentos..."
                  value={q}
               />
            </div>
            <Button
               onClick={() =>
                  openCredenza({
                     className: "sm:max-w-lg",
                     renderChildren: () => <UploadDocumentCredenza />,
                  })
               }
               type="button"
            >
               <Plus className="size-4" />
               Novo documento
            </Button>
         </div>

         {documents.length > 0 ? (
            <ItemGroup className="overflow-hidden rounded-lg border bg-card">
               {documents.map((document, index) => (
                  <Fragment key={document.id}>
                     {index > 0 ? <ItemSeparator /> : null}
                     <DocumentItem document={document} />
                  </Fragment>
               ))}
            </ItemGroup>
         ) : (
            <div className="rounded-lg border bg-card">
               <Empty>
                  <EmptyHeader>
                     <EmptyTitle>Nenhum documento no Vault</EmptyTitle>
                     <EmptyDescription>
                        Envie o primeiro arquivo para começar o GED deste
                        espaço.
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            </div>
         )}
      </section>
   );
}

function VaultSummaryPanel({ summary }: { summary: VaultSummary }) {
   return (
      <aside className="flex flex-col gap-4 lg:w-72 lg:shrink-0">
         <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
               <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
                  <FileCheck2 className="size-4 text-muted-foreground" />
               </div>
               <div>
                  <div className="font-medium">GED Montte</div>
                  <div className="text-sm text-muted-foreground">
                     {summary.total} documento{summary.total === 1 ? "" : "s"}
                  </div>
               </div>
            </div>
            <Separator className="my-4" />
            <dl className="grid gap-3 text-sm">
               {summary.folders.map((folder) => (
                  <div
                     className="flex items-center justify-between"
                     key={folder.id}
                  >
                     <dt className="text-muted-foreground">{folder.name}</dt>
                     <dd className="font-medium">{folder.total}</dd>
                  </div>
               ))}
            </dl>
         </div>

         <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            O Vault começa como cofre documental: emissão fiscal, anexos,
            contratos e documentos da empresa em um só lugar.
         </div>
      </aside>
   );
}

function VaultSkeleton() {
   return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
         <Skeleton className="h-72 lg:w-64" />
         <Skeleton className="h-96 flex-1" />
         <Skeleton className="h-72 lg:w-72" />
      </div>
   );
}

function VaultContent() {
   const { q, folderId } = Route.useSearch();
   const documentInput = {
      search: q,
      folderId: folderId === "all" ? undefined : folderId,
      page: 1,
      pageSize: 50,
      sorting: [{ id: "updatedAt", desc: true }],
   } satisfies {
      search: string;
      folderId?: string;
      page: number;
      pageSize: number;
      sorting: { id: "updatedAt"; desc: boolean }[];
   };
   const [foldersQuery, documentsQuery, summaryQuery] = useSuspenseQueries({
      queries: [
         orpc.vault.listFolders.queryOptions(),
         orpc.vault.listDocuments.queryOptions({ input: documentInput }),
         orpc.vault.getSummary.queryOptions(),
      ],
   });

   return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto lg:flex-row">
         <VaultFoldersPanel folders={foldersQuery.data} />
         <VaultDocumentsPanel documents={documentsQuery.data.items} />
         <VaultSummaryPanel summary={summaryQuery.data} />
      </div>
   );
}

function VaultPage() {
   return (
      <main className="flex flex-1 min-h-0 flex-col gap-4 overflow-hidden">
         <DefaultHeader
            description="GED do Montte para organizar documentos fiscais, contratos e anexos do espaço."
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
