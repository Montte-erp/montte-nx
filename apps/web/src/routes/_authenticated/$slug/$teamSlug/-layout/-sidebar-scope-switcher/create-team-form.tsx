import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
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
import { Spinner } from "@packages/ui/components/spinner";
import { getInitials } from "@core/utils/text";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "@tanstack/react-form";
import { toast } from "@packages/ui/hooks/use-toast";
import { z } from "zod";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { closeCredenza } from "@/hooks/use-credenza";
import { useDashboardSlugs } from "@/hooks/use-dashboard-slugs";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const createTeamSchema = z.object({
   name: z
      .string()
      .min(1, "Nome do espaço é obrigatório")
      .max(50, "O nome deve ter menos de 50 caracteres"),
});

export function CreateTeamForm() {
   const { activeOrganization } = useActiveOrganization();
   const queryClient = useQueryClient();
   const router = useRouter();
   const { slug } = useDashboardSlugs();

   const createTeam = useMutation(
      orpc.organization.createTeam.mutationOptions(),
   );

   const form = useForm({
      defaultValues: { name: "" },
      validators: { onSubmit: createTeamSchema },
      onSubmit: async ({ value }) => {
         const created = await toast
            .promise(createTeam.mutateAsync({ name: value.name }), {
               loading: "Criando espaço...",
               success: "Espaço criado",
               error: (err) => err.message,
            })
            .unwrap();

         await authClient.organization.setActiveTeam({ teamId: created.id });
         await queryClient.invalidateQueries({
            queryKey: orpc.organization.getOrganizationTeams.queryKey({}),
         });
         await queryClient.invalidateQueries({
            queryKey: orpc.session.getSession.queryKey({}),
         });

         closeCredenza();
         router.navigate({
            to: "/$slug/$teamSlug/inbox",
            params: { slug, teamSlug: created.slug },
         });
      },
   });

   const orgName = activeOrganization.name;

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle className="flex items-center gap-2">
               <Avatar className="size-8">
                  <AvatarImage
                     alt={orgName}
                     src={activeOrganization.logo ?? undefined}
                  />
                  <AvatarFallback className="text-xs">
                     {getInitials(orgName)}
                  </AvatarFallback>
               </Avatar>
               Criar espaço em {orgName}
            </CredenzaTitle>
            <CredenzaDescription>
               Use espaços para isolar dados e configurações dentro da
               organização.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <form
               id="create-team-form"
               onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
               }}
               className="flex flex-col gap-2"
            >
               <form.Field
                  name="name"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Nome do espaço
                           </FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              autoFocus
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex.: Operações"
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
            </form>
         </CredenzaBody>

         <CredenzaFooter className="flex justify-end">
            <form.Subscribe
               selector={(s) => s.isSubmitting}
               children={(isSubmitting) => (
                  <Button
                     disabled={isSubmitting}
                     form="create-team-form"
                     type="submit"
                  >
                     {isSubmitting && <Spinner className="size-4" />}
                     Criar espaço
                  </Button>
               )}
            />
         </CredenzaFooter>
      </>
   );
}
