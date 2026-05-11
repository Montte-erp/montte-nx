import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { PasswordInput } from "@packages/ui/components/password-input";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { type FormEvent, useCallback } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";

const signInSchema = z.object({
   email: z.email("Insira um endereco de email valido."),
   password: z.string().min(8, "O campo deve ter no minimo 8 caracteres."),
});

const signInEmailSearchSchema = z.object({
   redirect: z
      .union([z.string().startsWith("/"), z.undefined()])
      .catch(undefined),
});

export const Route = createFileRoute("/auth/sign-in/email")({
   head: () => ({ meta: [{ title: "Entrar com email — Montte" }] }),
   validateSearch: signInEmailSearchSchema,
   component: SignInEmailPage,
});

function SignInEmailPage() {
   const router = useRouter();
   const { redirect: redirectTo } = Route.useSearch();

   const handleSignIn = useCallback(
      async (email: string, password: string) => {
         await authClient.signIn.email(
            { email, password },
            {
               onError: ({ error }) => {
                  toast.error(error.message);
               },
               onRequest: () => {
                  toast.loading("Entrando na sua conta...", {
                     id: "sign-in-email",
                  });
               },
               onSuccess: () => {
                  toast.success("Bem-vindo de volta!", { id: "sign-in-email" });
                  router.navigate({ to: redirectTo ?? "/auth/callback" });
               },
            },
         );
      },
      [redirectTo, router],
   );

   const form = useForm({
      defaultValues: {
         email: "",
         password: "",
      },
      onSubmit: async ({ value, formApi }) => {
         await handleSignIn(value.email, value.password);
         formApi.reset();
      },
      validators: {
         onBlur: signInSchema,
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

   return (
      <div className="flex w-full flex-col gap-6">
         <div className="flex flex-col items-center gap-2">
            <h1 className="text-center font-medium text-foreground text-xl leading-none">
               Entrar com email
            </h1>
            <p className="text-center text-muted-foreground text-sm">
               Use email e senha para acessar sua conta.
            </p>
         </div>

         <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <FieldGroup className="gap-4">
               <form.Field
                  name="email"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Email</FieldLabel>
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
               <form.Field
                  name="password"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field aria-required data-invalid={isInvalid}>
                           <div className="flex items-center justify-between">
                              <FieldLabel htmlFor={field.name}>
                                 Senha
                              </FieldLabel>
                              <Link
                                 className="text-muted-foreground text-xs hover:text-foreground hover:underline"
                                 to="/auth/forgot-password"
                              >
                                 Esqueci minha senha
                              </Link>
                           </div>
                           <PasswordInput
                              aria-invalid={isInvalid}
                              autoComplete="current-password"
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="********"
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
                     {isSubmitting ? <Spinner /> : "Entrar"}
                  </Button>
               )}
            </form.Subscribe>
         </form>

         <Button asChild className="h-10" variant="ghost">
            <Link to="/auth/sign-in" search={{ redirect: redirectTo }}>
               <ArrowLeft className="size-4" />
               Voltar para login
            </Link>
         </Button>

         <div className="flex items-center justify-center gap-1 text-center text-sm">
            <span className="text-muted-foreground">Primeira vez aqui?</span>
            <Link
               className="font-medium text-foreground hover:underline"
               search={{ redirect: redirectTo }}
               to="/auth/sign-up"
            >
               Criar conta
            </Link>
         </div>
      </div>
   );
}
