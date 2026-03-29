import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Item,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useForm } from "@tanstack/react-form";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import dayjs from "dayjs";
import "dayjs/locale/pt-br";
import { Calendar, Hash, Loader2, Settings2 } from "lucide-react";
import { Suspense, useCallback, useTransition } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";
import { authClient } from "@/integrations/better-auth/auth-client";
import { orpc } from "@/integrations/orpc/client";

dayjs.locale("pt-br");

export const Route = createFileRoute(
   "/_authenticated/$slug/$teamSlug/_dashboard/settings/project/general",
)({
   component: ProjectGeneralPage,
});

function ProjectGeneralSkeleton() {
   return (
      <div className="flex flex-col gap-6">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex flex-col gap-1">
               <Skeleton className="h-16 w-full rounded-lg" />
               <Skeleton className="h-16 w-full rounded-lg" />
            </div>
         </div>
         <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-16 w-full rounded-lg" />
         </div>
      </div>
   );
}

function ProjectGeneralErrorFallback({
   error: _error,
   resetErrorBoundary,
}: FallbackProps) {
   return (
      <div className="flex flex-col gap-6">
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

function ProjectGeneralContent() {
   const { currentTeam } = Route.useRouteContext();
   const teamId = currentTeam.id;

   const { data: teamData } = useSuspenseQuery(
      orpc.team.get.queryOptions({ input: { teamId } }),
   );

   const [isPending, startTransition] = useTransition();

   const form = useForm({
      defaultValues: { name: teamData.name },
      onSubmit: async ({ value }) => {
         const { error } = await authClient.organization.updateTeam({
            teamId,
            data: { name: value.name },
         });
         if (error) {
            toast.error("Não foi possível atualizar o nome do espaço.");
            return;
         }
         toast.success("Nome atualizado!");
      },
   });

   const handleSubmit = useCallback(
      (e: React.FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         startTransition(async () => {
            await form.handleSubmit();
         });
      },
      [form],
   );

   const formattedCreatedAt = teamData.createdAt
      ? dayjs(teamData.createdAt).format("D [de] MMMM [de] YYYY")
      : "-";

   return (
      <div className="flex flex-col gap-6">
         <div>
            <h1 className="text-2xl font-semibold font-serif">Geral</h1>
            <p className="text-sm text-muted-foreground mt-1">
               Gerencie as configurações do espaço.
            </p>
         </div>

         <section className="flex flex-col gap-4">
            <div>
               <h2 className="text-lg font-medium">Configurações do Espaço</h2>
               <p className="text-sm text-muted-foreground mt-1">
                  Gerencie o nome e identificador do espaço
               </p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Nome do Espaço
                           </FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               <form.Subscribe selector={(state) => state}>
                  {(state) => (
                     <Button
                        className="self-start"
                        disabled={!state.canSubmit || isPending}
                        type="submit"
                     >
                        {isPending && (
                           <Loader2 className="size-4 mr-2 animate-spin" />
                        )}
                        Salvar
                     </Button>
                  )}
               </form.Subscribe>
            </form>

            <ItemGroup>
               <Item variant="muted">
                  <Settings2 className="size-4 text-muted-foreground" />
                  <ItemContent className="min-w-0">
                     <ItemTitle>Nome atual</ItemTitle>
                     <ItemDescription className="truncate">
                        {teamData.name}
                     </ItemDescription>
                  </ItemContent>
               </Item>
               <ItemSeparator />
               <Item variant="muted">
                  <Hash className="size-4 text-muted-foreground" />
                  <ItemContent className="min-w-0">
                     <ItemTitle>ID do Espaço</ItemTitle>
                     <ItemDescription className="truncate font-mono">
                        {teamId}
                     </ItemDescription>
                  </ItemContent>
               </Item>
            </ItemGroup>
         </section>

         <section className="flex flex-col gap-4">
            <div>
               <h2 className="text-lg font-medium">Resumo do Espaço</h2>
               <p className="text-sm text-muted-foreground mt-1">
                  Visão geral do espaço
               </p>
            </div>
            <ItemGroup>
               <Item variant="muted">
                  <Calendar className="size-4 text-muted-foreground" />
                  <ItemContent>
                     <ItemTitle>Criado em</ItemTitle>
                     <ItemDescription>{formattedCreatedAt}</ItemDescription>
                  </ItemContent>
               </Item>
            </ItemGroup>
         </section>
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
