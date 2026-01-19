import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
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
import {
   type BillStatus,
   getBillStatus,
} from "@/features/bill/lib/bill-status";
import { useTRPC } from "@/integrations/clients";

type Bill = BillWithRelations;

type ViewInstallmentsSheetProps = {
   bill: Bill;
};

function StatusBadge({ status }: { status: BillStatus }) {
   if (status === "paid") {
      return (
         <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <Check className="size-3" />
            Paga
         </Badge>
      );
   }
   if (status === "overdue") {
      return (
         <Badge className="gap-1" variant="destructive">
            <AlertCircle className="size-3" />
            Vencida
         </Badge>
      );
   }
   return (
      <Badge className="gap-1" variant="secondary">
         <Clock className="size-3" />
         Pendente
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
            <SheetTitle>Parcelas</SheetTitle>
            <SheetDescription>
               Visualize todas as parcelas desta conta
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            {/* Summary */}
            <div className="py-4 border-b space-y-2">
               <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Total</span>
                  <span className="font-medium">
                     {formatDecimalCurrency(totalAmount)}
                  </span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
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
                       const baseClassName = `block p-3 rounded-lg border transition-colors ${
                          isCurrent ? "border-primary bg-primary/5" : ""
                       }`;

                       const content = (
                          <div className="flex items-center justify-between">
                             <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                   <span className="font-medium text-sm">
                                      {`Parcela ${index + 1}/${totalCount}`}
                                   </span>
                                   {isCurrent && (
                                      <Badge
                                         className="text-xs"
                                         variant="outline"
                                      >
                                         Atual
                                      </Badge>
                                   )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                   Vencimento:{" "}
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
                       );

                       if (!slug) {
                          return (
                             <div
                                className={baseClassName}
                                key={installment.id}
                             >
                                {content}
                             </div>
                          );
                       }

                       return (
                          <Link
                             className={`${baseClassName} hover:bg-muted/50`}
                             key={installment.id}
                             params={{
                                billId: installment.id,
                                slug,
                             }}
                             to="/$slug/bills/$billId"
                          >
                             {content}
                          </Link>
                       );
                    })}
            </div>
         </div>
      </>
   );
}
