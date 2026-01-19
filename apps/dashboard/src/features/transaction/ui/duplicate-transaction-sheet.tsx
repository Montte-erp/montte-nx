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

type DuplicateTransactionSheetProps = {
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
      description: "Usar a data de hoje para a duplicação",
   },
   custom: {
      title: "Data específica",
      description: "Escolha uma data específica para a duplicação",
   },
};

export function DuplicateTransactionSheet({
   transaction,
}: DuplicateTransactionSheetProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const [dateOption, setDateOption] = useState<DateOption>("today");
   const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

   const createTransactionMutation = useMutation(
      trpc.transactions.create.mutationOptions({
         onSuccess: () => {
            toast.success("Transação criada com sucesso");
            closeSheet();
         },
         onError: (error) => {
            console.error("Failed to duplicate transaction:", error);
            toast.error("Falha ao criar transação");
         },
      }),
   );

   const getDuplicateDate = (): Date => {
      switch (dateOption) {
         case "same-day":
            return transaction.date;
         case "today":
            return new Date();
         case "custom":
            if (!customDate) {
               throw new Error(
                  "Custom date is required when dateOption is 'custom'",
               );
            }
            return customDate;
      }
   };

   const handleSubmit = () => {
      const duplicateType =
         transaction.type === "transfer" ? "expense" : transaction.type;

      createTransactionMutation.mutate({
         amount: Number(transaction.amount),
         bankAccountId: transaction.bankAccountId || undefined,
         categoryIds: transaction.categoryIds,
         costCenterId: transaction.costCenterId || undefined,
         date: formatDate(getDuplicateDate(), "YYYY-MM-DD"),
         description: transaction.description,
         tagIds: transaction.tagIds,
         type: duplicateType,
      });
   };

   const isSubmitDisabled =
      createTransactionMutation.isPending ||
      (dateOption === "custom" && !customDate);

   return (
      <>
         <SheetHeader>
            <SheetTitle>Duplicar Transação</SheetTitle>
            <SheetDescription>
               Crie uma cópia desta transação com os mesmos dados.
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
                  : "Duplicar Transação"}
            </Button>
         </SheetFooter>
      </>
   );
}
