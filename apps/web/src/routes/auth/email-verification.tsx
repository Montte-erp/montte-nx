import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import {
   InputOTP,
   InputOTPGroup,
   InputOTPSlot,
} from "@packages/ui/components/input-otp";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { type FormEvent, useCallback } from "react";
import { toast } from "sonner";
import z from "zod";
import { authClient } from "@/integrations/better-auth/auth-client";

const searchParams = z.object({
   email: z.email(),
   redirect: z.string().startsWith("/").optional().catch(undefined),
});

export const Route = createFileRoute("/auth/email-verification")({
   head: () => ({ meta: [{ title: "Verificar email — Montte" }] }),
   component: EmailVerificationPage,
   validateSearch: searchParams,
});

const emailVerificationSchema = z.object({
   otp: z.string().min(6, "O campo deve ter no minimo 6 caracteres.").max(6),
});

function EmailVerificationPage() {
   const { email, redirect: redirectTo } = Route.useSearch();
   const router = useRouter();

   const handleResendEmail = useCallback(async () => {
      await authClient.emailOtp.sendVerificationOtp(
         { email, type: "email-verification" },
         {
            onError: ({ error }) => {
               toast.error(error.message);
            },
            onRequest: () => {
               toast.loading("Processando...");
            },
            onSuccess: () => {
               toast.success("Email reenviado!");
            },
         },
      );
   }, [email]);

   const handleVerifyEmail = useCallback(
      async (otp: string) => {
         await authClient.emailOtp.verifyEmail(
            { email, otp },
            {
               onError: ({ error }) => {
                  toast.error(error.message);
               },
               onRequest: () => {
                  toast.loading("Verificando...");
               },
               onSuccess: () => {
                  toast.success("Email verificado!");
                  router.navigate({ to: redirectTo ?? "/auth/callback" });
               },
            },
         );
      },
      [email, redirectTo, router],
   );

   const form = useForm({
      defaultValues: {
         otp: "",
      },
      onSubmit: async ({ value, formApi }) => {
         await handleVerifyEmail(value.otp);
         formApi.reset();
      },
      validators: {
         onBlur: emailVerificationSchema,
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
               Verificar email
            </h1>
            <p className="max-w-xs text-center text-muted-foreground text-sm">
               Digite o código que enviamos para {email}.
            </p>
         </div>

         <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <FieldGroup>
               <form.Field
                  name="otp"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field
                           className="items-center"
                           data-invalid={isInvalid}
                        >
                           <FieldLabel className="sr-only">
                              Código OTP
                           </FieldLabel>
                           <InputOTP
                              aria-invalid={isInvalid}
                              autoComplete="one-time-code"
                              className="gap-2"
                              maxLength={6}
                              onBlur={field.handleBlur}
                              onChange={field.handleChange}
                              value={field.state.value}
                           >
                              <div className="flex w-full items-center justify-center gap-2">
                                 <InputOTPGroup>
                                    <InputOTPSlot index={0} />
                                    <InputOTPSlot index={1} />
                                    <InputOTPSlot index={2} />
                                 </InputOTPGroup>
                                 <InputOTPGroup>
                                    <InputOTPSlot index={3} />
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
                     {isSubmitting ? <Spinner /> : "Verificar"}
                  </Button>
               )}
            </form.Subscribe>
         </form>

         <Button className="h-10" onClick={handleResendEmail} variant="ghost">
            Reenviar código
         </Button>
      </div>
   );
}
