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
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { getInitials } from "@core/utils/text";
import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const inviteSchema = z.object({
   emails: z
      .string()
      .min(1, "Informe ao menos um e-mail")
      .refine(
         (raw) => parseEmails(raw).valid.length > 0,
         "Nenhum e-mail válido encontrado",
      )
      .refine((raw) => parseEmails(raw).invalid.length === 0, {
         message: "Há e-mails inválidos na lista",
      }),
});

function parseEmails(raw: string): { valid: string[]; invalid: string[] } {
   const tokens = raw
      .split(/[\s,;]+/u)
      .map((t) => t.trim())
      .filter(Boolean);
   const seen = new Set<string>();
   const valid: string[] = [];
   const invalid: string[] = [];
   for (const token of tokens) {
      if (seen.has(token.toLowerCase())) continue;
      seen.add(token.toLowerCase());
      if (z.email().safeParse(token).success) {
         valid.push(token);
         continue;
      }
      invalid.push(token);
   }
   return { valid, invalid };
}

interface InviteMembersFormProps {
   organizationId: string;
   onSuccess: () => void;
}

export function InviteMembersForm({
   organizationId,
   onSuccess,
}: InviteMembersFormProps) {
   const { data: activeOrg } = useSuspenseQuery(
      orpc.organization.getActiveOrganization.queryOptions({}),
   );

   const form = useForm({
      defaultValues: { emails: "" },
      validators: { onSubmit: inviteSchema },
      onSubmit: async ({ value }) => {
         const { valid } = parseEmails(value.emails);
         let succeeded = 0;
         await Promise.all(
            valid.map(
               (email) =>
                  new Promise<void>((resolve) => {
                     authClient.organization.inviteMember({
                        email,
                        role: "member",
                        organizationId,
                        fetchOptions: {
                           onSuccess: () => {
                              succeeded += 1;
                              resolve();
                           },
                           onError: ({ error }) => {
                              toast.error(`${email}: ${error.message}`);
                              resolve();
                           },
                        },
                     });
                  }),
            ),
         );

         if (succeeded > 0) {
            toast.success(
               succeeded === 1
                  ? "Convite enviado!"
                  : `${succeeded} convites enviados!`,
            );
         }
         if (succeeded === valid.length) onSuccess();
      },
   });

   const orgName = activeOrg?.name ?? "Workspace";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle className="flex items-center gap-2">
               <Avatar className="size-8">
                  <AvatarImage
                     alt={orgName}
                     src={activeOrg?.logo ?? undefined}
                  />
                  <AvatarFallback className="text-xs">
                     {getInitials(orgName)}
                  </AvatarFallback>
               </Avatar>
               Convidar para o workspace
            </CredenzaTitle>
            <CredenzaDescription>
               Separe múltiplos e-mails com vírgula ou quebra de linha.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <form
               id="invite-members-form"
               onSubmit={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
               }}
               className="flex flex-col gap-2"
            >
               <form.Field
                  name="emails"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
                           <Textarea
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              placeholder="email@gmail.com, email2@gmail.com..."
                              rows={4}
                              value={field.state.value}
                              onInput={(e) =>
                                 field.handleChange(e.currentTarget.value)
                              }
                              onBlur={() => field.handleBlur()}
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
                     form="invite-members-form"
                     type="submit"
                  >
                     {isSubmitting && <Spinner className="size-4 mr-2" />}
                     Enviar convites
                  </Button>
               )}
            />
         </CredenzaFooter>
      </>
   );
}
