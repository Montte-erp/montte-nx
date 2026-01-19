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
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";
import z from "zod";
import { betterAuthClient } from "@/integrations/clients";

const steps = [
   { id: "enter-email", title: "enter-email" },
   { id: "enter-otp", title: "enter-otp" },
   { id: "enter-password", title: "enter-password" },
] as const;

const { Stepper } = defineStepper(...steps);

export function ForgotPasswordPage() {
   const router = useRouter();
   const schema = z
      .object({
         confirmPassword: z.string(),
         email: z.email("Insira um endereço de email válido."),
         otp: z.string().min(6, "O campo deve ter no mínimo 6 caracteres."),
         password: z
            .string()
            .min(8, "O campo deve ter no mínimo 8 caracteres."),
      })
      .refine((data) => data.password === data.confirmPassword, {
         message: "As senhas não coincidem.",
         path: ["confirmPassword"],
      });

   const handleSendOtp = useCallback(async (email: string) => {
      await betterAuthClient.emailOtp.sendVerificationOtp(
         {
            email,
            type: "forget-password",
         },
         {
            onError: ({ error }) => {
               toast.error(error.message);
            },
            onRequest: () => {
               toast.loading("Enviando código...");
            },
            onSuccess: () => {
               toast.success("Código enviado para seu email!");
            },
         },
      );
   }, []);

   const handleResetPassword = useCallback(
      async (email: string, otp: string, password: string) => {
         await betterAuthClient.emailOtp.resetPassword(
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
                  toast.loading("Redefinindo senha...");
               },
               onSuccess: () => {
                  toast.success("Senha redefinida com sucesso!");
                  router.navigate({
                     to: "/auth/sign-in",
                  });
               },
            },
         );
      },
      [router.navigate],
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
         onBlur: schema,
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

   function EmailStep() {
      return (
         <FieldGroup>
            <form.Field name="email">
               {(field) => {
                  const isInvalid =
                     field.state.meta.isTouched && !field.state.meta.isValid;
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
                           placeholder="Digite seu email"
                           type="email"
                           value={field.state.value}
                        />
                        {isInvalid && (
                           <FieldError errors={field.state.meta.errors} />
                        )}
                     </Field>
                  );
               }}
            </form.Field>
         </FieldGroup>
      );
   }

   function OtpStep() {
      return (
         <FieldGroup>
            <form.Field name="otp">
               {(field) => {
                  const isInvalid =
                     field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                     <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                           Código de verificação
                        </FieldLabel>
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
            </form.Field>
         </FieldGroup>
      );
   }

   function PasswordStep() {
      return (
         <>
            <FieldGroup>
               <form.Field name="password">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Senha</FieldLabel>
                           <PasswordInput
                              aria-invalid={isInvalid}
                              autoComplete="new-password"
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Digite sua nova senha"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>
            <FieldGroup>
               <form.Field name="confirmPassword">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
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
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Confirme sua nova senha"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>
         </>
      );
   }
   return (
      <Stepper.Provider>
         {({ methods }) => (
            <section className="space-y-6 w-full">
               {/* Back Link */}
               <Button asChild className="gap-2 px-0" variant="link">
                  <Link to="/auth/sign-in">
                     <ArrowLeft className="size-4" />
                     Voltar para login
                  </Link>
               </Button>

               {/* Header */}
               <div className="text-center space-y-2">
                  <h1 className="text-3xl font-semibold font-serif">
                     Esqueceu a senha?
                  </h1>
                  <p className="text-muted-foreground text-sm">
                     {methods.current.id === "enter-email"
                        ? "Digite seu email para receber um código de verificação"
                        : methods.current.id === "enter-otp"
                          ? "Digite o código de verificação enviado para seu email"
                          : "Digite sua nova senha"}
                  </p>
               </div>

               <div className="space-y-6">
                  <Stepper.Navigation className="w-full">
                     {steps.map((step) => (
                        <Stepper.Step key={step.id} of={step.id} />
                     ))}
                  </Stepper.Navigation>
                  <form className="space-y-4" onSubmit={handleSubmit}>
                     {methods.switch({
                        "enter-email": () => <EmailStep />,
                        "enter-otp": () => <OtpStep />,
                        "enter-password": () => <PasswordStep />,
                     })}
                     <Stepper.Controls className="flex w-full justify-between">
                        <Button
                           disabled={methods.isFirst}
                           onClick={methods.prev}
                           type="button"
                           variant="outline"
                        >
                           Anterior
                        </Button>
                        {methods.isLast ? (
                           <form.Subscribe>
                              {(formState) => (
                                 <Button
                                    className="flex gap-2 items-center justify-center"
                                    disabled={
                                       !formState.canSubmit ||
                                       formState.isSubmitting
                                    }
                                    type="submit"
                                    variant="default"
                                 >
                                    Redefinir senha
                                 </Button>
                              )}
                           </form.Subscribe>
                        ) : methods.current.id === "enter-email" ? (
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
                                       await handleSendOtp(emailValue);
                                       methods.next();
                                    }}
                                    type="button"
                                 >
                                    Próximo
                                 </Button>
                              )}
                           </form.Subscribe>
                        ) : (
                           <Button onClick={methods.next} type="button">
                              Próximo
                           </Button>
                        )}
                     </Stepper.Controls>
                  </form>
               </div>

               <div className="text-sm text-center">
                  <div className="flex gap-1 justify-center items-center">
                     <span>Lembrou a senha?</span>
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
   );
}
