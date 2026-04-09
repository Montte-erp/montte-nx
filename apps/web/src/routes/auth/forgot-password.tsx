import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   InputOTP,
   InputOTPGroup,
   InputOTPSeparator,
   InputOTPSlot,
} from "@packages/ui/components/input-otp";
import { PasswordInput } from "@packages/ui/components/password-input";
import { defineStepper } from "@packages/ui/components/stepper";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";

const steps = [
   { id: "enter-email", title: "enter-email" },
   { id: "enter-otp", title: "enter-otp" },
   { id: "enter-password", title: "enter-password" },
] as const;

const { Stepper } = defineStepper(...steps);

const forgotPasswordSchema = z
   .object({
      confirmPassword: z.string(),
      email: z.email("Insira um endereco de email valido."),
      otp: z.string().min(6, "O campo deve ter no minimo 6 caracteres."),
      password: z.string().min(8, "O campo deve ter no minimo 8 caracteres."),
   })
   .refine((data) => data.password === data.confirmPassword, {
      message: "As senhas nao coincidem.",
      path: ["confirmPassword"],
   });

export const Route = createFileRoute("/auth/forgot-password")({
   component: ForgotPasswordPage,
});

function createForgotPasswordForm() {
   return useForm({
      defaultValues: {
         confirmPassword: "",
         email: "",
         otp: "",
         password: "",
      },
      validators: { onBlur: forgotPasswordSchema },
   });
}
type ForgotPasswordFormApi = ReturnType<typeof createForgotPasswordForm>;

const ForgotPasswordFormContext = createContext<ForgotPasswordFormApi | null>(
   null,
);

function useForgotPasswordForm() {
   const form = useContext(ForgotPasswordFormContext);
   if (!form) throw new Error("useForgotPasswordForm used outside provider");
   return form;
}

function EmailStep() {
   const form = useForgotPasswordForm();
   return (
      <FieldGroup>
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
                        placeholder="seu@email.com"
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

function OtpStep() {
   const form = useForgotPasswordForm();
   return (
      <FieldGroup>
         <form.Field
            name="otp"
            children={(field) => {
               const isInvalid =
                  field.state.meta.isTouched &&
                  field.state.meta.errors.length > 0;
               return (
                  <Field data-invalid={isInvalid}>
                     <FieldLabel htmlFor={field.name}>Codigo OTP</FieldLabel>
                     <InputOTP
                        aria-invalid={isInvalid}
                        autoComplete="one-time-code"
                        id={field.name}
                        maxLength={6}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={field.handleChange}
                        value={field.state.value}
                     >
                        <div className="w-full flex justify-center items-center gap-2">
                           <InputOTPGroup>
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                           </InputOTPGroup>
                           <InputOTPSeparator />
                           <InputOTPGroup>
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                           </InputOTPGroup>
                           <InputOTPSeparator />
                           <InputOTPGroup>
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                           </InputOTPGroup>
                        </div>
                     </InputOTP>
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
   const form = useForgotPasswordForm();
   return (
      <>
         <FieldGroup>
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
                           placeholder="Minimo 8 caracteres"
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
         <FieldGroup>
            <form.Field
               name="confirmPassword"
               children={(field) => {
                  const isInvalid =
                     field.state.meta.isTouched &&
                     field.state.meta.errors.length > 0;
                  return (
                     <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                           Confirmar Senha
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
         </FieldGroup>
      </>
   );
}

function ForgotPasswordPage() {
   const router = useRouter();

   const handleSendOtp = useCallback(async (email: string) => {
      let success = false;
      await authClient.emailOtp.sendVerificationOtp(
         { email, type: "forget-password" },
         {
            onError: ({ error }) => {
               toast.error(error.message);
            },
            onRequest: () => {
               toast.loading("Processando...");
            },
            onSuccess: () => {
               toast.success("Codigo enviado!");
               success = true;
            },
         },
      );
      return success;
   }, []);

   const handleResetPassword = useCallback(
      async (email: string, otp: string, password: string) => {
         await authClient.emailOtp.resetPassword(
            {
               email,
               otp,
               password,
            },
            {
               onError: ({ error }) => {
                  toast.error(error.message);
               },
               onRequest: () => {
                  toast.loading("Redefinindo...");
               },
               onSuccess: () => {
                  toast.success("Senha redefinida!");
                  router.navigate({
                     to: "/auth/sign-in",
                  });
               },
            },
         );
      },
      [router],
   );

   const form = useForm({
      defaultValues: {
         confirmPassword: "",
         email: "",
         otp: "",
         password: "",
      },
      onSubmit: async ({ value }) => {
         await handleResetPassword(value.email, value.otp, value.password);
      },
      validators: {
         onBlur: forgotPasswordSchema,
      },
   });

   const handleSubmit = useCallback(
      (e: React.FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         form.handleSubmit();
      },
      [form],
   );

   return (
      <ForgotPasswordFormContext.Provider value={form}>
         <Stepper.Provider>
            {({ methods }) => (
               <section className="flex flex-col gap-4 w-full">
                  <Button asChild className="gap-2 px-0" variant="link">
                     <Link to="/auth/sign-in">
                        <ArrowLeft className="size-4" />
                        Voltar para login
                     </Link>
                  </Button>

                  <div className="text-center flex flex-col gap-2">
                     <h1 className="text-3xl font-semibold font-serif">
                        Esqueci Minha Senha
                     </h1>
                     <p className="text-muted-foreground text-sm">
                        {methods.state.current.data.id === "enter-email"
                           ? "Digite seu e-mail para receber o codigo de recuperacao"
                           : methods.state.current.data.id === "enter-otp"
                             ? "Digite o codigo enviado para seu e-mail"
                             : "Digite sua nova senha"}
                     </p>
                  </div>

                  <div className="flex flex-col gap-4">
                     <Stepper.Navigation className="w-full">
                        {steps.map((step) => (
                           <Stepper.Step key={step.id} of={step.id} />
                        ))}
                     </Stepper.Navigation>
                     <form
                        className="flex flex-col gap-4"
                        onSubmit={handleSubmit}
                     >
                        {methods.flow.switch({
                           "enter-email": () => <EmailStep />,
                           "enter-otp": () => <OtpStep />,
                           "enter-password": () => <PasswordStep />,
                        })}
                        <Stepper.Controls className="flex w-full justify-between">
                           <Button
                              disabled={methods.state.isFirst}
                              onClick={() => methods.navigation.prev()}
                              type="button"
                              variant="outline"
                           >
                              Voltar
                           </Button>
                           {methods.state.isLast ? (
                              <form.Subscribe
                                 selector={(state) =>
                                    [
                                       state.canSubmit,
                                       state.isSubmitting,
                                    ] as const
                                 }
                              >
                                 {([canSubmit, isSubmitting]) => (
                                    <Button
                                       className="flex gap-2 items-center justify-center"
                                       disabled={!canSubmit || isSubmitting}
                                       type="submit"
                                       variant="default"
                                    >
                                       Redefinir senha
                                    </Button>
                                 )}
                              </form.Subscribe>
                           ) : methods.flow.is("enter-email") ? (
                              <form.Subscribe
                                 selector={(state) => ({
                                    emailValid: state.fieldMeta.email?.isValid,
                                    emailValue: state.values.email,
                                 })}
                              >
                                 {({ emailValid, emailValue }) => (
                                    <Button
                                       disabled={!emailValid}
                                       onClick={async () => {
                                          const sent =
                                             await handleSendOtp(emailValue);
                                          if (sent) methods.navigation.next();
                                       }}
                                       type="button"
                                    >
                                       Proximo
                                    </Button>
                                 )}
                              </form.Subscribe>
                           ) : methods.flow.is("enter-otp") ? (
                              <form.Subscribe
                                 selector={(state) =>
                                    state.fieldMeta.otp?.isValid
                                 }
                              >
                                 {(otpValid) => (
                                    <Button
                                       disabled={!otpValid}
                                       onClick={() => methods.navigation.next()}
                                       type="button"
                                    >
                                       Proximo
                                    </Button>
                                 )}
                              </form.Subscribe>
                           ) : (
                              <Button
                                 onClick={() => methods.navigation.next()}
                                 type="button"
                              >
                                 Proximo
                              </Button>
                           )}
                        </Stepper.Controls>
                     </form>
                  </div>

                  <div className="text-sm text-center">
                     <div className="flex gap-1 justify-center items-center">
                        <span>Lembrou sua senha?</span>
                        <Link
                           className="text-primary hover:underline"
                           to="/auth/sign-in"
                        >
                           Entrar
                        </Link>
                     </div>
                  </div>
               </section>
            )}
         </Stepper.Provider>
      </ForgotPasswordFormContext.Provider>
   );
}
