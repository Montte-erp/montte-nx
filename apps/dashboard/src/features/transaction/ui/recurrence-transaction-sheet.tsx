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
   Collapsible,
   CollapsibleContent,
   CollapsibleTrigger,
} from "@packages/ui/components/collapsible";
import { DatePicker } from "@packages/ui/components/date-picker";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import {
   generateFutureDatesUntil,
   getDefaultFutureOccurrences,
   type RecurrencePattern,
} from "@packages/utils/recurrence";
import { useMutation } from "@tanstack/react-query";
import { CalendarCheck, Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type RecurrenceTransactionSheetProps = {
   transaction: {
      amount: string;
      bankAccountId: string | null;
      categoryId: string | undefined;
      description: string;
      type: "expense" | "income" | "transfer";
   };
};

type FrequencyOption = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
type OccurrenceOption = "auto" | "count" | "until-date";
type Step = "frequency" | "occurrence" | "review";

const frequencyOptions: FrequencyOption[] = [
   "daily",
   "weekly",
   "biweekly",
   "monthly",
   "yearly",
];

const occurrenceOptions: OccurrenceOption[] = ["auto", "count", "until-date"];

const frequencyToPattern: Record<FrequencyOption, RecurrencePattern> = {
   biweekly: "biweekly",
   daily: "daily",
   monthly: "monthly",
   weekly: "weekly",
   yearly: "annual",
};

const frequencyLabels: Record<FrequencyOption, string> = {
   biweekly: "Quinzenal",
   daily: "Diario",
   monthly: "Mensal",
   weekly: "Semanal",
   yearly: "Anual",
};

const occurrenceLabels: Record<OccurrenceOption, string> = {
   auto: "Automatico",
   count: "Numero de vezes",
   "until-date": "Ate uma data",
};

export function RecurrenceTransactionSheet({
   transaction,
}: RecurrenceTransactionSheetProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();

   const [startDate, setStartDate] = useState<Date>(new Date());
   const [frequency, setFrequency] = useState<FrequencyOption | null>(null);
   const [occurrenceOption, setOccurrenceOption] =
      useState<OccurrenceOption | null>(null);
   const [occurrenceCount, setOccurrenceCount] = useState<number>(12);
   const [untilDate, setUntilDate] = useState<Date | undefined>(undefined);
   const [currentStep, setCurrentStep] = useState<Step>("frequency");

   const createBillMutation = useMutation(trpc.bills.create.mutationOptions());

   const recurrencePattern = frequency ? frequencyToPattern[frequency] : null;

   const previewCount = useMemo(() => {
      if (!recurrencePattern || !occurrenceOption) return 0;

      if (occurrenceOption === "auto") {
         return getDefaultFutureOccurrences(recurrencePattern) + 1;
      }
      if (occurrenceOption === "count") {
         return occurrenceCount + 1;
      }
      if (occurrenceOption === "until-date" && untilDate) {
         return (
            generateFutureDatesUntil(startDate, recurrencePattern, untilDate)
               .length + 1
         );
      }
      return 1;
   }, [
      recurrencePattern,
      occurrenceOption,
      occurrenceCount,
      untilDate,
      startDate,
   ]);

   const handleFrequencySelect = (value: string) => {
      setFrequency(value as FrequencyOption);
      setCurrentStep("occurrence");
   };

   const handleOccurrenceSelect = (value: string) => {
      setOccurrenceOption(value as OccurrenceOption);
      if (value !== "count" && value !== "until-date") {
         setCurrentStep("review");
      }
   };

   const handleOccurrenceConfirm = () => {
      setCurrentStep("review");
   };

   const handleSubmit = async () => {
      if (!recurrencePattern || !occurrenceOption) return;

      const billType =
         transaction.type === "transfer" ? "expense" : transaction.type;

      await createBillMutation.mutateAsync({
         amount: Math.abs(Number(transaction.amount)),
         bankAccountId: transaction.bankAccountId || undefined,
         categoryId: transaction.categoryId,
         description: transaction.description,
         dueDate: startDate,
         isRecurring: true,
         recurrencePattern,
         type: billType,
         ...(occurrenceOption === "count" && { occurrenceCount }),
         ...(occurrenceOption === "until-date" &&
            untilDate && { occurrenceUntilDate: untilDate }),
      });

      toast.success("Recorrencia criada com sucesso");
      closeSheet();
   };

   const isSubmitDisabled =
      createBillMutation.isPending ||
      !frequency ||
      !occurrenceOption ||
      currentStep !== "review" ||
      (occurrenceOption === "count" && occurrenceCount < 1) ||
      (occurrenceOption === "until-date" && !untilDate) ||
      (occurrenceOption === "until-date" &&
         untilDate &&
         untilDate <= startDate);

   return (
      <>
         <SheetHeader>
            <SheetTitle>Criar Recorrencia</SheetTitle>
            <SheetDescription>
               Configure a frequencia e duracao da recorrencia para criar contas
               futuras automaticamente.
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
               {/* Start Date - Always visible */}
               <div className="space-y-2">
                  <Label>Data Inicial</Label>
                  <DatePicker
                     className="w-full"
                     date={startDate}
                     onSelect={(date) => date && setStartDate(date)}
                  />
               </div>

               {/* Step 1: Frequency */}
               <Collapsible
                  onOpenChange={(open) => {
                     if (open) {
                        setCurrentStep("frequency");
                     } else if (frequency) {
                        setCurrentStep("occurrence");
                     }
                  }}
                  open={currentStep === "frequency"}
               >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                     <div className="flex items-center gap-3">
                        <div
                           className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                              frequency
                                 ? "bg-primary text-primary-foreground"
                                 : "bg-muted text-muted-foreground"
                           }`}
                        >
                           {frequency ? <Check className="h-3.5 w-3.5" /> : "1"}
                        </div>
                        <div className="text-left">
                           <div className="font-medium">Frequencia</div>
                           <div className="text-sm text-muted-foreground">
                              {frequency && currentStep !== "frequency"
                                 ? frequencyLabels[frequency]
                                 : "Escolha com que frequencia a conta se repete"}
                           </div>
                        </div>
                     </div>
                     <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                           currentStep === "frequency" ? "rotate-180" : ""
                        }`}
                     />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                     <div className="pt-4">
                        <Choicebox
                           onValueChange={handleFrequencySelect}
                           value={frequency || ""}
                        >
                           {frequencyOptions.map((option) => (
                              <ChoiceboxItem
                                 id={`freq-${option}`}
                                 key={option}
                                 value={option}
                              >
                                 <ChoiceboxItemHeader>
                                    <ChoiceboxItemTitle>
                                       {frequencyLabels[option]}
                                    </ChoiceboxItemTitle>
                                    <ChoiceboxItemDescription>
                                       {getFrequencyDescription(option)}
                                    </ChoiceboxItemDescription>
                                 </ChoiceboxItemHeader>
                                 <ChoiceboxIndicator id={`freq-${option}`} />
                              </ChoiceboxItem>
                           ))}
                        </Choicebox>
                     </div>
                  </CollapsibleContent>
               </Collapsible>

               {/* Step 2: Occurrence */}
               <Collapsible
                  onOpenChange={(open) => {
                     if (open && frequency) {
                        setCurrentStep("occurrence");
                     } else if (occurrenceOption) {
                        setCurrentStep("review");
                     } else if (frequency) {
                        setCurrentStep("frequency");
                     }
                  }}
                  open={currentStep === "occurrence"}
               >
                  <CollapsibleTrigger
                     className={`flex w-full items-center justify-between rounded-lg border p-4 transition-colors ${
                        frequency
                           ? "hover:bg-muted/50"
                           : "opacity-50 cursor-not-allowed"
                     }`}
                     disabled={!frequency}
                  >
                     <div className="flex items-center gap-3">
                        <div
                           className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                              occurrenceOption
                                 ? "bg-primary text-primary-foreground"
                                 : "bg-muted text-muted-foreground"
                           }`}
                        >
                           {occurrenceOption ? (
                              <Check className="h-3.5 w-3.5" />
                           ) : (
                              "2"
                           )}
                        </div>
                        <div className="text-left">
                           <div className="font-medium">Duracao</div>
                           <div className="text-sm text-muted-foreground">
                              {occurrenceOption &&
                              currentStep !== "occurrence" ? (
                                 <>
                                    {occurrenceLabels[occurrenceOption]}
                                    {occurrenceOption === "count" &&
                                       ` (${occurrenceCount}x)`}
                                    {occurrenceOption === "until-date" &&
                                       untilDate &&
                                       ` (${untilDate.toLocaleDateString("pt-BR")})`}
                                 </>
                              ) : (
                                 "Defina quantas vezes a conta sera criada"
                              )}
                           </div>
                        </div>
                     </div>
                     <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                           currentStep === "occurrence" ? "rotate-180" : ""
                        }`}
                     />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                     <div className="pt-4 space-y-4">
                        <Choicebox
                           onValueChange={handleOccurrenceSelect}
                           value={occurrenceOption || ""}
                        >
                           {occurrenceOptions.map((option) => (
                              <ChoiceboxItem
                                 id={`occ-${option}`}
                                 key={option}
                                 value={option}
                              >
                                 <ChoiceboxItemHeader>
                                    <ChoiceboxItemTitle>
                                       {occurrenceLabels[option]}
                                    </ChoiceboxItemTitle>
                                    <ChoiceboxItemDescription>
                                       {getOccurrenceDescription(option)}
                                    </ChoiceboxItemDescription>
                                 </ChoiceboxItemHeader>
                                 <ChoiceboxIndicator id={`occ-${option}`} />
                              </ChoiceboxItem>
                           ))}
                        </Choicebox>

                        {occurrenceOption === "count" && (
                           <div className="space-y-2">
                              <Label>Numero de repeticoes</Label>
                              <Input
                                 max={365}
                                 min={1}
                                 onChange={(e) =>
                                    setOccurrenceCount(
                                       Number(e.target.value) || 1,
                                    )
                                 }
                                 type="number"
                                 value={occurrenceCount}
                              />
                              <Button
                                 className="w-full mt-2"
                                 onClick={handleOccurrenceConfirm}
                                 size="sm"
                              >
                                 Confirmar
                              </Button>
                           </div>
                        )}

                        {occurrenceOption === "until-date" && (
                           <div className="space-y-2">
                              <DatePicker
                                 className="w-full"
                                 date={untilDate}
                                 onSelect={(date) => {
                                    setUntilDate(date);
                                    if (date) {
                                       setCurrentStep("review");
                                    }
                                 }}
                              />
                           </div>
                        )}
                     </div>
                  </CollapsibleContent>
               </Collapsible>

               {/* Preview - Shows when all steps are complete */}
               {frequency && occurrenceOption && currentStep === "review" && (
                  <Alert>
                     <CalendarCheck className="h-4 w-4" />
                     <AlertTitle>
                        {previewCount} contas serao criadas
                     </AlertTitle>
                     <AlertDescription>
                        {frequencyLabels[frequency]} a partir de{" "}
                        {startDate.toLocaleDateString("pt-BR")}
                     </AlertDescription>
                  </Alert>
               )}
            </div>
         </div>

         <SheetFooter>
            <Button
               className="w-full"
               disabled={isSubmitDisabled}
               onClick={handleSubmit}
            >
               {createBillMutation.isPending
                  ? "Carregando..."
                  : "Criar Recorrencia"}
            </Button>
         </SheetFooter>
      </>
   );
}

function getFrequencyDescription(option: FrequencyOption): string {
   switch (option) {
      case "daily":
         return "Repete todos os dias";
      case "weekly":
         return "Repete toda semana";
      case "biweekly":
         return "Repete a cada duas semanas";
      case "monthly":
         return "Repete todo mes";
      case "yearly":
         return "Repete todo ano";
   }
}

function getOccurrenceDescription(option: OccurrenceOption): string {
   switch (option) {
      case "auto":
         return "O sistema define automaticamente baseado na frequencia";
      case "count":
         return "Defina quantas vezes a conta sera criada";
      case "until-date":
         return "Cria contas ate uma data especifica";
   }
}
