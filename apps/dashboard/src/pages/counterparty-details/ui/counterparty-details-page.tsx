import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Building2, FileText, User, Users } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";
import { CounterpartyActionButtons } from "./counterparty-action-buttons";
import { CounterpartyAddressCard } from "./counterparty-address-card";
import { CounterpartyContactCard } from "./counterparty-contact-card";
import { CounterpartyMetadataCard } from "./counterparty-metadata-card";
import { CounterpartyNotesCard } from "./counterparty-notes-card";

function getTypeIcon(type: string) {
   switch (type) {
      case "client":
         return <User className="size-4" />;
      case "supplier":
         return <Building2 className="size-4" />;
      case "both":
         return <Users className="size-4" />;
      default:
         return <User className="size-4" />;
   }
}

function getTypeColor(type: string): string {
   switch (type) {
      case "client":
         return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "supplier":
         return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "both":
         return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default:
         return "";
   }
}

function getTypeLabel(type: string): string {
   switch (type) {
      case "client":
         return "Cliente";
      case "supplier":
         return "Fornecedor";
      case "both":
         return "Cliente e Fornecedor";
      default:
         return type;
   }
}

function CounterpartyContent() {
   const params = useParams({ strict: false });
   const counterpartyId =
      (params as { counterpartyId?: string }).counterpartyId ?? "";
   const trpc = useTRPC();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();

   const { data: counterparty } = useSuspenseQuery(
      trpc.counterparties.getById.queryOptions({ id: counterpartyId }),
   );

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/counterparties",
      });
   };

   if (!counterpartyId) {
      return (
         <CounterpartyPageError
            error={new Error("Invalid counterparty ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!counterparty) {
      return null;
   }

   return (
      <main className="space-y-6">
         <div className="space-y-4">
            <div className="flex items-center gap-3">
               <Button asChild className="size-8" size="icon" variant="outline">
                  <a
                     href={`/${activeOrganization.slug}/counterparties`}
                     onClick={(e) => {
                        e.preventDefault();
                        router.navigate({
                           params: { slug: activeOrganization.slug },
                           to: "/$slug/counterparties",
                        });
                     }}
                  >
                     <ArrowLeft className="size-4" />
                  </a>
               </Button>
               <div className="flex-1">
                  <div className="flex items-center gap-3">
                     <h1 className="text-2xl font-bold tracking-tight">
                        {counterparty.name}
                     </h1>
                     <Badge
                        className={cn(
                           "gap-1 border",
                           getTypeColor(counterparty.type),
                        )}
                        variant="outline"
                     >
                        {getTypeIcon(counterparty.type)}
                        {getTypeLabel(counterparty.type)}
                     </Badge>
                     {!counterparty.isActive && (
                        <Badge variant="secondary">Inativo</Badge>
                     )}
                  </div>
                  <p className="text-muted-foreground text-sm mt-1">
                     {counterparty.tradeName ||
                        counterparty.document ||
                        "Parceiro comercial"}
                  </p>
               </div>
            </div>

            <CounterpartyActionButtons
               counterpartyId={counterpartyId}
               onDeleteSuccess={handleDeleteSuccess}
            />
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Metadata, Contact, Address */}
            <div className="lg:col-span-1 space-y-6">
               <CounterpartyMetadataCard counterpartyId={counterpartyId} />
               <CounterpartyContactCard counterpartyId={counterpartyId} />
               <CounterpartyAddressCard counterpartyId={counterpartyId} />
            </div>

            {/* Right column - Notes and future financial info */}
            <div className="lg:col-span-2 space-y-6">
               <CounterpartyNotesCard counterpartyId={counterpartyId} />
               {/* Future: CounterpartyFinancialSummaryCard */}
               {/* Future: CounterpartyRelatedBillsCard */}
               {/* Future: CounterpartyRelatedTransactionsCard */}
            </div>
         </div>
      </main>
   );
}

function CounterpartyPageSkeleton() {
   return (
      <main className="space-y-6">
         <div className="space-y-4">
            <div className="flex items-center gap-3">
               <Skeleton className="size-8" />
               <div className="flex-1 space-y-2">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-4 w-32" />
               </div>
            </div>
            <div className="flex gap-2">
               <Skeleton className="h-9 w-32" />
               <Skeleton className="h-9 w-24" />
               <Skeleton className="h-9 w-24" />
               <Skeleton className="h-9 w-24" />
            </div>
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-32 w-full" />
               <Skeleton className="h-32 w-full" />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <Skeleton className="h-32 w-full" />
               <Skeleton className="h-48 w-full" />
            </div>
         </div>
      </main>
   );
}

function CounterpartyPageError({ error, resetErrorBoundary }: FallbackProps) {
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
                  <EmptyTitle>Erro ao carregar parceiro</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/counterparties",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <ArrowLeft className="size-4 mr-2" />
                        Voltar para lista
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

export function CounterpartyDetailsPage() {
   return (
      <ErrorBoundary FallbackComponent={CounterpartyPageError}>
         <Suspense fallback={<CounterpartyPageSkeleton />}>
            <CounterpartyContent />
         </Suspense>
      </ErrorBoundary>
   );
}
