import {
   CONTENT_MODELS,
   type ContentModelId,
} from "@packages/agents/models";
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
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Globe, Loader2 } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/products/ai-agents",
)({
   component: ProductsAiAgentsPage,
});

// ============================================
// Default Language Section
// ============================================

function DefaultLanguageSection({
   current,
}: {
   current: "pt-BR" | "en-US" | "es" | undefined;
}) {
   const [language, setLanguage] = useState<"pt-BR" | "en-US" | "es" | "">(
      current ?? "",
   );
   const queryClient = useQueryClient();

   const saveMutation = useMutation(
      orpc.productSettings.updateAiDefaults.mutationOptions({
         onSuccess: () => {
            toast.success("Idioma atualizado!");
            queryClient.invalidateQueries({
               queryKey: orpc.productSettings.getSettings.queryOptions({
                  input: {},
               }).queryKey,
            });
         },
         onError: () => {
            toast.error("Erro ao atualizar idioma");
         },
      }),
   );

   const hasChanged = language !== current;

   const getLanguageLabel = (lang: "pt-BR" | "en-US" | "es") => {
      switch (lang) {
         case "pt-BR":
            return "🇧🇷 Português (Brasil)";
         case "en-US":
            return "🇺🇸 English (US)";
         case "es":
            return "🇪🇸 Español";
      }
   };

   return (
      <section className="space-y-3">
         <div className="flex items-start gap-3">
            <div className="rounded-lg p-2 bg-muted">
               <Globe className="size-5" />
            </div>
            <div className="flex-1">
               <h2 className="text-lg font-medium">Idioma padrão</h2>
               <p className="text-sm text-muted-foreground">
                  Idioma usado pelo assistente IA para responder e gerar relatórios.
               </p>
            </div>
         </div>
         <Select
            onValueChange={(value) =>
               setLanguage(value as "pt-BR" | "en-US" | "es")
            }
            value={language}
         >
            <SelectTrigger>
               <SelectValue placeholder="Selecione o idioma" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="pt-BR">
                  {getLanguageLabel("pt-BR")}
               </SelectItem>
               <SelectItem value="en-US">
                  {getLanguageLabel("en-US")}
               </SelectItem>
               <SelectItem value="es">{getLanguageLabel("es")}</SelectItem>
            </SelectContent>
         </Select>
         <Button
            disabled={!hasChanged || saveMutation.isPending}
            onClick={() =>
               saveMutation.mutate({ defaultLanguage: language || undefined })
            }
            size="sm"
         >
            {saveMutation.isPending && (
               <Loader2 className="size-4 mr-2 animate-spin" />
            )}
            Salvar
         </Button>
      </section>
   );
}

// ============================================
// Assistant Model Section
// ============================================

function AssistantModelSection({
   currentContentModel,
}: {
   currentContentModel: string | undefined;
}) {
   const [contentModel, setContentModel] = useState<string>(
      currentContentModel ?? "",
   );
   const queryClient = useQueryClient();

   const saveMutation = useMutation(
      orpc.productSettings.updateAiDefaults.mutationOptions({
         onSuccess: () => {
            toast.success("Modelo atualizado!");
            queryClient.invalidateQueries({
               queryKey: orpc.productSettings.getSettings.queryOptions({
                  input: {},
               }).queryKey,
            });
         },
         onError: () => {
            toast.error("Erro ao atualizar modelo");
         },
      }),
   );

   const hasChanged = (contentModel || undefined) !== currentContentModel;

   const modelDescription =
      contentModel && contentModel in CONTENT_MODELS
         ? CONTENT_MODELS[contentModel as ContentModelId].description
         : "Selecione o modelo que o assistente usará para análises e consultas.";

   return (
      <section className="space-y-3">
         <div className="flex items-start gap-3">
            <div className="rounded-lg p-2 bg-muted">
               <Cpu className="size-5" />
            </div>
            <div className="flex-1">
               <h2 className="text-lg font-medium">Modelo do assistente</h2>
               <p className="text-sm text-muted-foreground">
                  Modelo de IA usado pelo assistente para análises financeiras,
                  consultas de estoque e relatórios do seu ERP.
               </p>
            </div>
         </div>
         <div className="space-y-2">
            <Label>Modelo</Label>
            <Select
               onValueChange={(value) => setContentModel(value)}
               value={contentModel}
            >
               <SelectTrigger>
                  <SelectValue placeholder="Selecione o modelo" />
               </SelectTrigger>
               <SelectContent>
                  {Object.entries(CONTENT_MODELS).map(([modelId, model]) => (
                     <SelectItem key={modelId} value={modelId}>
                        {model.label}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{modelDescription}</p>
         </div>
         <Button
            disabled={!hasChanged || saveMutation.isPending}
            onClick={() =>
               saveMutation.mutate({
                  contentModel:
                     contentModel && contentModel in CONTENT_MODELS
                        ? (contentModel as ContentModelId)
                        : undefined,
               })
            }
            size="sm"
         >
            {saveMutation.isPending && (
               <Loader2 className="size-4 mr-2 animate-spin" />
            )}
            Salvar
         </Button>
      </section>
   );
}

// ============================================
// Skeleton
// ============================================

function AiAgentsSkeleton() {
   return (
      <div className="space-y-8">
         <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-80 mt-1" />
         </div>
         <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-20" />
         </div>
      </div>
   );
}

// ============================================
// Error Fallback
// ============================================

function AiAgentsErrorFallback({ resetErrorBoundary }: FallbackProps) {
   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Assistente IA</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Configure o assistente IA do seu espaço de trabalho.
            </p>
         </div>
         <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
               Não foi possível carregar as configurações do assistente IA
            </p>
            <Button onClick={resetErrorBoundary} variant="outline">
               Tentar novamente
            </Button>
         </div>
      </div>
   );
}

// ============================================
// Main Content
// ============================================

function AiAgentsContent() {
   const { data: settings } = useSuspenseQuery(
      orpc.productSettings.getSettings.queryOptions({ input: {} }),
   );

   return (
      <div className="space-y-8">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Assistente IA</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Configure o assistente IA para análises financeiras, consultas de
               estoque e relatórios do seu ERP.
            </p>
         </div>

         <DefaultLanguageSection
            current={settings?.aiDefaults?.defaultLanguage}
         />

         <Separator />

         <AssistantModelSection
            currentContentModel={settings?.aiDefaults?.contentModel}
         />
      </div>
   );
}

// ============================================
// Page
// ============================================

function ProductsAiAgentsPage() {
   return (
      <ErrorBoundary FallbackComponent={AiAgentsErrorFallback}>
         <Suspense fallback={<AiAgentsSkeleton />}>
            <AiAgentsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
