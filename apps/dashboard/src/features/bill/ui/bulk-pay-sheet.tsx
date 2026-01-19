import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { formatDecimalCurrency } from "@packages/money";
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxIndicator,
   ChoiceboxItem,
   ChoiceboxItemDescription,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
} from "@packages/ui/components/choicebox";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { formatDate } from "@packages/utils/date";
import { useState } from "react";
import {
   type BillPaymentItem,
   useBillBulkActions,
} from "@/features/bill/lib/use-bill-bulk-actions";
import { useSheet } from "@/hooks/use-sheet";

type PaymentMode = "today" | "custom";

type BillPaymentDate = {
   billId: string;
   completionDate: Date;
};

type BulkPaySheetProps = {
   bills: BillWithRelations[];
   onSuccess?: () => void;
};

export function BulkPaySheet({ bills, onSuccess }: BulkPaySheetProps) {
   const { closeSheet } = useSheet();
   const [paymentMode, setPaymentMode] = useState<PaymentMode>("today");

   // Initialize with each bill's due date
   const [paymentDates, setPaymentDates] = useState<BillPaymentDate[]>(() =>
      bills.map((bill) => ({
         billId: bill.id,
         completionDate: new Date(bill.dueDate),
      })),
   );

   const { completeSelected, completeManyWithDates, isLoading } =
      useBillBulkActions({
         onSuccess: () => {
            onSuccess?.();
            closeSheet();
         },
      });

   const handleSubmit = async () => {
      if (paymentMode === "today") {
         await completeSelected(bills.map((b) => b.id));
      } else {
         const items: BillPaymentItem[] = paymentDates.map((item) => ({
            id: item.billId,
            completionDate: item.completionDate.toISOString(),
         }));
         await completeManyWithDates(items);
      }
   };

   const updatePaymentDate = (billId: string, date: Date | undefined) => {
      if (!date) return;
      setPaymentDates((prev) =>
         prev.map((item) =>
            item.billId === billId ? { ...item, completionDate: date } : item,
         ),
      );
   };

   return (
      <>
         <SheetHeader>
            <SheetTitle>Pagar Contas Selecionadas</SheetTitle>
            <SheetDescription>
               Escolha como deseja registrar o pagamento
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
               <Choicebox
                  onValueChange={(value) =>
                     setPaymentMode(value as PaymentMode)
                  }
                  value={paymentMode}
               >
                  <ChoiceboxItem id="today" value="today">
                     <ChoiceboxItemHeader>
                        <ChoiceboxItemTitle>Pagar Hoje</ChoiceboxItemTitle>
                        <ChoiceboxItemDescription>
                           Todas as contas serão marcadas como pagas na data de
                           hoje
                        </ChoiceboxItemDescription>
                     </ChoiceboxItemHeader>
                     <ChoiceboxIndicator id="today" />
                  </ChoiceboxItem>

                  <ChoiceboxItem id="custom" value="custom">
                     <ChoiceboxItemHeader>
                        <ChoiceboxItemTitle>
                           Datas Personalizadas
                        </ChoiceboxItemTitle>
                        <ChoiceboxItemDescription>
                           Defina a data de pagamento para cada conta
                           (pré-preenchido com vencimento)
                        </ChoiceboxItemDescription>
                     </ChoiceboxItemHeader>
                     <ChoiceboxIndicator id="custom" />
                  </ChoiceboxItem>
               </Choicebox>

               {paymentMode === "custom" && (
                  <div className="space-y-3 pt-4">
                     {bills.map((bill) => {
                        const paymentItem = paymentDates.find(
                           (p) => p.billId === bill.id,
                        );
                        return (
                           <div
                              className="p-3 border rounded-lg space-y-2"
                              key={bill.id}
                           >
                              <div className="flex justify-between items-start">
                                 <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                       {bill.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                       Vencimento:{" "}
                                       {formatDate(
                                          new Date(bill.dueDate),
                                          "DD/MM/YYYY",
                                       )}
                                    </p>
                                 </div>
                                 <span className="font-medium text-sm ml-2">
                                    {formatDecimalCurrency(Number(bill.amount))}
                                 </span>
                              </div>
                              <DatePicker
                                 className="w-full"
                                 date={paymentItem?.completionDate}
                                 onSelect={(date) =>
                                    updatePaymentDate(bill.id, date)
                                 }
                                 placeholder="Data do Pagamento"
                              />
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
         </div>

         <SheetFooter>
            <Button
               className="w-full"
               disabled={isLoading}
               onClick={handleSubmit}
            >
               {isLoading ? "Carregando..." : "Confirmar Pagamento"}
            </Button>
         </SheetFooter>
      </>
   );
}
