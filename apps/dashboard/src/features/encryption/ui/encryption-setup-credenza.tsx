/**
 * Encryption Setup Credenza
 *
 * Multi-step wizard for setting up E2E encryption.
 */

import {
   Alert,
   AlertDescription,
   AlertTitle,
} from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { useForm } from "@tanstack/react-form";
import {
   AlertTriangle,
   CheckCircle2,
   Loader2,
   Lock,
   Shield,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useCredenza } from "@/hooks/use-credenza";

type Step = "intro" | "passphrase" | "confirm" | "success";

interface EncryptionSetupCredenzaProps {
   enableE2E: (passphrase: string) => Promise<boolean>;
}

export function EncryptionSetupCredenza({
   enableE2E,
}: EncryptionSetupCredenzaProps) {
   const { closeCredenza } = useCredenza();
   const [step, setStep] = useState<Step>("intro");
   const [isSubmitting, setIsSubmitting] = useState(false);

   const schema = z
      .object({
         passphrase: z
            .string()
            .min(
               8,
               "A frase secreta deve ter pelo menos 8 caracteres",
            ),
         confirmPassphrase: z.string(),
      })
      .refine((data) => data.passphrase === data.confirmPassphrase, {
         message: "As frases secretas não coincidem",
         path: ["confirmPassphrase"],
      });

   const form = useForm({
      defaultValues: {
         passphrase: "",
         confirmPassphrase: "",
      },
      validators: {
         onBlur: schema,
      },
      onSubmit: async ({ value }) => {
         setIsSubmitting(true);
         try {
            const success = await enableE2E(value.passphrase);
            if (success) {
               setStep("success");
            } else {
               toast.error(
                  "Falha ao configurar criptografia",
               );
            }
         } catch (_error) {
            toast.error(
               "Falha ao configurar criptografia",
            );
         } finally {
            setIsSubmitting(false);
         }
      },
   });

   const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
   };

   const handleContinueToConfirm = async () => {
      await form.validate("change");
      if (form.state.canSubmit) {
         setStep("confirm");
      }
   };

   if (step === "intro") {
      return (
         <>
            <CredenzaHeader>
               <CredenzaTitle className="flex items-center gap-2">
                  <Shield className="size-5" />
                  Configurar Criptografia E2E
               </CredenzaTitle>
               <CredenzaDescription>
                  Proteja seus dados financeiros com criptografia de ponta a ponta.
               </CredenzaDescription>
            </CredenzaHeader>

            <CredenzaBody className="space-y-4">
               <Alert>
                  <Lock className="size-4" />
                  <AlertTitle>
                     Como funciona
                  </AlertTitle>
                  <AlertDescription className="space-y-2">
                     <p>
                        Sua frase secreta será usada para criptografar seus dados no navegador antes de enviar ao servidor. O servidor nunca verá seus dados descriptografados.
                     </p>
                  </AlertDescription>
               </Alert>

               <Alert>
                  <AlertTriangle className="size-4" />
                  <AlertTitle>
                     Importante
                  </AlertTitle>
                  <AlertDescription>
                     <ul className="list-disc pl-4 space-y-1 mt-2">
                        <li>
                           Não podemos recuperar dados se você esquecer sua frase secreta
                        </li>
                        <li>
                           A pesquisa no servidor não funcionará para dados criptografados
                        </li>
                        <li>
                           Automações não poderão ler dados criptografados
                        </li>
                     </ul>
                  </AlertDescription>
               </Alert>
            </CredenzaBody>

            <CredenzaFooter>
               <Button onClick={() => closeCredenza()} variant="outline">
                  Cancelar
               </Button>
               <Button onClick={() => setStep("passphrase")}>
                  Continuar
               </Button>
            </CredenzaFooter>
         </>
      );
   }

   if (step === "passphrase") {
      return (
         <>
            <CredenzaHeader>
               <CredenzaTitle>
                  Criar Frase Secreta
               </CredenzaTitle>
               <CredenzaDescription>
                  Escolha uma frase secreta forte que você vai lembrar.
               </CredenzaDescription>
            </CredenzaHeader>

            <CredenzaBody>
               <form className="space-y-4" onSubmit={handleSubmit}>
                  <form.Field name="passphrase">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <FieldGroup>
                              <Field data-invalid={isInvalid}>
                                 <FieldLabel htmlFor={field.name}>
                                    Frase secreta
                                 </FieldLabel>
                                 <Input
                                    aria-invalid={isInvalid}
                                    autoComplete="new-password"
                                    id={field.name}
                                    name={field.name}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                       field.handleChange(e.target.value)
                                    }
                                    placeholder="Digite sua frase secreta"
                                    type="password"
                                    value={field.state.value}
                                 />
                                 <FieldDescription>
                                    Mínimo de 8 caracteres. Use uma frase fácil de lembrar.
                                 </FieldDescription>
                                 {isInvalid && (
                                    <FieldError
                                       errors={field.state.meta.errors}
                                    />
                                 )}
                              </Field>
                           </FieldGroup>
                        );
                     }}
                  </form.Field>

                  <form.Field name="confirmPassphrase">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <FieldGroup>
                              <Field data-invalid={isInvalid}>
                                 <FieldLabel htmlFor={field.name}>
                                    Confirmar frase secreta
                                 </FieldLabel>
                                 <Input
                                    aria-invalid={isInvalid}
                                    autoComplete="new-password"
                                    id={field.name}
                                    name={field.name}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                       field.handleChange(e.target.value)
                                    }
                                    placeholder="Digite novamente sua frase secreta"
                                    type="password"
                                    value={field.state.value}
                                 />
                                 {isInvalid && (
                                    <FieldError
                                       errors={field.state.meta.errors}
                                    />
                                 )}
                              </Field>
                           </FieldGroup>
                        );
                     }}
                  </form.Field>
               </form>
            </CredenzaBody>

            <CredenzaFooter>
               <Button onClick={() => setStep("intro")} variant="outline">
                  Voltar
               </Button>
               <form.Subscribe>
                  {(formState) => (
                     <Button
                        disabled={
                           formState.isSubmitting || formState.isValidating
                        }
                        onClick={handleContinueToConfirm}
                     >
                        Continuar
                     </Button>
                  )}
               </form.Subscribe>
            </CredenzaFooter>
         </>
      );
   }

   if (step === "confirm") {
      return (
         <>
            <CredenzaHeader>
               <CredenzaTitle>
                  Confirmar Configuração
               </CredenzaTitle>
               <CredenzaDescription>
                  Revise antes de ativar a criptografia.
               </CredenzaDescription>
            </CredenzaHeader>

            <CredenzaBody>
               <Alert variant="destructive">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>
                     Última chance
                  </AlertTitle>
                  <AlertDescription>
                     Depois de ativar, você precisará da frase secreta para acessar seus dados. Não há como recuperar se esquecê-la.
                  </AlertDescription>
               </Alert>
            </CredenzaBody>

            <CredenzaFooter>
               <Button onClick={() => setStep("passphrase")} variant="outline">
                  Voltar
               </Button>
               <Button
                  disabled={isSubmitting}
                  onClick={() => form.handleSubmit()}
               >
                  {isSubmitting && (
                     <Loader2 className="size-4 mr-2 animate-spin" />
                  )}
                  Ativar Criptografia E2E
               </Button>
            </CredenzaFooter>
         </>
      );
   }

   if (step === "success") {
      return (
         <>
            <CredenzaHeader>
               <CredenzaTitle className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-green-500" />
                  Criptografia Ativada!
               </CredenzaTitle>
               <CredenzaDescription>
                  Seus dados agora estão protegidos com criptografia de ponta a ponta.
               </CredenzaDescription>
            </CredenzaHeader>

            <CredenzaBody>
               <Alert>
                  <Shield className="size-4" />
                  <AlertTitle>
                     Próximos passos
                  </AlertTitle>
                  <AlertDescription>
                     <ul className="list-disc pl-4 space-y-1 mt-2">
                        <li>
                           Anote sua frase secreta em um local seguro
                        </li>
                        <li>
                           Você precisará dela para desbloquear seus dados em novos dispositivos
                        </li>
                     </ul>
                  </AlertDescription>
               </Alert>
            </CredenzaBody>

            <CredenzaFooter>
               <Button onClick={() => closeCredenza()}>
                  Concluir
               </Button>
            </CredenzaFooter>
         </>
      );
   }

   return null;
}
