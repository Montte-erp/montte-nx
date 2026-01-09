import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import {
   Calendar,
   Clock,
   Edit,
   FileText,
   Home,
   Percent,
   Star,
   Trash2,
   TrendingUp,
} from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import { ManageInterestTemplateForm } from "../../interest-templates/features/manage-interest-template-form";
import { useDeleteInterestTemplate } from "../../interest-templates/features/use-delete-interest-template";

function getPenaltyTypeLabel(type: string) {
   switch (type) {
      case "percentage":
         return "Percentual";
      case "fixed":
         return "Valor Fixo";
      default:
         return "Nenhuma";
   }
}

function getInterestTypeLabel(type: string) {
   switch (type) {
      case "daily":
         return "Diário";
      case "monthly":
         return "Mensal";
      default:
         return "Nenhum";
   }
}

function InterestTemplateContent() {
   const { openSheet } = useSheet();
   const params = useParams({ strict: false });
   const interestTemplateId =
      (params as { interestTemplateId?: string }).interestTemplateId ?? "";
   const trpc = useTRPC();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();

   const { data: template } = useSuspenseQuery(
      trpc.interestTemplates.getById.queryOptions({ id: interestTemplateId }),
   );

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/interest-templates",
      });
   };

   const { deleteInterestTemplate } = useDeleteInterestTemplate({
      onSuccess: handleDeleteSuccess,
      template: template,
   });

   if (!interestTemplateId) {
      return (
         <InterestTemplatePageError
            error={new Error("Invalid interest template ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!template) {
      return null;
   }

   return (
      <main className="space-y-4">
         <DefaultHeader
            description="Gerencie templates de juros e multas para suas contas"
            title={template.name}
         />

         <div className="flex flex-wrap items-center gap-2">
            {template.isDefault && (
               <Badge className="gap-1" variant="default">
                  <Star className="size-4 fill-current" />
                  Template Padrão
               </Badge>
            )}
            {template.monetaryCorrectionIndex !== "none" && (
               <Badge variant="secondary">
                  {template.monetaryCorrectionIndex.toUpperCase()}
               </Badge>
            )}
            <Button
               onClick={() =>
                  openSheet({
                     children: (
                        <ManageInterestTemplateForm template={template} />
                     ),
                  })
               }
               size="sm"
               variant="outline"
            >
               <Edit className="size-4" />
               Editar template
            </Button>
            <Button
               className="text-destructive hover:text-destructive"
               onClick={deleteInterestTemplate}
               size="sm"
               variant="outline"
            >
               <Trash2 className="size-4" />
               Excluir template
            </Button>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
               <CardHeader>
                  <CardTitle>Tipo de Multa</CardTitle>
                  <CardDescription>Configuracao de multa</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                     <Percent className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Tipo de Multa
                        </p>
                        <p className="text-sm font-medium">
                           {getPenaltyTypeLabel(template.penaltyType)}
                        </p>
                     </div>
                  </div>
                  {template.penaltyValue && (
                     <div className="flex items-center gap-3">
                        <Percent className="size-4 text-muted-foreground" />
                        <div>
                           <p className="text-xs text-muted-foreground">
                              Valor da Multa
                           </p>
                           <p className="text-sm font-medium">
                              {template.penaltyValue}
                              {template.penaltyType === "percentage"
                                 ? "%"
                                 : " R$"}
                           </p>
                        </div>
                     </div>
                  )}
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <CardTitle>Tipo de Juros</CardTitle>
                  <CardDescription>Configuracao de juros</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                     <TrendingUp className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Tipo de Juros
                        </p>
                        <p className="text-sm font-medium">
                           {getInterestTypeLabel(template.interestType)}
                        </p>
                     </div>
                  </div>
                  {template.interestValue && (
                     <div className="flex items-center gap-3">
                        <TrendingUp className="size-4 text-muted-foreground" />
                        <div>
                           <p className="text-xs text-muted-foreground">
                              Valor dos Juros (%)
                           </p>
                           <p className="text-sm font-medium">
                              {template.interestValue}%
                           </p>
                        </div>
                     </div>
                  )}
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <CardTitle>Outras Configuracoes</CardTitle>
                  <CardDescription>
                     Carencia e correcao monetaria
                  </CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                     <Clock className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Período de Carência
                        </p>
                        <p className="text-sm font-medium">
                           {template.gracePeriodDays} dias
                        </p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <TrendingUp className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Índice de Correção Monetária
                        </p>
                        <p className="text-sm font-medium">
                           {template.monetaryCorrectionIndex !== "none"
                              ? template.monetaryCorrectionIndex.toUpperCase()
                              : "Nenhum"}
                        </p>
                     </div>
                  </div>
               </CardContent>
            </Card>

            <Card>
               <CardHeader>
                  <CardTitle>Informacoes</CardTitle>
                  <CardDescription>Datas e metadados</CardDescription>
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                     <Calendar className="size-4 text-muted-foreground" />
                     <div>
                        <p className="text-xs text-muted-foreground">
                           Criado em
                        </p>
                        <p className="text-sm font-medium">
                           {formatDate(
                              new Date(template.createdAt),
                              "DD MMM YYYY",
                           )}
                        </p>
                     </div>
                  </div>
               </CardContent>
            </Card>
         </div>
      </main>
   );
}

function InterestTemplatePageSkeleton() {
   return (
      <main className="space-y-4">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-72" />
         </div>
         <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
         </div>
      </main>
   );
}

function InterestTemplatePageError({
   error,
   resetErrorBoundary,
}: FallbackProps) {
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();
   return (
      <main className="flex flex-col h-full w-full">
         <div className="flex-1 flex items-center justify-center">
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <FileText className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Erro ao carregar templates</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/interest-templates",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <Home className="size-4 mr-2" />
                        Templates de Juros
                     </Button>
                     <Button
                        onClick={resetErrorBoundary}
                        size="default"
                        variant="default"
                     >
                        Tentar novamente
                     </Button>
                  </div>
               </EmptyContent>
            </Empty>
         </div>
      </main>
   );
}

export function InterestTemplateDetailsPage() {
   return (
      <ErrorBoundary FallbackComponent={InterestTemplatePageError}>
         <Suspense fallback={<InterestTemplatePageSkeleton />}>
            <InterestTemplateContent />
         </Suspense>
      </ErrorBoundary>
   );
}
