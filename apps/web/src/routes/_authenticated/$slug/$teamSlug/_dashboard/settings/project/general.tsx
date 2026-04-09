import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import {
   Item,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { Separator } from "@packages/ui/components/separator";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Hash, Loader2, Settings2 } from "lucide-react";
import { Suspense, useState, useTransition } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

dayjs.locale("pt-br");

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/general",
)({
   head: () => ({
      meta: [{ title: "Geral — Montte" }],
   }),
   component: ProjectGeneralPage,
});

function ProjectGeneralSkeleton() {
   return (
      <div className="space-y-8">
         <div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-4 w-64 mt-1" />
         </div>
         <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-80" />
            <Skeleton className="h-8 w-48" />
         </div>
         <Skeleton className="h-px w-full" />
         <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-2">
               <Skeleton className="h-14 w-full" />
               <Skeleton className="h-14 w-full" />
            </div>
         </div>
      </div>
   );
}

function ProjectGeneralErrorFallback({
   error: _error,
   resetErrorBoundary,
}: FallbackProps) {
   return (
      <div className="space-y-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Geral</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Gerencie as configurações do espaço.
            </p>
         </div>
         <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
               Não foi possível carregar as configurações do espaço
            </p>
            <Button onClick={resetErrorBoundary} variant="outline">
               Tentar novamente
            </Button>
         </div>
      </div>
   );
}

function DisplayNameSection({
   teamId,
   currentName,
}: {
   teamId: string;
   currentName: string;
}) {
   const [name, setName] = useState(currentName);
   const [isPending, startTransition] = useTransition();

   const hasChanged = name.trim() !== currentName && name.trim().length > 0;

   function handleRename() {
      if (!hasChanged) return;
      startTransition(async () => {
         const { error } = await authClient.organization.updateTeam({
            teamId,
            data: { name },
         });
         if (error) {
            toast.error("Não foi possível atualizar o nome do espaço.");
            return;
         }
         toast.success("Nome atualizado!");
      });
   }

   return (
      <section className="space-y-3">
         <div>
            <h2 className="text-lg font-medium">Nome de exibição</h2>
            <p className="text-sm text-muted-foreground">
               O nome público do espaço. Visível para todos os membros.
            </p>
         </div>
         <div className="max-w-md space-y-3">
            <Input
               onChange={(e) => setName(e.target.value)}
               placeholder="Nome do espaço"
               value={name}
            />
            <Button disabled={!hasChanged || isPending} onClick={handleRename}>
               {isPending && <Loader2 className="size-4 mr-2 animate-spin" />}
               Renomear espaço
            </Button>
         </div>
      </section>
   );
}

function SpaceDetailsSection({
   teamId,
   createdAt,
}: {
   teamId: string;
   createdAt: Date | string | null;
}) {
   const formattedCreatedAt = createdAt
      ? dayjs(createdAt).format("D [de] MMMM [de] YYYY")
      : "-";

   return (
      <section className="space-y-3">
         <div>
            <h2 className="text-lg font-medium">Detalhes do espaço</h2>
            <p className="text-sm text-muted-foreground">
               Informações gerais sobre o espaço.
            </p>
         </div>
         <ItemGroup>
            <Item variant="muted">
               <Settings2 className="size-4 text-muted-foreground" />
               <ItemContent className="min-w-0">
                  <ItemTitle>ID do Espaço</ItemTitle>
                  <ItemDescription className="truncate font-mono">
                     {teamId}
                  </ItemDescription>
               </ItemContent>
            </Item>
            <ItemSeparator />
            <Item variant="muted">
               <Hash className="size-4 text-muted-foreground" />
               <ItemContent className="min-w-0">
                  <ItemTitle>Criado em</ItemTitle>
                  <ItemDescription>{formattedCreatedAt}</ItemDescription>
               </ItemContent>
            </Item>
         </ItemGroup>
      </section>
   );
}

function ProjectGeneralContent() {
   const { currentTeam } = Route.useRouteContext();
   const teamId = currentTeam.id;

   const { data: teamData } = useSuspenseQuery(
      orpc.team.get.queryOptions({ input: { teamId } }),
   );

   return (
      <div className="space-y-8">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Geral</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Gerencie as configurações do espaço.
            </p>
         </div>

         <DisplayNameSection currentName={teamData.name} teamId={teamId} />

         <Separator />

         <SpaceDetailsSection createdAt={teamData.createdAt} teamId={teamId} />
      </div>
   );
}

function ProjectGeneralPage() {
   return (
      <ErrorBoundary FallbackComponent={ProjectGeneralErrorFallback}>
         <Suspense fallback={<ProjectGeneralSkeleton />}>
            <ProjectGeneralContent />
         </Suspense>
      </ErrorBoundary>
   );
}
