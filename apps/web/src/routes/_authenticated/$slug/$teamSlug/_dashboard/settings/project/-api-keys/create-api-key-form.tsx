import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { Spinner } from "@packages/ui/components/spinner";
import { defineStepper } from "@packages/ui/components/stepper";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const createKeySchema = z.object({
   name: z.string().min(1, "Nome obrigatório"),
});

const { Stepper, useStepper } = defineStepper(
   { id: "form", title: "Nome" },
   { id: "reveal", title: "Chave" },
);

interface CreateApiKeyFormProps {
   organizationId: string;
   teamId: string;
   onSuccess: () => void;
}

export function CreateApiKeyForm(props: CreateApiKeyFormProps) {
   return (
      <Stepper.Provider variant="line">
         {({ methods }) => (
            <CreateApiKeyFormInner methods={methods} {...props} />
         )}
      </Stepper.Provider>
   );
}

type StepperMethods = ReturnType<typeof useStepper>;

function CreateApiKeyFormInner({
   organizationId,
   teamId,
   onSuccess,
   methods,
}: CreateApiKeyFormProps & { methods: StepperMethods }) {
   const queryClient = useQueryClient();
   const [isPending, startTransition] = useTransition();
   const [createdKey, setCreatedKey] = useState<string | null>(null);

   const form = useForm({
      defaultValues: { name: "" },
      validators: { onSubmit: createKeySchema },
      onSubmit: ({ value }) => {
         startTransition(async () => {
            const result = await authClient.apiKey.create({
               name: value.name,
               metadata: {
                  organizationId,
                  teamId,
                  plan: "metered",
                  sdkMode: "static",
                  apiKeyType: "private",
               },
            });
            if (result.error) {
               toast.error("Erro ao criar chave de API");
               return;
            }
            setCreatedKey(result.data?.key ?? null);
            await queryClient.invalidateQueries(
               orpc.apiKeys.list.queryOptions(),
            );
            methods.navigation.next();
         });
      },
   });

   function handleCopy(value: string) {
      navigator.clipboard.writeText(value);
      toast.success("Copiado para a área de transferência");
   }

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>Nova chave de API</CredenzaTitle>
            <CredenzaDescription>
               Use esta chave para autenticar o SDK{" "}
               <code className="font-mono text-xs">@montte/hyprpay</code> neste
               espaço.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="px-4">
            <Stepper.Navigation>
               <Stepper.Step of="form" />
               <Stepper.Step of="reveal" />
            </Stepper.Navigation>

            {methods.flow.switch({
               form: () => (
                  <form
                     id="create-api-key-form"
                     onSubmit={(e) => {
                        e.preventDefault();
                        form.handleSubmit();
                     }}
                     className="flex flex-col gap-4"
                  >
                     <form.Field
                        name="name"
                        children={(field) => {
                           const isInvalid =
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0;
                           return (
                              <div className="flex flex-col gap-2">
                                 <FieldLabel htmlFor={field.name}>
                                    Nome da chave
                                 </FieldLabel>
                                 <Input
                                    id={field.name}
                                    name={field.name}
                                    aria-invalid={isInvalid}
                                    placeholder="Ex: Produção"
                                    value={field.state.value}
                                    onInput={(e) =>
                                       field.handleChange(e.currentTarget.value)
                                    }
                                    onBlur={() => field.handleBlur()}
                                 />
                                 {isInvalid && (
                                    <span className="text-sm text-destructive">
                                       {String(field.state.meta.errors[0])}
                                    </span>
                                 )}
                              </div>
                           );
                        }}
                     />
                  </form>
               ),
               reveal: () => (
                  <div className="flex flex-col gap-4">
                     <div className="flex items-start gap-4 rounded-md bg-muted p-4">
                        <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="flex flex-col gap-2">
                           <p className="text-sm font-medium">
                              Copie sua chave agora
                           </p>
                           <p className="text-xs text-muted-foreground">
                              Esta chave não será exibida novamente após fechar.
                           </p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 rounded-md border px-4 py-2">
                        <code className="flex-1 break-all font-mono text-xs">
                           {createdKey}
                        </code>
                        <Button
                           size="sm"
                           variant="ghost"
                           aria-label="Copiar chave de API"
                           onClick={() => handleCopy(createdKey ?? "")}
                        >
                           <Copy className="size-4" />
                        </Button>
                     </div>
                  </div>
               ),
            })}
         </CredenzaBody>

         <CredenzaFooter>
            {methods.state.current.data.id === "form" ? (
               <Button
                  className="w-full"
                  disabled={isPending}
                  form="create-api-key-form"
                  type="submit"
               >
                  {isPending ? (
                     <Spinner className="size-4 mr-2" />
                  ) : (
                     <KeyRound className="size-4 mr-2" />
                  )}
                  Criar chave
               </Button>
            ) : (
               <Button className="w-full" onClick={onSuccess}>
                  Fechar
               </Button>
            )}
         </CredenzaFooter>
      </>
   );
}
