import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Copy } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

const createKeySchema = z.object({
   name: z.string().min(1, "Nome obrigatório"),
});

interface CreateApiKeyFormProps {
   organizationId: string;
   teamId: string;
   onSuccess: () => void;
}

export function CreateApiKeyForm({
   organizationId,
   teamId,
   onSuccess,
}: CreateApiKeyFormProps) {
   const queryClient = useQueryClient();
   const [createdKey, setCreatedKey] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

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
            toast.success(
               "Chave criada — copie agora, não será exibida novamente",
            );
         });
      },
   });

   function handleCopy(value: string) {
      navigator.clipboard.writeText(value);
      toast.success("Copiado para a área de transferência");
   }

   if (createdKey) {
      return (
         <div className="flex flex-col gap-4">
            <p className="text-sm font-medium">
               Copie sua chave — ela não será exibida novamente:
            </p>
            <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 p-4">
               <code className="flex-1 break-all font-mono text-sm text-green-800">
                  {createdKey}
               </code>
               <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(createdKey)}
               >
                  <Copy className="size-4" />
               </Button>
            </div>
            <Button onClick={onSuccess}>Fechar</Button>
         </div>
      );
   }

   return (
      <form
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
                     <FieldLabel htmlFor={field.name}>Nome da chave</FieldLabel>
                     <Input
                        id={field.name}
                        name={field.name}
                        aria-invalid={isInvalid}
                        placeholder="Ex: Produção"
                        value={field.state.value}
                        onInput={(e) =>
                           field.handleChange(e.currentTarget.value)
                        }
                     />
                  </div>
               );
            }}
         />
         <Button type="submit" disabled={isPending}>
            Criar chave
         </Button>
      </form>
   );
}
