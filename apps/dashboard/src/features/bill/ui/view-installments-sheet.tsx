import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { translate } from "@packages/localization";
import { formatDecimalCurrency } from "@packages/money";
import { Badge } from "@packages/ui/components/badge";
import {
   SheetDescription,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Skeleton } from "@packages/ui/components/skeleton";
import { formatDate } from "@packages/utils/date";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { AlertCircle, Check, Clock } from "lucide-react";
import { useTRPC } from "@/integrations/clients";

type Bill = BillWithRelations;

type ViewInstallmentsSheetProps = {
   bill: Bill;
};

function getBillStatus(bill: Bill) {
   if (bill.completionDate) {
      return "completed";
   }
   const today = new Date();
   const dueDate = new Date(bill.dueDate);
   if (dueDate < today) {
      return "overdue";
   }
   return "pending";
}

function StatusBadge({
   status,
}: {
   status: "completed" | "pending" | "overdue";
}) {
   if (status === "completed") {
      return (
         <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <Check className="size-3" />
            {translate("dashboard.routes.bills.status.paid")}
         </Badge>
      );
   }
   if (status === "overdue") {
      return (
         <Badge className="gap-1" variant="destructive">
            <AlertCircle className="size-3" />
            {translate("dashboard.routes.bills.status.overdue")}
         </Badge>
      );
   }
   return (
      <Badge className="gap-1" variant="secondary">
         <Clock className="size-3" />
         {translate("dashboard.routes.bills.status.pending")}
      </Badge>
   );
}

export function ViewInstallmentsSheet({ bill }: ViewInstallmentsSheetProps) {
   const trpc = useTRPC();
   const { slug } = useParams({ strict: false });

   const { data: installments, isLoading } = useQuery(
      trpc.bills.getByInstallmentGroup.queryOptions({
         installmentGroupId: bill.installmentGroupId as string,
      }),
   );

   const totalAmount =
      installments?.reduce((sum, b) => sum + Number(b.amount), 0) ?? 0;

   const completedCount =
      installments?.filter((b) => b.completionDate).length ?? 0;
   const totalCount = installments?.length ?? 0;

   return (
      <>
         <SheetHeader>
            <SheetTitle>
               {translate(
                  "dashboard.routes.bills.features.view-installments.title",
               )}
            </SheetTitle>
            <SheetDescription>
               {translate(
                  "dashboard.routes.bills.features.view-installments.description",
               )}
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            {/* Summary */}
            <div className="py-4 border-b space-y-2">
               <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                     {translate(
                        "dashboard.routes.bills.features.view-installments.total-amount",
                     )}
                  </span>
                  <span className="font-medium">
                     {formatDecimalCurrency(totalAmount)}
                  </span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                     {translate(
                        "dashboard.routes.bills.features.view-installments.progress",
                     )}
                  </span>
                  <span className="font-medium">
                     {completedCount} / {totalCount}
                  </span>
               </div>
            </div>

            {/* Installments list */}
            <div className="py-4 space-y-2">
               {isLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                       <Skeleton
                          className="h-16 w-full rounded-lg"
                          key={`skeleton-${i + 1}`}
                       />
                    ))
                  : installments?.map((installment, index) => {
                       const status = getBillStatus(installment);
                       const isCurrent = installment.id === bill.id;

                       return (
                          <Link
                             className={`block p-3 rounded-lg border transition-colors hover:bg-muted/50 ${
                                isCurrent ? "border-primary bg-primary/5" : ""
                             }`}
                             key={installment.id}
                             params={{
                                billId: installment.id,
                                slug: slug as string,
                             }}
                             to="/$slug/bills/$billId"
                          >
                             <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                   <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">
                                         {translate(
                                            "dashboard.routes.bills.features.view-installments.installment-number",
                                            {
                                               current: index + 1,
                                               total: totalCount,
                                            },
                                         )}
                                      </span>
                                      {isCurrent && (
                                         <Badge
                                            className="text-xs"
                                            variant="outline"
                                         >
                                            {translate(
                                               "dashboard.routes.bills.features.view-installments.current",
                                            )}
                                         </Badge>
                                      )}
                                   </div>
                                   <div className="text-xs text-muted-foreground">
                                      {translate(
                                         "dashboard.routes.bills.features.view-installments.due-date",
                                      )}{" "}
                                      {formatDate(
                                         new Date(installment.dueDate),
                                         "DD/MM/YYYY",
                                      )}
                                   </div>
                                </div>
                                <div className="flex items-center gap-3">
                                   <span className="font-medium">
                                      {formatDecimalCurrency(
                                         Number(installment.amount),
                                      )}
                                   </span>
                                   <StatusBadge status={status} />
                                </div>
                             </div>
                          </Link>
                       );
                    })}
            </div>
         </div>
      </>
   );
}
