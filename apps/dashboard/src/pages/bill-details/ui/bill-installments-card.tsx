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
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTRPC } from "@/integrations/clients";

function InstallmentsCardErrorFallback() {
   return (
      <Alert variant="destructive">
         <AlertDescription>Falha ao carregar parcelas</AlertDescription>
      </Alert>
   );
}

function InstallmentsCardSkeleton() {
   return (
      <Card>
         <CardHeader>
            <Skeleton className="h-6 w-40" />
         </CardHeader>
         <CardContent className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
               <div
                  className="flex items-center justify-between p-3 border rounded-lg"
                  key={`installment-skeleton-${i + 1}`}
               >
                  <div className="flex items-center gap-3">
                     <Skeleton className="size-4" />
                     <div>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-20 mt-1" />
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <Skeleton className="h-4 w-20" />
                     <Skeleton className="h-6 w-16" />
                  </div>
               </div>
            ))}
         </CardContent>
      </Card>
   );
}

function InstallmentsCardContent({ billId }: { billId: string }) {
   const trpc = useTRPC();
   const [showAllInstallments, setShowAllInstallments] = useState(false);

   const { data: bill } = useSuspenseQuery(
      trpc.bills.getById.queryOptions({ id: billId }),
   );

   const { data: installmentBills = [] } = useQuery({
      ...trpc.bills.getByInstallmentGroup.queryOptions({
         installmentGroupId: bill?.installmentGroupId ?? "",
      }),
      enabled: !!bill?.installmentGroupId,
   });

   if (!bill.installmentGroupId || installmentBills.length === 0) {
      return null;
   }

   const visibleInstallments = showAllInstallments
      ? installmentBills
      : installmentBills.slice(0, 5);

   return (
      <Card>
         <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <CalendarDays className="size-5" />
               Parcelas ({bill.installmentNumber}/{bill.totalInstallments})
            </CardTitle>
         </CardHeader>
         <CardContent>
            <div className="space-y-2">
               {visibleInstallments.map((installment) => {
                  const isCurrent = installment.id === bill.id;
                  const isPaid = !!installment.completionDate;

                  return (
                     <div
                        className={`flex items-center justify-between p-3 border rounded-lg ${isCurrent ? "border-primary bg-primary/5" : ""}`}
                        key={installment.id}
                     >
                        <div className="flex items-center gap-3">
                           {isPaid ? (
                              <CheckCircle2 className="size-4 text-green-500" />
                           ) : isCurrent ? (
                              <Clock className="size-4 text-primary" />
                           ) : (
                              <Clock className="size-4 text-muted-foreground" />
                           )}
                           <div>
                              <p className="text-sm font-medium">
                                 Parcela {installment.installmentNumber}
                                 {isCurrent && (
                                    <Badge className="ml-2" variant="secondary">
                                       Atual
                                    </Badge>
                                 )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                 {formatDate(
                                    new Date(installment.dueDate),
                                    "DD/MM/YYYY",
                                 )}
                              </p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-medium">
                              {formatDecimalCurrency(
                                 Number(installment.amount),
                              )}
                           </span>
                           <Badge variant={isPaid ? "default" : "secondary"}>
                              {isPaid ? "Pago" : "Pendente"}
                           </Badge>
                        </div>
                     </div>
                  );
               })}
               {installmentBills.length > 5 && (
                  <Button
                     className="w-full"
                     onClick={() =>
                        setShowAllInstallments(!showAllInstallments)
                     }
                     size="sm"
                     variant="ghost"
                  >
                     {showAllInstallments
                        ? "Mostrar menos"
                        : "Ver todas as parcelas"}
                  </Button>
               )}
            </div>
         </CardContent>
      </Card>
   );
}

export function BillInstallmentsCard({ billId }: { billId: string }) {
   return (
      <ErrorBoundary FallbackComponent={InstallmentsCardErrorFallback}>
         <Suspense fallback={<InstallmentsCardSkeleton />}>
            <InstallmentsCardContent billId={billId} />
         </Suspense>
      </ErrorBoundary>
   );
}
