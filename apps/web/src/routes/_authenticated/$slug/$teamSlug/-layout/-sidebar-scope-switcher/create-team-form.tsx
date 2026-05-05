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
import type { FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { closeCredenza } from "@/hooks/use-credenza";
import { authClient } from "@/integrations/better-auth/auth-client";

const createTeamSchema = z.object({
   description: z
      .string()
      .max(200, "A descrição deve ter menos de 200 caracteres"),
   name: z
      .string()
      .min(1, "Nome do espaço é obrigatório")
      .max(50, "O nome deve ter menos de 50 caracteres"),
   organizationId: z.string(),
});

function CreateTeamSkeleton() {
   return (
      <div className="flex-1 overflow-y-auto p-4">
         <div className="grid gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-full" />
         </div>
      </div>
   );
}

function CreateTeamFormContent() {
   const { activeOrganization } = useActiveOrganization();

   const form = useForm({
      defaultValues: {
         description: "",
         name: "",
         organizationId: activeOrganization.id,
      },
      validators: { onBlur: createTeamSchema },
      onSubmit: async ({ value }) => {
         const toastId = toast.loading("Criando espaço...");
         const result = await authClient.organization.createTeam({
            name: value.name,
            organizationId: value.organizationId,
         });
         if (result.error) {
            toast.error(result.error.message ?? "Erro ao criar espaço", {
               id: toastId,
            });
            return;
         }
         toast.success("Espaço criado com sucesso", { id: toastId });
         closeCredenza();
      },
   });

   const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      void form.handleSubmit();
   };

   return (
      <>
         <CredenzaBody className="px-4">
            <form
               className="grid gap-4"
               id="create-team-form"
               onSubmit={handleSubmit}
            >
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
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
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
               />

               <form.Field
                  name="description"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
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
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
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
               />
            </form>
         </CredenzaBody>

         <CredenzaFooter>
            <Button onClick={closeCredenza} type="button" variant="outline">
               Cancelar
            </Button>
            <form.Subscribe
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     disabled={!canSubmit || isSubmitting}
                     form="create-team-form"
                     type="submit"
                  >
                     {isSubmitting ? "Criando..." : "Criar espaço"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
}

export function CreateTeamForm() {
   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Criar espaço</CredenzaTitle>
            <CredenzaDescription>
               Crie um novo espaço para organizar os membros da sua organização
            </CredenzaDescription>
         </CredenzaHeader>
         <QueryBoundary
            errorTitle="Erro ao carregar dados da organização"
            fallback={<CreateTeamSkeleton />}
         >
            <CreateTeamFormContent />
         </QueryBoundary>
      </>
   );
}
