import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { formatDate } from "@core/utils/date";
import { Button } from "@packages/ui/components/button";
import {
   Dropzone,
   DropzoneContent,
   DropzoneEmptyState,
} from "@packages/ui/components/dropzone";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Item,
   ItemContent,
   ItemDescription,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import { Separator } from "@packages/ui/components/separator";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useUploadImage } from "@/hooks/use-upload-image";
import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useClipboard } from "foxact/use-clipboard";
import {
   Building2,
   Calendar,
   Check,
   Copy,
   Hash,
   Loader2,
   Users,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { useFileUpload } from "@/features/file-upload/lib/use-file-upload";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { DefaultHeader } from "../../../-layout/default-header";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/organization/general",
)({
   head: () => ({
      meta: [{ title: "Organização — Montte" }],
   }),
   component: OrganizationGeneralPage,
});

// Display Name Section

const organizationNameSchema = z.object({
   name: z.string().trim().min(1, "Nome é obrigatório"),
});

function DisplayNameSection({
   organizationId,
   currentName,
}: {
   organizationId: string;
   currentName: string;
}) {
   const currentNormalizedName = currentName.trim();
   const form = useForm({
      defaultValues: { name: currentName },
      onSubmit: async ({ value, formApi }) => {
         const name = value.name.trim();
         if (name === currentNormalizedName) {
            formApi.reset({ name });
            return;
         }
         await authClient.organization.update(
            {
               data: { name },
               organizationId,
            },
            {
               onError: ({ error }) => {
                  toast.error(error.message ?? "Erro ao renomear organização");
               },
               onSuccess: () => {
                  toast.success("Organização renomeada com sucesso!");
                  formApi.reset({ name });
               },
            },
         );
      },
      validators: { onBlur: organizationNameSchema },
   });

   return (
      <section className="space-y-3">
         <div>
            <h2 className="text-lg font-medium">Nome de exibição</h2>
            <p className="text-sm text-muted-foreground">
               O nome público da sua organização. Visível para todos os membros.
            </p>
         </div>
         <form
            className="flex max-w-md flex-col gap-4"
            onSubmit={(event) => {
               event.preventDefault();
               event.stopPropagation();
               form.handleSubmit();
            }}
         >
            <FieldGroup>
               <form.Field
                  name="name"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                 field.handleChange(event.target.value)
                              }
                              placeholder="Nome da organização"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               />
            </FieldGroup>
            <form.Subscribe
               selector={(state) => ({
                  canSubmit: state.canSubmit,
                  hasNameChange:
                     state.values.name.trim() !== currentNormalizedName,
                  isDirty: state.isDirty,
                  isSubmitting: state.isSubmitting,
               })}
            >
               {({ canSubmit, hasNameChange, isDirty, isSubmitting }) => (
                  <Button
                     disabled={!isDirty || !hasNameChange || !canSubmit}
                     type="submit"
                  >
                     <span className="flex items-center gap-2">
                        {isSubmitting && (
                           <Loader2 className="size-4 animate-spin" />
                        )}
                        Renomear organização
                     </span>
                  </Button>
               )}
            </form.Subscribe>
         </form>
      </section>
   );
}

// Logo Section

function extractPublicUrl(metadata: unknown): string | null {
   if (typeof metadata !== "object" || metadata === null) return null;
   if (!("publicUrl" in metadata)) return null;
   const url = metadata.publicUrl;
   return typeof url === "string" ? url : null;
}

function LogoSection({
   organizationId,
   currentLogo,
   organizationName,
}: {
   organizationId: string;
   currentLogo: string | null;
   organizationName: string;
}) {
   const fileUpload = useFileUpload({
      acceptedTypes: ["image/*"],
      maxSize: 5 * 1024 * 1024,
   });

   const { upload, isPending } = useUploadImage({
      route: "organizationLogo",
      api: "/api/upload",
      onUploadComplete: async ({ metadata }) => {
         const publicUrl = extractPublicUrl(metadata);
         if (!publicUrl) {
            toast.error("Erro ao atualizar logo");
            return;
         }
         const { error } = await authClient.organization.update({
            data: { logo: publicUrl },
            organizationId,
         });
         if (error) {
            toast.error("Erro ao atualizar logo");
            return;
         }
         toast.success("Logo atualizado com sucesso!");
         fileUpload.clearFile();
      },
      onError: () => {
         toast.error("Erro ao enviar imagem");
      },
   });

   return (
      <section className="space-y-3" data-testid="logo-section">
         <div>
            <h2 className="text-lg font-medium">Logo</h2>
            <p className="text-sm text-muted-foreground">
               A imagem da sua organização. Recomendamos 192x192 px ou maior.
            </p>
         </div>
         <div className="flex items-start gap-4">
            <Avatar className="size-16 rounded-lg">
               <AvatarImage
                  alt={organizationName}
                  src={fileUpload.filePreview || currentLogo || undefined}
               />
               <AvatarFallback className="rounded-lg">
                  <Building2 className="size-6" />
               </AvatarFallback>
            </Avatar>
            <div className="flex-1 max-w-xs">
               <Dropzone
                  accept={{
                     "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
                  }}
                  className="h-20"
                  maxFiles={1}
                  maxSize={5 * 1024 * 1024}
                  onDrop={(files) =>
                     fileUpload.handleFileSelect(files, () => {})
                  }
               >
                  <DropzoneEmptyState>
                     <p className="text-xs text-muted-foreground">
                        Clique ou arraste para enviar
                     </p>
                  </DropzoneEmptyState>
                  <DropzoneContent>
                     <p className="text-xs text-muted-foreground">
                        Imagem selecionada
                     </p>
                  </DropzoneContent>
               </Dropzone>
            </div>
         </div>
         {fileUpload.filePreview && fileUpload.selectedFile && (
            <Button
               data-testid="save-logo-button"
               disabled={isPending}
               onClick={() =>
                  fileUpload.selectedFile && upload(fileUpload.selectedFile)
               }
            >
               {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
               Salvar logo
            </Button>
         )}
         {fileUpload.error && (
            <p className="text-sm text-destructive">{fileUpload.error}</p>
         )}
      </section>
   );
}

// Organization Details Section

function OrganizationDetailsSection({
   slug,
   memberCount,
   createdAt,
}: {
   slug: string;
   memberCount: number;
   createdAt: Date | string;
}) {
   const { copied, copy } = useClipboard({ timeout: 2000 });
   const createdAtLabel = formatDate(createdAt, "DD de MMMM de YYYY");

   const handleCopySlug = () => {
      copy(slug);
      toast.success("Slug copiado!");
   };

   return (
      <section className="space-y-3">
         <div>
            <h2 className="text-lg font-medium">Detalhes da organização</h2>
            <p className="text-sm text-muted-foreground">
               Informações gerais sobre sua organização.
            </p>
         </div>
         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Item variant="muted">
               <ItemMedia variant="icon">
                  <Hash className="size-4" />
               </ItemMedia>
               <ItemContent>
                  <ItemTitle>Slug</ItemTitle>
                  <ItemDescription>
                     <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
                        {slug}
                     </code>
                  </ItemDescription>
               </ItemContent>
               <Button
                  className="size-7"
                  onClick={handleCopySlug}
                  tooltip="Copiar"
                  variant="outline"
               >
                  {copied ? (
                     <Check className="size-4" />
                  ) : (
                     <Copy className="size-4" />
                  )}
               </Button>
            </Item>

            <Item variant="muted">
               <ItemMedia variant="icon">
                  <Users className="size-4" />
               </ItemMedia>
               <ItemContent>
                  <ItemTitle>Membros</ItemTitle>
                  <ItemDescription>
                     {memberCount} {memberCount === 1 ? "membro" : "membros"}
                  </ItemDescription>
               </ItemContent>
            </Item>

            <Item variant="muted">
               <ItemMedia variant="icon">
                  <Calendar className="size-4" />
               </ItemMedia>
               <ItemContent>
                  <ItemTitle>Criada em</ItemTitle>
                  <ItemDescription>{createdAtLabel}</ItemDescription>
               </ItemContent>
            </Item>
         </div>
      </section>
   );
}

// Skeleton

function OrganizationGeneralSkeleton() {
   return (
      <div className="space-y-8">
         <div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-64 mt-1" />
         </div>
         <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-8 w-48" />
         </div>
         <Skeleton className="h-px w-full" />
         <div className="space-y-3">
            <Skeleton className="h-6 w-24" />
            <div className="flex gap-4">
               <Skeleton className="size-16 rounded-lg" />
               <Skeleton className="h-20 w-64" />
            </div>
         </div>
         <Skeleton className="h-px w-full" />
         <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
         </div>
      </div>
   );
}

// Error Fallback

function OrganizationGeneralErrorFallback({
   resetErrorBoundary,
}: FallbackProps) {
   return (
      <div className="space-y-6">
         <DefaultHeader
            description="Gerencie as informações da sua organização."
            title="Geral"
         />
         <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
               Não foi possível carregar as configurações da organização
            </p>
            <Button onClick={resetErrorBoundary} variant="outline">
               Tentar novamente
            </Button>
         </div>
      </div>
   );
}

// Main Content

function OrganizationGeneralContent() {
   const { data: activeOrganization } = useSuspenseQuery(
      orpc.organization.getActiveOrganization.queryOptions({}),
   );

   if (!activeOrganization) {
      throw new Error("No active organization found");
   }

   const memberCount = activeOrganization.members?.length ?? 0;

   return (
      <div className="space-y-8">
         <DefaultHeader
            description="Gerencie as informações da sua organização."
            title="Geral"
         />

         <DisplayNameSection
            currentName={activeOrganization.name}
            organizationId={activeOrganization.id}
         />

         <Separator />

         <LogoSection
            currentLogo={activeOrganization.logo ?? null}
            organizationId={activeOrganization.id}
            organizationName={activeOrganization.name}
         />

         <Separator />

         <OrganizationDetailsSection
            createdAt={activeOrganization.createdAt}
            memberCount={memberCount}
            slug={activeOrganization.slug}
         />
      </div>
   );
}

// Page

function OrganizationGeneralPage() {
   return (
      <ErrorBoundary FallbackComponent={OrganizationGeneralErrorFallback}>
         <Suspense fallback={<OrganizationGeneralSkeleton />}>
            <OrganizationGeneralContent />
         </Suspense>
      </ErrorBoundary>
   );
}
