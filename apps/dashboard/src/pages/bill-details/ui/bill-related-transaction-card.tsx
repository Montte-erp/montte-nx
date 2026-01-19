import { formatDecimalCurrency } from "@packages/money";
import { Alert, AlertDescription } from "@packages/ui/components/alert";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Receipt } from "lucide-react";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useTRPC } from "@/integrations/clients";

function RelatedTransactionCardErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>
            Falha ao carregar transação relacionada
         </AlertDescription>
      </Alert>
   );
}

function RelatedTransactionCardSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-6 w-40" />
         </CardHeader>
         <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
               <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                     <Skeleton className="h-4 w-32" />
                     <Skeleton className="h-3 w-24" />
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-8 w-28" />
               </div>
            </div>
         </CardContent>
      </Card>
   );
}

function RelatedTransactionCardContent({ billId }: { billId: string }) {
   const trpc = useTRPC();
   const { activeOrganization } = useActiveOrganization();

   const { data: bill } = useSuspenseQuery(
      trpc.bills.getById.queryOptions({ id: billId }),
   );

   if (!bill.transaction) {
      return null;
   }

   return (
      <Card>
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <Receipt className="size-5" />
               Transação Relacionada
            </CardTitle>
         </CardHeader>
         <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
               <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                     <span className="font-medium">
                        {bill.transaction.description}
                     </span>
                     <span className="text-sm text-muted-foreground">
                        {formatDate(
                           new Date(bill.transaction.date),
                           "DD/MM/YYYY",
                        )}
                     </span>
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <Badge
                     variant={
                        bill.transaction.type === "expense"
                           ? "destructive"
                           : "default"
                     }
                  >
                     {bill.transaction.type === "expense" ? "-" : "+"}
                     {formatDecimalCurrency(Number(bill.transaction.amount))}
                  </Badge>
                  <Button asChild size="sm" variant="outline">
                     <Link
                        params={{
                           slug: activeOrganization.slug,
                           transactionId: bill.transaction.id,
                        }}
                        to="/$slug/transactions/$transactionId"
                     >
                        <ExternalLink className="size-4" />
                        Ver transação
                     </Link>
                  </Button>
               </div>
            </div>
         </CardContent>
      </Card>
   );
}

export function BillRelatedTransactionCard({ billId }: { billId: string }) {
   return (
      <ErrorBoundary FallbackComponent={RelatedTransactionCardErrorFallback}>
         <Suspense fallback={<RelatedTransactionCardSkeleton />}>
            <RelatedTransactionCardContent billId={billId} />
         </Suspense>
      </ErrorBoundary>
   );
}
