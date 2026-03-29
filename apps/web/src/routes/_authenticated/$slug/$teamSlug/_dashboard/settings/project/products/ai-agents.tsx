import { Button } from "@packages/ui/components/button";
import { Label } from "@packages/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Separator } from "@packages/ui/components/separator";
import { Skeleton } from "@packages/ui/components/skeleton";
import { Switch } from "@packages/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useStableHandler } from "foxact/use-stable-handler-only-when-you-know-what-you-are-doing-or-you-will-be-fired";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { toast } from "sonner";
import type { Inputs } from "@/integrations/orpc/client";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/ai-agents",
)({
   component: AiAgentsSettingsPage,
});

const MODELS = [
   {
      id: "openrouter/google/gemini-3-flash-preview",
      label: "Gemini 3 Flash",
      provider: "Google",
   },
   {
      id: "openrouter/moonshotai/kimi-k2.5",
      label: "Kimi K2.5",
      provider: "Moonshot AI",
   },
   {
      id: "openrouter/openai/gpt-oss-20b",
      label: "GPT-OSS-20B",
      provider: "OpenAI",
   },
   {
      id: "openrouter/liquid/lfm2-8b-a1b",
      label: "LFM2-8B-A1B",
      provider: "Liquid AI",
   },
] as const;

function AiAgentsSettingsForm() {
   const { data: settings } = useSuspenseQuery(
      orpc.agentSettings.getSettings.queryOptions({}),
   );

   const mutation = useMutation(
      orpc.agentSettings.upsertSettings.mutationOptions({
         onSuccess: () => toast.success("Configurações salvas."),
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: {
         modelId: settings?.modelId ?? "openrouter/moonshotai/kimi-k2.5",
         language: (settings?.language ??
            "pt-BR") as Inputs["agentSettings"]["upsertSettings"]["language"],
         tone: (settings?.tone ??
            "formal") as Inputs["agentSettings"]["upsertSettings"]["tone"],
         dataSourceTransactions: settings?.dataSourceTransactions ?? true,
         dataSourceContacts: settings?.dataSourceContacts ?? true,
         dataSourceInventory: settings?.dataSourceInventory ?? true,
         dataSourceServices: settings?.dataSourceServices ?? true,
      },
      onSubmit: ({ value }) => {
         mutation.mutate(value);
      },
   });

   const handleSubmit = useStableHandler((e: React.FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
   });

   return (
      <div className="flex flex-col gap-4 max-w-lg">
         <div className="flex flex-col gap-2">
            <h3 className="text-lg font-medium">Rubi IA</h3>
            <p className="text-sm text-muted-foreground">
               Configure o comportamento da assistente de inteligência
               artificial do seu espaço.
            </p>
         </div>

         <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <form.Field name="modelId">
               {(field) => (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor={field.name}>Modelo</Label>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) => field.handleChange(v)}
                     >
                        <SelectTrigger id={field.name}>
                           <SelectValue placeholder="Selecionar modelo…" />
                        </SelectTrigger>
                        <SelectContent>
                           {MODELS.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                 {m.label}
                                 <span className="text-muted-foreground ml-1">
                                    — {m.provider}
                                 </span>
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </div>
               )}
            </form.Field>

            <form.Field name="language">
               {(field) => (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor={field.name}>Idioma</Label>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                           field.handleChange(v as "pt-BR" | "en-US" | "es-ES")
                        }
                     >
                        <SelectTrigger id={field.name}>
                           <SelectValue placeholder="Selecionar idioma…" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="pt-BR">Português (BR)</SelectItem>
                           <SelectItem value="en-US">English (US)</SelectItem>
                           <SelectItem value="es-ES">Español</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               )}
            </form.Field>

            <form.Field name="tone">
               {(field) => (
                  <div className="flex flex-col gap-2">
                     <Label htmlFor={field.name}>Tom</Label>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                           field.handleChange(
                              v as "formal" | "casual" | "technical",
                           )
                        }
                     >
                        <SelectTrigger id={field.name}>
                           <SelectValue placeholder="Selecionar tom…" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="formal">Formal</SelectItem>
                           <SelectItem value="casual">Casual</SelectItem>
                           <SelectItem value="technical">Técnico</SelectItem>
                        </SelectContent>
                     </Select>
                  </div>
               )}
            </form.Field>

            <Separator />

            <div className="flex flex-col gap-2">
               <Label>Fontes de dados</Label>
               <p className="text-sm text-muted-foreground">
                  Escolha quais dados a Rubi pode acessar ao responder.
               </p>
            </div>

            <form.Field name="dataSourceTransactions">
               {(field) => (
                  <div className="flex items-center justify-between">
                     <Label htmlFor={field.name}>Transações financeiras</Label>
                     <Switch
                        id={field.name}
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                     />
                  </div>
               )}
            </form.Field>

            <form.Field name="dataSourceContacts">
               {(field) => (
                  <div className="flex items-center justify-between">
                     <Label htmlFor={field.name}>Contatos</Label>
                     <Switch
                        id={field.name}
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                     />
                  </div>
               )}
            </form.Field>

            <form.Field name="dataSourceInventory">
               {(field) => (
                  <div className="flex items-center justify-between">
                     <Label htmlFor={field.name}>Estoque</Label>
                     <Switch
                        id={field.name}
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                     />
                  </div>
               )}
            </form.Field>

            <form.Field name="dataSourceServices">
               {(field) => (
                  <div className="flex items-center justify-between">
                     <Label htmlFor={field.name}>Serviços</Label>
                     <Switch
                        id={field.name}
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                     />
                  </div>
               )}
            </form.Field>

            <form.Subscribe>
               {(formState) => (
                  <Button
                     type="submit"
                     disabled={!formState.canSubmit || mutation.isPending}
                     className="self-start"
                  >
                     {mutation.isPending && (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                     )}
                     Salvar configurações
                  </Button>
               )}
            </form.Subscribe>
         </form>
      </div>
   );
}

function AiAgentsSettingsPage() {
   return (
      <Suspense
         fallback={
            <div className="flex flex-col gap-4 max-w-lg">
               {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton className="h-10 w-full" key={`skel-${i + 1}`} />
               ))}
            </div>
         }
      >
         <AiAgentsSettingsForm />
      </Suspense>
   );
}
