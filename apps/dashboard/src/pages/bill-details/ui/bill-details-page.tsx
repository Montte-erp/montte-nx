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
import { ArrowLeft, Receipt } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { DefaultHeader } from "@/default/default-header";
import { useDetailTabName } from "@/features/custom-dashboard/hooks/use-detail-tab-name";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";
import { BillActionButtons } from "./bill-action-buttons";
import { BillAttachmentsCard } from "./bill-attachments-card";
import { BillInfoCard } from "./bill-info-card";
import { BillInstallmentsCard } from "./bill-installments-card";
import { BillInterestCard } from "./bill-interest-card";
import { BillMetadataCard } from "./bill-metadata-card";
import { BillRelatedTransactionCard } from "./bill-related-transaction-card";

function BillDetailsContent() {
   const params = useParams({ strict: false });
   const billId = (params as { billId?: string }).billId ?? "";
   const trpc = useTRPC();
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();

   const { data: bill } = useSuspenseQuery(
      trpc.bills.getById.queryOptions({ id: billId }),
   );

   useDetailTabName(bill?.description);

   const handleDeleteSuccess = () => {
      router.navigate({
         params: { slug: activeOrganization.slug },
         to: "/$slug/bills",
      });
   };

   if (!billId) {
      return (
         <BillDetailsPageError
            error={new Error("Invalid bill ID")}
            resetErrorBoundary={() => {}}
         />
      );
   }

   if (!bill) {
      return null;
   }

   return (
      <main className="space-y-6">
         <DefaultHeader
            description="Visualize e gerencie os detalhes desta conta"
            title={bill.description}
         />

         <BillActionButtons
            billId={billId}
            onDeleteSuccess={handleDeleteSuccess}
         />

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <BillMetadataCard billId={billId} />
               <BillAttachmentsCard billId={billId} />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <BillInfoCard billId={billId} />
               <BillRelatedTransactionCard billId={billId} />
            </div>
            <div className="lg:col-span-full space-y-6">
               <BillInterestCard billId={billId} />
               <BillInstallmentsCard billId={billId} />
            </div>
         </div>
      </main>
   );
}

function BillDetailsPageSkeleton() {
   return (
      <main className="space-y-6">
         <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-6 w-72" />
         </div>
         <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-40 w-full" />
            </div>
            <div className="lg:col-span-2 space-y-6">
               <Skeleton className="h-48 w-full" />
               <Skeleton className="h-32 w-full" />
            </div>
         </div>
      </main>
   );
}

function BillDetailsPageError({ error, resetErrorBoundary }: FallbackProps) {
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
                  <EmptyTitle>Conta Não Encontrada</EmptyTitle>
                  <EmptyDescription>{error?.message}</EmptyDescription>
                  <div className="mt-6 flex gap-2 justify-center">
                     <Button
                        onClick={() =>
                           router.navigate({
                              params: { slug: activeOrganization.slug },
                              to: "/$slug/bills",
                           })
                        }
                        size="default"
                        variant="outline"
                     >
                        <ArrowLeft className="size-4 mr-2" />
                        Voltar para contas
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

export function BillDetailsPage() {
   return (
      <ErrorBoundary FallbackComponent={BillDetailsPageError}>
         <Suspense fallback={<BillDetailsPageSkeleton />}>
            <BillDetailsContent />
         </Suspense>
      </ErrorBoundary>
   );
}
