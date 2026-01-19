import { Button } from "@packages/ui/components/button";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { Skeleton } from "@packages/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { Home, Receipt } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { useDetailTabName } from "@/features/custom-dashboard/hooks/use-detail-tab-name";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";
import { TransactionActionButtons } from "./transaction-action-buttons";
import { TransactionAttachmentsGallery } from "./transaction-attachments-gallery";
import { TransactionCategorizationSection } from "./transaction-categories-section";
import { TransactionLinkedBillsCard } from "./transaction-linked-bills-card";
import { TransactionMetadataCard } from "./transaction-metadata-card";
import { TransactionRelatedCard } from "./transaction-related-card";
import { TransactionTransferCard } from "./transaction-transfer-card";

function TransactionContent() {
   const params = useParams({ strict: false });
   const transactionId =
      (params as { transactionId?: string }).transactionId ?? "";
   const trpc = useTRPC();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();

   const { data: transaction } = useSuspenseQuery(
      trpc.transactions.getById.queryOptions({ id: transactionId }),
   );

   useDetailTabName(transaction?.description);

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/transactions",
      });
   };

   if (!transactionId) {
      return (
         <TransactionPageError
            error={new Error("Invalid transaction ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!transaction) {
      return null;
   }

   return (
      <main className="space-y-6">
         <DefaultHeader
            description="Detalhes da sua transação"
            title={transaction.description}
         />

         <TransactionActionButtons
            onDeleteSuccess={handleDeleteSuccess}
            transactionId={transactionId}
         />

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <TransactionMetadataCard transactionId={transactionId} />
               <TransactionAttachmentsGallery transactionId={transactionId} />
            </div>
            <div className="lg:col-span-2 space-y-6">
               {transaction.type === "transfer" ? (
                  <TransactionTransferCard transactionId={transactionId} />
               ) : (
                  <TransactionCategorizationSection
                     transactionId={transactionId}
                  />
               )}
               <TransactionLinkedBillsCard transactionId={transactionId} />
            </div>
            <div className="lg:col-span-full">
               <TransactionRelatedCard transactionId={transactionId} />
            </div>
         </div>
      </main>
   );
}

function TransactionPageSkeleton() {
   return (
      <main className="space-y-6">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-6 w-48" />
         </div>

         <div className="flex flex-wrap gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-32" />
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-40 w-full" />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-48 w-full" />
            </div>
         </div>
      </main>
   );
}

function TransactionPageError({ error, resetErrorBoundary }: FallbackProps) {
   const { activeOrganization } = useActiveOrganization();
   const router = useRouter();

   return (
      <main className="flex flex-col h-full w-full">
         <div className="flex-1 flex items-center justify-center">
            <Empty>
               <EmptyContent>
                  <EmptyMedia variant="icon">
                     <Receipt className="size-12 text-destructive" />
                  </EmptyMedia>
                  <EmptyTitle>Falha ao carregar transação</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/transactions",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <Home className="size-4 mr-2" />
                        Voltar para Transações
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

export function TransactionDetailsPage() {
   return (
      <ErrorBoundary FallbackComponent={TransactionPageError}>
         <Suspense fallback={<TransactionPageSkeleton />}>
            <TransactionContent />
         </Suspense>
      </ErrorBoundary>
   );
}
