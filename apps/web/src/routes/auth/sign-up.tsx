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
import { defineStepper } from "@packages/ui/components/stepper";
import { useToastActions } from "@packages/ui/hooks/use-toast";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createContext, type FormEvent, useCallback, useContext } from "react";
import z from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";
import { PasswordStrengthCard } from "./-auth/password-strength-card";
import { TermsAndPrivacyText } from "./-auth/terms-and-privacy-text";

const steps = [
   { id: "basic-info", title: "basic-info" },
   { id: "password", title: "password" },
] as const;

const { Stepper } = defineStepper(...steps);

const searchParams = z.object({
   redirect: z
      .union([z.string().startsWith("/"), z.undefined()])
      .catch(undefined),
});

export const Route = createFileRoute("/auth/sign-up")({
   head: () => ({ meta: [{ title: "Criar conta — Montte" }] }),
   component: SignUpPage,
   validateSearch: searchParams,
});

const signUpSchema = z
   .object({
      confirmPassword: z.string(),
      email: z.email("Insira um endereco de email valido."),
      name: z.string().min(2, "O campo deve ter no minimo 2 caracteres."),
      password: z.string().min(8, "O campo deve ter no minimo 8 caracteres."),
   })
   .refine((data) => data.password === data.confirmPassword, {
      message: "As senhas nao coincidem.",
      path: ["confirmPassword"],
   });

function createSignUpForm() {
   return useForm({
      defaultValues: {
         confirmPassword: "",
         email: "",
         name: "",
         password: "",
      },
      validators: { onChange: signUpSchema },
   });
}
type SignUpFormApi = ReturnType<typeof createSignUpForm>;

const SignUpFormContext = createContext<SignUpFormApi | null>(null);

function useSignUpForm() {
   const form = useContext(SignUpFormContext);
   if (!form) throw new Error("useSignUpForm used outside provider");
   return form;
}

function BasicInfoStep() {
   const form = useSignUpForm();
   return (
      <FieldGroup className="gap-4">
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
                        autoComplete="name"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Seu nome completo"
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
                        onChange={(e) => field.handleChange(e.target.value)}
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
   );
}

function PasswordStep() {
   const form = useSignUpForm();
   return (
      <FieldGroup className="gap-4">
         <form.Field
            name="password"
            children={(field) => {
               const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0;
               return (
                  <Field data-invalid={isInvalid}>
                     <FieldLabel htmlFor={field.name}>Senha</FieldLabel>
                     <PasswordInput
                        aria-invalid={isInvalid}
                        autoComplete="new-password"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
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
            name="confirmPassword"
            children={(field) => {
               const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0;
               return (
                  <Field data-invalid={isInvalid}>
                     <FieldLabel htmlFor={field.name}>
                        Confirmar senha
                     </FieldLabel>
                     <PasswordInput
                        aria-invalid={isInvalid}
                        autoComplete="new-password"
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Repita a senha"
                        value={field.state.value}
                     />
                     {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                     )}
                  </Field>
               );
            }}
         />
         <form.Subscribe selector={(state) => state.values.password}>
            {(password) => <PasswordStrengthCard password={password} />}
         </form.Subscribe>
      </FieldGroup>
   );
}

function SignUpPage() {
   const router = useRouter();
   const { redirect: redirectTo } = Route.useSearch();
   const signUpToast = useToastActions("sign-up-email");

   const handleSignUp = useCallback(
      async (email: string, name: string, password: string) => {
         await authClient.signUp.email(
            { email, name, password },
            {
               onError: ({ error }) => {
                  signUpToast.error(error.message);
               },
               onRequest: () => {
                  signUpToast.loading("Criando sua conta...");
               },
               onSuccess: ({ data }) => {
                  signUpToast.success("Conta criada com sucesso!");
                  if (data?.token) {
                     router.navigate({ to: redirectTo ?? "/auth/callback" });
                     return;
                  }
                  router.navigate({
                     search: { email, redirect: redirectTo },
                     to: "/auth/email-verification",
                  });
               },
            },
         );
      },
      [redirectTo, router, signUpToast],
   );

   const form = useForm({
      defaultValues: {
         confirmPassword: "",
         email: "",
         name: "",
         password: "",
      },
      onSubmit: async ({ value, formApi }) => {
         await handleSignUp(value.email, value.name, value.password);
         formApi.reset();
      },
      validators: {
         onChange: signUpSchema,
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
      <SignUpFormContext.Provider value={form}>
         <Stepper.Provider>
            {({ methods }) => (
               <div className="flex w-full flex-col gap-6">
                  <div className="flex flex-col items-center gap-2">
                     <h1 className="text-center font-medium text-foreground text-xl leading-none">
                        Criar conta
                     </h1>
                     <p className="text-center text-muted-foreground text-sm">
                        Comece a gerenciar seu negócio com IA.
                     </p>
                  </div>

                  <div className="flex justify-center gap-2">
                     {steps.map((step, index) => (
                        <span
                           aria-current={
                              methods.state.current.data.id === step.id
                                 ? "step"
                                 : undefined
                           }
                           className="size-2 rounded-full bg-muted transition-colors data-[active=true]:bg-primary"
                           data-active={
                              methods.state.current.data.id === step.id
                           }
                           key={step.id}
                           aria-label={`Etapa ${index + 1}`}
                        />
                     ))}
                  </div>

                  <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
                     <div
                        hidden={methods.state.current.data.id !== "basic-info"}
                     >
                        <BasicInfoStep />
                     </div>
                     <div hidden={methods.state.current.data.id !== "password"}>
                        <PasswordStep />
                     </div>

                     {methods.state.isLast ? (
                        <form.Subscribe
                           selector={(state) => state.isSubmitting}
                        >
                           {(isSubmitting) => (
                              <div className="flex flex-col gap-2">
                                 <Button
                                    className="h-10"
                                    disabled={isSubmitting}
                                    type="submit"
                                 >
                                    {isSubmitting ? <Spinner /> : "Criar conta"}
                                 </Button>
                                 <Button
                                    className="h-10"
                                    onClick={() => methods.navigation.prev()}
                                    type="button"
                                    variant="ghost"
                                 >
                                    Voltar
                                 </Button>
                              </div>
                           )}
                        </form.Subscribe>
                     ) : (
                        <form.Subscribe
                           selector={(state) => ({
                              emailValid: state.fieldMeta.email?.isValid,
                              nameValid: state.fieldMeta.name?.isValid,
                           })}
                        >
                           {({ nameValid, emailValid }) => (
                              <Button
                                 className="h-10"
                                 disabled={!nameValid || !emailValid}
                                 onClick={() => methods.navigation.next()}
                                 type="button"
                              >
                                 Continuar
                              </Button>
                           )}
                        </form.Subscribe>
                     )}
                  </form>

                  <div className="flex flex-col gap-4 text-center text-sm">
                     <div className="flex items-center justify-center gap-1">
                        <span className="text-muted-foreground">
                           Já tem uma conta?
                        </span>
                        <Link
                           className="font-medium text-foreground hover:underline"
                           search={{ redirect: redirectTo }}
                           to="/auth/sign-in"
                        >
                           Entrar
                        </Link>
                     </div>
                     <TermsAndPrivacyText />
                  </div>
               </div>
            )}
         </Stepper.Provider>
      </SignUpFormContext.Provider>
   );
}
