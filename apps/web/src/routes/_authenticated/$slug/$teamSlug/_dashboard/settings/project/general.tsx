import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import {
   Item,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { Skeleton } from "@packages/ui/components/skeleton";
import { TooltipProvider } from "@packages/ui/components/tooltip";
import {
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Globe, Hash, Loader2, Settings2, X } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/general",
)({
   component: ProjectGeneralPage,
});

// TODO: Add team.updateName procedure when Better Auth supports it

// ============================================
// Skeleton
// ============================================

function ProjectGeneralSkeleton() {
   return (
      <div className="space-y-6">
         <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <div className="space-y-1">
               <Skeleton className="h-16 w-full rounded-lg" />
               <Skeleton className="h-16 w-full rounded-lg" />
            </div>
         </div>

         <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-lg" />
         </div>

         <div className="space-y-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full rounded-lg" />
         </div>
      </div>
   );
}

// ============================================
// Error Fallback
// ============================================

function ProjectGeneralErrorFallback({
   error: _error,
   resetErrorBoundary,
}: FallbackProps) {
   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Geral</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Gerencie o nome, slug e configurações padrão do projeto.
            </p>
         </div>
         <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
               Não foi possível carregar as configurações do projeto
            </p>
            <Button onClick={resetErrorBoundary} variant="outline">
               Tentar novamente
            </Button>
         </div>
      </div>
   );
}

// ============================================
// Main Content Component
// ============================================

function ProjectGeneralContent() {
   const queryClient = useQueryClient();
   const { currentTeam } = Route.useRouteContext();
   const teamId = currentTeam.id;

   const { data: teamData } = useSuspenseQuery(
      orpc.team.get.queryOptions({ input: { teamId } }),
   );

   const [newDomain, setNewDomain] = useState("");

   // ── Mutations ──────────────────────────────────────────────────────

   const updateDomainsMutation = useMutation(
      orpc.team.updateAllowedDomains.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: orpc.team.get.queryOptions({ input: { teamId } })
                  .queryKey,
            });
         },
         onError: () => {
            toast.error("Não foi possível atualizar os domínios permitidos.");
         },
      }),
   );

   // ── Handlers ───────────────────────────────────────────────────────

   const handleAddDomain = () => {
      const domain = newDomain.trim().toLowerCase();
      if (!domain) return;

      const domainPattern =
         /^(\*\.)?([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
      if (!domainPattern.test(domain)) {
         toast.error(
            "Domínio inválido. Use formatos como exemplo.com ou *.exemplo.com",
         );
         return;
      }

      const currentDomains = teamData.allowedDomains ?? [];
      if (currentDomains.includes(domain)) {
         toast.error("Este domínio já está na lista.");
         return;
      }

      const updatedDomains = [...currentDomains, domain];
      setNewDomain("");
      updateDomainsMutation.mutate({
         teamId,
         allowedDomains: updatedDomains,
      });
   };

   const handleRemoveDomain = (domainToRemove: string) => {
      const currentDomains = teamData.allowedDomains ?? [];
      const updatedDomains = currentDomains.filter((d) => d !== domainToRemove);
      updateDomainsMutation.mutate({
         teamId,
         allowedDomains: updatedDomains,
      });
   };

   const handleDomainKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
         e.preventDefault();
         handleAddDomain();
      }
   };

   // ── Render ─────────────────────────────────────────────────────────

   const allowedDomains = teamData.allowedDomains ?? [];

   const formattedCreatedAt = teamData.createdAt
      ? new Date(teamData.createdAt).toLocaleDateString("pt-BR", {
           day: "numeric",
           month: "long",
           year: "numeric",
        })
      : "-";

   return (
      <TooltipProvider>
         <div className="space-y-6">
            <div>
               <h1 className="text-2xl font-semibold font-serif">Geral</h1>
               <p className="text-sm text-muted-foreground mt-1">
                  Gerencie o nome, slug e configurações padrão do projeto.
               </p>
            </div>

            {/* ── Project Settings ─────────────────────────────────── */}
            <section className="space-y-3">
               <div>
                  <h2 className="text-lg font-medium">
                     Configurações do Projeto
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                     Gerencie o nome, slug e configurações padrão do projeto
                  </p>
               </div>
               <ItemGroup>
                  {/* Project Name */}
                  <Item variant="muted">
                     <ItemMedia variant="icon">
                        <Settings2 className="size-4" />
                     </ItemMedia>
                     <ItemContent className="min-w-0">
                        <ItemTitle>Nome do Projeto</ItemTitle>
                        <ItemDescription className="truncate">
                           {teamData.name}
                        </ItemDescription>
                     </ItemContent>
                  </Item>

                  <ItemSeparator />

                  {/* Team ID */}
                  <Item variant="muted">
                     <ItemMedia variant="icon">
                        <Hash className="size-4" />
                     </ItemMedia>
                     <ItemContent className="min-w-0">
                        <ItemTitle>ID do Projeto</ItemTitle>
                        <ItemDescription className="truncate font-mono">
                           {teamId}
                        </ItemDescription>
                     </ItemContent>
                  </Item>
               </ItemGroup>
            </section>

            {/* ── Allowed Domains ──────────────────────────────────── */}
            <section className="space-y-3">
               <div>
                  <h2 className="text-lg font-medium">Domínios Permitidos</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                     Restrinja quais domínios têm acesso às integrações do
                     projeto. Deixe vazio para permitir todos os domínios.
                  </p>
               </div>

               {allowedDomains.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                     {allowedDomains.map((domain) => (
                        <Badge
                           className="gap-1 pr-1"
                           key={domain}
                           variant="secondary"
                        >
                           <Globe className="size-3" />
                           {domain}
                           <button
                              className="ml-1 rounded-sm hover:bg-muted-foreground/20 p-0.5"
                              disabled={updateDomainsMutation.isPending}
                              onClick={() => handleRemoveDomain(domain)}
                              type="button"
                           >
                              <X className="size-3" />
                           </button>
                        </Badge>
                     ))}
                  </div>
               ) : (
                  <p className="text-sm text-muted-foreground italic">
                     Todos os domínios são permitidos.
                  </p>
               )}

               <div className="flex gap-2">
                  <Input
                     disabled={updateDomainsMutation.isPending}
                     onChange={(e) => setNewDomain(e.target.value)}
                     onKeyDown={handleDomainKeyDown}
                     placeholder="exemplo.com ou *.exemplo.com"
                     value={newDomain}
                  />
                  <Button
                     disabled={
                        !newDomain.trim() || updateDomainsMutation.isPending
                     }
                     onClick={handleAddDomain}
                     size="sm"
                  >
                     {updateDomainsMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                     ) : (
                        "Adicionar"
                     )}
                  </Button>
               </div>
            </section>

            {/* ── Project Summary ──────────────────────────────────── */}
            <section className="space-y-3">
               <div>
                  <h2 className="text-lg font-medium">Resumo do Projeto</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                     Visão geral do projeto
                  </p>
               </div>
               <ItemGroup>
                  <Item variant="muted">
                     <ItemMedia variant="icon">
                        <Calendar className="size-4" />
                     </ItemMedia>
                     <ItemContent>
                        <ItemTitle>Criado em</ItemTitle>
                        <ItemDescription>{formattedCreatedAt}</ItemDescription>
                     </ItemContent>
                  </Item>
               </ItemGroup>
            </section>
         </div>
      </TooltipProvider>
   );
}

// ============================================
// Page Component
// ============================================

function ProjectGeneralPage() {
   return (
      <ErrorBoundary FallbackComponent={ProjectGeneralErrorFallback}>
         <Suspense fallback={<ProjectGeneralSkeleton />}>
            <ProjectGeneralContent />
         </Suspense>
      </ErrorBoundary>
   );
}
