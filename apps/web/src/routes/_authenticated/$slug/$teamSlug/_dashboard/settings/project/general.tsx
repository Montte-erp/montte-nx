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
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Building2, Hash, Loader2, RefreshCw, Settings2 } from "lucide-react";
import { Suspense, useState, useTransition } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "@packages/ui/hooks/use-toast";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";
import { DefaultHeader } from "../../../-layout/default-header";

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
         <DefaultHeader
            description="Gerencie as configurações do espaço."
            title="Geral"
         />
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

function onlyDigits(value: string) {
   return value.replace(/\D/g, "").slice(0, 14);
}

function formatCnpj(value: string | null | undefined) {
   const digits = onlyDigits(value ?? "");
   if (digits.length !== 14) return digits;
   return digits.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      "$1.$2.$3/$4-$5",
   );
}

function CompanyDataSection({
   cnpj,
   cnpjData,
   teamId,
}: {
   cnpj: string | null | undefined;
   cnpjData: {
      cnpj: string;
      razao_social: string;
      nome_fantasia: string | null;
      municipio: string | null;
      uf: string | null;
      cnae_fiscal_descricao: string | null;
      descricao_situacao_cadastral: string;
      data_inicio_atividade: string;
   } | null;
   teamId: string;
}) {
   const queryClient = useQueryClient();
   const [value, setValue] = useState(cnpj ?? cnpjData?.cnpj ?? "");
   const [isPending, startTransition] = useTransition();
   const digits = onlyDigits(value);
   const canSubmit = digits.length === 14 && digits !== (cnpj ?? "");

   function handleSave() {
      if (!canSubmit) return;
      startTransition(async () => {
         try {
            await orpc.team.updateCnpj.call({ teamId, cnpj: digits });
            await queryClient.invalidateQueries(
               orpc.team.get.queryOptions({ input: { teamId } }),
            );
            toast.success("Dados da empresa atualizados.");
         } catch (error) {
            toast.error(
               error instanceof Error
                  ? error.message
                  : "Não foi possível consultar o CNPJ.",
            );
         }
      });
   }

   return (
      <section className="space-y-3">
         <div>
            <h2 className="text-lg font-medium">Dados da empresa</h2>
            <p className="text-sm text-muted-foreground">
               CNPJ do emitente usado nas rotinas fiscais deste espaço.
            </p>
         </div>
         <div className="max-w-md space-y-3">
            <Input
               inputMode="numeric"
               onChange={(event) => setValue(onlyDigits(event.target.value))}
               placeholder="00.000.000/0000-00"
               value={formatCnpj(value)}
            />
            <Button disabled={!canSubmit || isPending} onClick={handleSave}>
               {isPending ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
               ) : (
                  <RefreshCw className="size-4 mr-2" />
               )}
               Consultar e salvar CNPJ
            </Button>
         </div>
         {cnpjData ? (
            <ItemGroup>
               <Item variant="muted">
                  <Building2 className="size-4 text-muted-foreground" />
                  <ItemContent className="min-w-0">
                     <ItemTitle>{cnpjData.razao_social}</ItemTitle>
                     <ItemDescription>
                        {cnpjData.nome_fantasia ||
                           "Nome fantasia não informado"}
                     </ItemDescription>
                  </ItemContent>
               </Item>
               <ItemSeparator />
               <Item variant="muted">
                  <Hash className="size-4 text-muted-foreground" />
                  <ItemContent className="min-w-0">
                     <ItemTitle>{formatCnpj(cnpjData.cnpj)}</ItemTitle>
                     <ItemDescription>
                        {cnpjData.municipio || "Município não informado"}
                        {cnpjData.uf ? `/${cnpjData.uf}` : ""} ·{" "}
                        {cnpjData.descricao_situacao_cadastral}
                     </ItemDescription>
                  </ItemContent>
               </Item>
               <ItemSeparator />
               <Item variant="muted">
                  <Settings2 className="size-4 text-muted-foreground" />
                  <ItemContent className="min-w-0">
                     <ItemTitle>
                        {cnpjData.cnae_fiscal_descricao || "CNAE não informado"}
                     </ItemTitle>
                     <ItemDescription>
                        Aberta em{" "}
                        {dayjs(cnpjData.data_inicio_atividade).format(
                           "DD/MM/YYYY",
                        )}
                     </ItemDescription>
                  </ItemContent>
               </Item>
            </ItemGroup>
         ) : null}
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
         <DefaultHeader
            description="Gerencie as configurações do espaço."
            title="Geral"
         />

         <DisplayNameSection currentName={teamData.name} teamId={teamId} />

         <Separator />

         <CompanyDataSection
            cnpj={teamData.cnpj}
            cnpjData={teamData.cnpjData}
            teamId={teamId}
         />

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
