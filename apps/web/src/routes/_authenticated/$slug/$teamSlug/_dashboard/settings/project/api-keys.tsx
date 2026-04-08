import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { Suspense, useState, useTransition } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { authClient } from "@/integrations/better-auth/auth-client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/api-keys",
)({
   component: ApiKeysPage,
});

const createKeySchema = z.object({
   name: z.string().min(1, "Nome obrigatório"),
});

function ApiKeysSkeleton() {
   return (
      <div className="flex flex-col gap-4">
         <div className="h-8 w-48 animate-pulse rounded bg-muted" />
         <div className="h-24 animate-pulse rounded bg-muted" />
      </div>
   );
}

function ApiKeysContent() {
   const { data: session } = authClient.useSession();
   const organizationId = session?.session.activeOrganizationId;
   const teamId = session?.session.activeTeamId;

   const { data: keysData, refetch } = useSuspenseQuery({
      queryKey: ["api-keys", teamId],
      queryFn: () => authClient.apiKey.list(),
   });

   const [createdKey, setCreatedKey] = useState<string | null>(null);
   const [isPending, startTransition] = useTransition();

   const form = useForm({
      defaultValues: { name: "" },
      validators: { onSubmit: createKeySchema },
      onSubmit: ({ value }) => {
         if (!organizationId || !teamId) return;
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
            form.reset();
            refetch();
            toast.success(
               "Chave criada — copie agora, não será exibida novamente",
            );
         });
      },
   });

   const keysResult = keysData?.data;
   const allKeys =
      keysResult && !Array.isArray(keysResult) ? keysResult.apiKeys : [];
   const teamKeys = allKeys.filter((k) => k.metadata?.teamId === teamId);

   function handleCopy(value: string) {
      navigator.clipboard.writeText(value);
      toast.success("Copiado para a área de transferência");
   }

   function handleRevoke(keyId: string) {
      startTransition(async () => {
         const result = await authClient.apiKey.delete({ keyId });
         if (result.error) {
            toast.error("Erro ao revogar chave");
            return;
         }
         refetch();
         toast.success("Chave revogada");
      });
   }

   return (
      <div className="flex flex-col gap-4">
         <div>
            <h2 className="text-lg font-semibold">Chaves de API — HyprPay</h2>
            <p className="text-sm text-muted-foreground">
               Use estas chaves para autenticar o SDK{" "}
               <code className="font-mono text-xs">@montte/hyprpay</code> neste
               espaço.
            </p>
         </div>

         {createdKey && (
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
         )}

         <form
            onSubmit={(e) => {
               e.preventDefault();
               form.handleSubmit();
            }}
            className="flex gap-2"
         >
            <form.Field
               name="name"
               children={(field) => {
                  const isInvalid =
                     field.state.meta.isTouched &&
                     field.state.meta.errors.length > 0;
                  return (
                     <div className="flex flex-1 flex-col gap-2">
                        <FieldLabel htmlFor={field.name} className="sr-only">
                           Nome da chave
                        </FieldLabel>
                        <Input
                           id={field.name}
                           name={field.name}
                           aria-invalid={isInvalid}
                           placeholder="Nome da chave (ex: Produção)"
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
               <Plus className="size-4" />
               Criar
            </Button>
         </form>

         {teamKeys.length === 0 ? (
            <Empty>
               <EmptyHeader>
                  <EmptyMedia variant="icon">
                     <KeyRound />
                  </EmptyMedia>
                  <EmptyTitle>Nenhuma chave de API</EmptyTitle>
                  <EmptyDescription>
                     Crie uma chave para integrar o SDK HyprPay.
                  </EmptyDescription>
               </EmptyHeader>
            </Empty>
         ) : (
            <div className="flex flex-col gap-2">
               {teamKeys.map((k) => (
                  <div
                     key={k.id}
                     className="flex items-center gap-2 rounded border p-4"
                  >
                     <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                     <span className="flex-1 text-sm font-medium">
                        {k.name}
                     </span>
                     <Badge variant="outline" className="text-xs">
                        {new Date(k.createdAt).toLocaleDateString("pt-BR")}
                     </Badge>
                     <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevoke(k.id)}
                        disabled={isPending}
                     >
                        <Trash2 className="size-4 text-destructive" />
                     </Button>
                  </div>
               ))}
            </div>
         )}
      </div>
   );
}

function ApiKeysPage() {
   return (
      <ErrorBoundary
         FallbackComponent={createErrorFallback({
            errorTitle: "Erro ao carregar chaves de API",
         })}
      >
         <Suspense fallback={<ApiKeysSkeleton />}>
            <ApiKeysContent />
         </Suspense>
      </ErrorBoundary>
   );
}
