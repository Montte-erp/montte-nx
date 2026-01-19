import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import {
   Alert,
   AlertDescription,
   AlertTitle,
} from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";
import {
   Choicebox,
   ChoiceboxIndicator,
   ChoiceboxItem,
   ChoiceboxItemDescription,
   ChoiceboxItemHeader,
   ChoiceboxItemTitle,
} from "@packages/ui/components/choicebox";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

type Bill = BillWithRelations;

type ManageRecurrenceFormProps = {
   bill: Bill;
   onSuccess?: () => void;
};

type RecurrencePattern = "monthly" | "quarterly" | "semiannual" | "annual";

const FREQUENCY_OPTIONS = [
   "monthly",
   "quarterly",
   "semiannual",
   "annual",
] as const;

export function ManageRecurrenceForm({
   bill,
   onSuccess,
}: ManageRecurrenceFormProps) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const [recurrencePattern, setRecurrencePattern] = useState<
      RecurrencePattern | undefined
   >(bill.recurrencePattern as RecurrencePattern | undefined);

   const frequencyLabels: Record<string, string> = {
      annual: "Anual",
      monthly: "Mensal",
      quarterly: "Trimestral",
      semiannual: "Semestral",
   };

   const frequencyOptionLabels: Record<
      string,
      { title: string; description: string }
   > = {
      monthly: { title: "Mensal", description: "Repete todo mês" },
      quarterly: { title: "Trimestral", description: "Repete a cada 3 meses" },
      semiannual: { title: "Semestral", description: "Repete a cada 6 meses" },
      annual: { title: "Anual", description: "Repete todo ano" },
   };

   const updateBillMutation = useMutation(
      trpc.bills.update.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao atualizar recorrência");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getAllPaginated.queryKey(),
            });
            toast.success("Recorrência atualizada com sucesso");
            onSuccess?.();
         },
      }),
   );

   const handleUpdatePattern = () => {
      if (!recurrencePattern) return;

      updateBillMutation.mutate({
         data: {
            recurrencePattern,
         },
         id: bill.id,
      });
   };

   const handleDisableRecurrence = () => {
      updateBillMutation.mutate({
         data: {
            isRecurring: false,
            recurrencePattern: undefined,
         },
         id: bill.id,
      });
   };

   const hasChanges = recurrencePattern !== bill.recurrencePattern;
   const isSubmitDisabled = updateBillMutation.isPending || !hasChanges;

   return (
      <>
         <SheetHeader>
            <SheetTitle>Gerenciar Recorrência</SheetTitle>
            <SheetDescription>
               Altere ou desative a recorrência desta conta
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
               {/* Current recurrence info */}
               <Alert>
                  <CalendarCheck className="h-4 w-4" />
                  <AlertTitle>Padrão Atual</AlertTitle>
                  <AlertDescription>
                     {bill.recurrencePattern
                        ? frequencyLabels[bill.recurrencePattern]
                        : "Sem padrão definido"}
                  </AlertDescription>
               </Alert>

               {/* Frequency selection */}
               <div className="space-y-2">
                  <span className="text-sm font-medium">Frequência</span>
                  <Choicebox
                     onValueChange={(value) => {
                        setRecurrencePattern(value as RecurrencePattern);
                     }}
                     value={recurrencePattern || ""}
                  >
                     {FREQUENCY_OPTIONS.map((option) => (
                        <ChoiceboxItem
                           id={`freq-${option}`}
                           key={option}
                           value={option}
                        >
                           <ChoiceboxItemHeader>
                              <ChoiceboxItemTitle>
                                 {frequencyOptionLabels[option].title}
                              </ChoiceboxItemTitle>
                              <ChoiceboxItemDescription>
                                 {frequencyOptionLabels[option].description}
                              </ChoiceboxItemDescription>
                           </ChoiceboxItemHeader>
                           <ChoiceboxIndicator id={`freq-${option}`} />
                        </ChoiceboxItem>
                     ))}
                  </Choicebox>
               </div>

               {/* Disable recurrence option */}
               <div className="pt-4 border-t">
                  <Button
                     className="w-full"
                     disabled={updateBillMutation.isPending}
                     onClick={handleDisableRecurrence}
                     variant="outline"
                  >
                     <CalendarX className="size-4 mr-2" />
                     Desativar Recorrência
                  </Button>
               </div>
            </div>
         </div>

         <SheetFooter className="px-4">
            <Button
               className="w-full"
               disabled={isSubmitDisabled}
               onClick={handleUpdatePattern}
            >
               {updateBillMutation.isPending ? "Carregando..." : "Salvar"}
            </Button>
         </SheetFooter>
      </>
   );
}
