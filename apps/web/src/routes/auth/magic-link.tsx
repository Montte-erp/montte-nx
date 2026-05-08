import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";

export const Route = createFileRoute("/auth/magic-link")({
   head: () => ({ meta: [{ title: "Link mágico — Montte" }] }),
   component: MagicLinkPage,
});

const magicLinkSchema = z.object({
   email: z.email("Insira um endereco de email valido."),
});

function MagicLinkPage() {
   const [isSent, setIsSent] = useState(false);

   const handleMagicLinkSignIn = useCallback(async (email: string) => {
      await authClient.signIn.magicLink(
         {
            email,
            callbackURL: `${window.location.origin}/auth/callback`,
         },
         {
            onError: ({ error }) => {
               toast.error(error.message);
            },
            onRequest: () => {
               toast.loading("Enviando link de acesso...");
            },
            onSuccess: async () => {
               try {
                  const res = await fetch(
                     `/api/auth/dev/magic-link?email=${encodeURIComponent(email)}`,
                  );
                  const data = await res.json();
                  if (data.url) {
                     window.location.href = data.url;
                     return;
                  }
               } catch {
                  // dev endpoint indisponível — fluxo normal
               }
               setIsSent(true);
               toast.success("Link enviado! Verifique seu e-mail.");
            },
         },
      );
   }, []);

   const form = useForm({
      defaultValues: {
         email: "",
      },
      onSubmit: async ({ value }) => {
         await handleMagicLinkSignIn(value.email);
      },
      validators: {
         onBlur: magicLinkSchema,
      },
   });

   const handleSubmit = useCallback(
      (e: FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         form.handleSubmit();
      },
      [form],
   );

   if (isSent) {
      return (
         <div className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-center">
               <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Mail className="size-5 text-foreground" />
               </div>
            </div>
            <div className="flex flex-col items-center gap-2">
               <h1 className="text-center font-medium text-foreground text-xl leading-none">
                  Verifique seu email
               </h1>
               <p className="max-w-xs text-center text-muted-foreground text-sm">
                  Enviamos um link para acessar sua conta. Pode demorar até um
                  minuto.
               </p>
            </div>
            <div className="flex flex-col gap-2">
               <Button
                  className="h-10"
                  onClick={() => setIsSent(false)}
                  variant="outline"
               >
                  Usar outro email
               </Button>
               <Button asChild className="h-10" variant="ghost">
                  <Link to="/auth/sign-in">
                     <ArrowLeft className="size-4" />
                     Voltar para login
                  </Link>
               </Button>
            </div>
         </div>
      );
   }

   return (
      <div className="flex w-full flex-col gap-6">
         <div className="flex flex-col items-center gap-2">
            <h1 className="text-center font-medium text-foreground text-xl leading-none">
               Qual é o seu email?
            </h1>
            <p className="text-center text-muted-foreground text-sm">
               Receba um link para entrar sem senha.
            </p>
         </div>

         <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={handleSubmit}
         >
            <FieldGroup className="gap-4">
               <form.Field
                  name="email"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel className="sr-only" htmlFor={field.name}>
                              Email
                           </FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              autoComplete="email"
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="nome@empresa.com"
                              type="email"
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
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     className="h-10 w-full"
                     disabled={!canSubmit || isSubmitting}
                     type="submit"
                  >
                     {isSubmitting ? <Spinner /> : "Continuar com email"}
                  </Button>
               )}
            </form.Subscribe>
         </form>

         <FieldDescription className="text-center">
            O link expira em 15 minutos.
         </FieldDescription>

         <Button asChild className="h-10" variant="ghost">
            <Link to="/auth/sign-in">
               <ArrowLeft className="size-4" />
               Voltar para login
            </Link>
         </Button>
      </div>
   );
}
