import { Alert, AlertDescription } from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { AlertTriangle } from "lucide-react";
import type { FC, FormEvent } from "react";
import { Suspense, useCallback, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { z } from "zod";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useCredenza } from "@/hooks/use-credenza";
import { authClient } from "@/integrations/better-auth/auth-client";

function CreateTeamErrorFallback() {
   return (
      <CredenzaBody>
         <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
               Erro ao carregar dados da organização. Tente novamente.
            </AlertDescription>
         </Alert>
      </CredenzaBody>
   );
}

function CreateTeamSkeleton() {
   return (
      <CredenzaBody>
         <div className="grid gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
         </div>
      </CredenzaBody>
   );
}

const CreateTeamFormContent = () => {
   const { closeCredenza } = useCredenza();
   const { activeOrganization } = useActiveOrganization();
   const [isPending, startTransition] = useTransition();

   const createTeam = useCallback(
      async (data: {
         name: string;
         description?: string;
         organizationId?: string;
      }) => {
         toast.loading("Criando espaço...");
         const result = await authClient.organization.createTeam({
            name: data.name,
            organizationId: data.organizationId,
         });

         if (result.error) {
            toast.error(result.error.message || "Erro ao criar espaço");
            return;
         }
         toast.success("Espaço criado com sucesso");
         closeCredenza();
      },
      [closeCredenza],
   );

   const schema = z.object({
      description: z
         .string()
         .max(200, "A descrição deve ter menos de 200 caracteres")
         .default(""),
      name: z
         .string()
         .min(1, "Nome do espaço é obrigatório")
         .max(50, "O nome deve ter menos de 50 caracteres"),
      organizationId: z.string().default(""),
   });

   const form = useForm({
      defaultValues: {
         description: "",
         name: "",
         organizationId: activeOrganization?.id ?? "",
      },
      onSubmit: async ({ value, formApi }) => {
         await createTeam({
            name: value.name,
            description: value.description,
            organizationId: value.organizationId,
         });
         formApi.reset();
      },

      validators: {
         onBlur: schema as unknown as undefined,
      },
   });

   const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startTransition(async () => {
         await form.handleSubmit();
      });
   };

   return (
      <>
         <CredenzaBody>
            <form className="grid gap-4" id="create-team-form" onSubmit={handleSubmit}>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;

                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="Meu espaço"
                              type="text"
                              value={field.state.value}
                           />

                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               <form.Field name="description">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;

                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Descrição (Opcional)
                           </FieldLabel>
                           <Textarea
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="Descrição opcional"
                              rows={3}
                              value={field.state.value}
                           />

                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </form>
         </CredenzaBody>

         <CredenzaFooter>
            <Button onClick={closeCredenza} type="button" variant="outline">
               Cancelar
            </Button>
            <form.Subscribe>
               {(formState) => (
                  <Button
                     disabled={
                        !formState.canSubmit ||
                        formState.isSubmitting ||
                        isPending
                     }
                     onClick={() => {
                        startTransition(async () => {
                           await form.handleSubmit();
                        });
                     }}
                     type="submit"
                  >
                     {isPending ? "Criando..." : "Criar espaço"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
};

export const CreateTeamForm: FC = () => {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Criar espaço</CredenzaTitle>
            <CredenzaDescription>
               Crie um novo espaço para organizar os membros da sua organização
            </CredenzaDescription>
         </CredenzaHeader>
         <ErrorBoundary FallbackComponent={CreateTeamErrorFallback}>
            <Suspense fallback={<CreateTeamSkeleton />}>
               <CreateTeamFormContent />
            </Suspense>
         </ErrorBoundary>
      </>
   );
};
