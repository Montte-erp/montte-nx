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
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type RefundTransactionSheetProps = {
   transaction: {
      amount: string;
      bankAccountId: string | null;
      categoryIds: string[];
      costCenterId: string | null;
      date: Date;
      description: string;
      tagIds: string[];
      type: "expense" | "income" | "transfer";
   };
};

type DateOption = "same-day" | "today" | "custom";

const dateOptions: DateOption[] = ["same-day", "today", "custom"];

const dateOptionTexts: Record<
   DateOption,
   { title: string; description: string }
> = {
   "same-day": {
      title: "Mesmo dia da transação",
      description: "Usar a mesma data da transação original",
   },
   today: {
      title: "Hoje",
      description: "Usar a data de hoje para o estorno",
   },
   custom: {
      title: "Data específica",
      description: "Escolha uma data específica para o estorno",
   },
};

export function RefundTransactionSheet({
   transaction,
}: RefundTransactionSheetProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const [dateOption, setDateOption] = useState<DateOption>("today");
   const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

   const createTransactionMutation = useMutation(
      trpc.transactions.create.mutationOptions(),
   );

   const getRefundDate = (): Date => {
      switch (dateOption) {
         case "same-day":
            return transaction.date;
         case "today":
            return new Date();
         case "custom":
            return customDate || new Date();
      }
   };

   const handleSubmit = async () => {
      const refundType =
         transaction.type === "expense" || transaction.type === "transfer"
            ? "income"
            : "expense";

      await createTransactionMutation.mutateAsync({
         amount: Number(transaction.amount),
         bankAccountId: transaction.bankAccountId || undefined,
         categoryIds: transaction.categoryIds,
         costCenterId: transaction.costCenterId || undefined,
         date: formatDate(getRefundDate(), "YYYY-MM-DD"),
         description: `Estorno: ${transaction.description}`,
         tagIds: transaction.tagIds,
         type: refundType,
      });

      toast.success("Transação criada com sucesso");
      closeSheet();
   };

   const isSubmitDisabled =
      createTransactionMutation.isPending ||
      (dateOption === "custom" && !customDate);

   return (
      <>
         <SheetHeader>
            <SheetTitle>Estornar Transação</SheetTitle>
            <SheetDescription>
               Crie uma transação de estorno para reverter esta transação.
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
               <Choicebox
                  onValueChange={(value) => setDateOption(value as DateOption)}
                  value={dateOption}
               >
                  {dateOptions.map((option) => (
                     <ChoiceboxItem id={option} key={option} value={option}>
                        <ChoiceboxItemHeader>
                           <ChoiceboxItemTitle>
                              {dateOptionTexts[option].title}
                           </ChoiceboxItemTitle>
                           <ChoiceboxItemDescription>
                              {dateOptionTexts[option].description}
                           </ChoiceboxItemDescription>
                        </ChoiceboxItemHeader>
                        <ChoiceboxIndicator id={option} />
                     </ChoiceboxItem>
                  ))}
               </Choicebox>

               {dateOption === "custom" && (
                  <DatePicker
                     className="w-full"
                     date={customDate}
                     onSelect={setCustomDate}
                     placeholder="Data específica"
                  />
               )}
            </div>
         </div>

         <SheetFooter>
            <Button disabled={isSubmitDisabled} onClick={handleSubmit}>
               {createTransactionMutation.isPending
                  ? "Carregando..."
                  : "Criar Estorno"}
            </Button>
         </SheetFooter>
      </>
   );
}
