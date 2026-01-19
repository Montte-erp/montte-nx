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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/integrations/clients";

type Bill = BillWithRelations;

type MarkAsRecurrentFormProps = {
   bill: Bill;
   onSuccess?: () => void;
};

type RecurrencePattern = "monthly" | "quarterly" | "semiannual" | "annual";

type OccurrenceType = "auto" | "count" | "until-date";

type RecurringSection = "frequency" | "occurrence" | "review";

const FREQUENCY_OPTIONS = [
   "monthly",
   "quarterly",
   "semiannual",
   "annual",
] as const;
const OCCURRENCE_OPTIONS = ["auto", "count", "until-date"] as const;

export function MarkAsRecurrentForm({
   bill,
   onSuccess,
}: MarkAsRecurrentFormProps) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const [activeSection, setActiveSection] =
      useState<RecurringSection>("frequency");
   const [recurrencePattern, setRecurrencePattern] = useState<
      RecurrencePattern | undefined
   >(undefined);
   const [occurrenceType, setOccurrenceType] = useState<
      OccurrenceType | undefined
   >(undefined);
   const [occurrenceCount, setOccurrenceCount] = useState<number>(12);
   const [occurrenceUntilDate, setOccurrenceUntilDate] = useState<
      Date | undefined
   >(undefined);

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

   const occurrenceLabels: Record<string, string> = {
      auto: "Automático",
      count: "Número de vezes",
      "until-date": "Até uma data",
   };

   const occurrenceOptionLabels: Record<
      string,
      { title: string; description: string }
   > = {
      auto: {
         title: "Automático",
         description: "Usa padrão baseado na frequência",
      },
      count: {
         title: "Número de vezes",
         description: "Define quantidade específica",
      },
      "until-date": {
         title: "Até uma data",
         description: "Repete até a data escolhida",
      },
   };

   const createBillMutation = useMutation(
      trpc.bills.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao criar recorrência");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getAllPaginated.queryKey(),
            });
            toast.success("Recorrência criada com sucesso");
            onSuccess?.();
         },
      }),
   );

   const handleSubmit = () => {
      if (!recurrencePattern) return;

      // Final normalization: ensure occurrenceCount is valid (not NaN, >= 1)
      const finalOccurrenceCount =
         occurrenceType === "count"
            ? Number.isNaN(occurrenceCount) || occurrenceCount < 1
               ? 1
               : occurrenceCount
            : undefined;

      createBillMutation.mutate({
         amount: Number(bill.amount),
         bankAccountId: bill.bankAccountId || undefined,
         categoryId: bill.categoryId || undefined,
         counterpartyId: bill.counterpartyId || undefined,
         description: bill.description,
         dueDate: new Date(bill.dueDate),
         interestTemplateId: bill.interestTemplateId || undefined,
         isRecurring: true,
         issueDate: bill.issueDate ? new Date(bill.issueDate) : undefined,
         notes: bill.notes || undefined,
         occurrenceCount: finalOccurrenceCount,
         occurrenceUntilDate:
            occurrenceType === "until-date" && occurrenceUntilDate
               ? occurrenceUntilDate
               : undefined,
         recurrencePattern,
         type: bill.type as "expense" | "income",
      });
   };

   const isSubmitDisabled =
      createBillMutation.isPending ||
      !recurrencePattern ||
      !occurrenceType ||
      (occurrenceType === "until-date" && !occurrenceUntilDate) ||
      (occurrenceType === "count" && occurrenceCount < 1);

   return (
      <>
         <SheetHeader>
            <SheetTitle>Tornar Recorrente</SheetTitle>
            <SheetDescription>
               Configure a recorrência para criar contas automaticamente
            </SheetDescription>
         </SheetHeader>

         <div className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
               {/* Step 1: Frequency */}
               <Collapsible
                  onOpenChange={(open) => {
                     if (open) setActiveSection("frequency");
                     else if (recurrencePattern) setActiveSection("occurrence");
                  }}
                  open={activeSection === "frequency"}
               >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors">
                     <div className="flex items-center gap-3">
                        <div
                           className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                              recurrencePattern
                                 ? "bg-primary text-primary-foreground"
                                 : "bg-muted text-muted-foreground"
                           }`}
                        >
                           {recurrencePattern ? (
                              <Check className="h-3.5 w-3.5" />
                           ) : (
                              "1"
                           )}
                        </div>
                        <div className="text-left">
                           <div className="font-medium">Frequência</div>
                           <div className="text-sm text-muted-foreground">
                              {recurrencePattern &&
                              activeSection !== "frequency"
                                 ? frequencyLabels[recurrencePattern]
                                 : "Escolha com que frequência a conta se repete"}
                           </div>
                        </div>
                     </div>
                     <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                           activeSection === "frequency" ? "rotate-180" : ""
                        }`}
                     />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                     <div className="pt-4">
                        <Choicebox
                           onValueChange={(value) => {
                              setRecurrencePattern(value as RecurrencePattern);
                              setActiveSection("occurrence");
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
                                       {
                                          frequencyOptionLabels[option]
                                             .description
                                       }
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
                     if (open && recurrencePattern)
                        setActiveSection("occurrence");
                     else if (occurrenceType) setActiveSection("review");
                     else if (recurrencePattern) setActiveSection("frequency");
                  }}
                  open={activeSection === "occurrence"}
               >
                  <CollapsibleTrigger
                     className={`flex w-full items-center justify-between rounded-lg border p-4 transition-colors ${
                        recurrencePattern
                           ? "hover:bg-muted/50"
                           : "opacity-50 cursor-not-allowed"
                     }`}
                     disabled={!recurrencePattern}
                  >
                     <div className="flex items-center gap-3">
                        <div
                           className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                              occurrenceType
                                 ? "bg-primary text-primary-foreground"
                                 : "bg-muted text-muted-foreground"
                           }`}
                        >
                           {occurrenceType ? (
                              <Check className="h-3.5 w-3.5" />
                           ) : (
                              "2"
                           )}
                        </div>
                        <div className="text-left">
                           <div className="font-medium">Quantidade</div>
                           <div className="text-sm text-muted-foreground">
                              {occurrenceType &&
                              activeSection !== "occurrence" ? (
                                 <>
                                    {occurrenceLabels[occurrenceType]}
                                    {occurrenceType === "count" &&
                                       ` (${occurrenceCount}x)`}
                                    {occurrenceType === "until-date" &&
                                       occurrenceUntilDate &&
                                       ` (${occurrenceUntilDate.toLocaleDateString("pt-BR")})`}
                                 </>
                              ) : (
                                 "Defina quantas vezes a conta será criada"
                              )}
                           </div>
                        </div>
                     </div>
                     <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                           activeSection === "occurrence" ? "rotate-180" : ""
                        }`}
                     />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                     <div className="pt-4 space-y-4">
                        <Choicebox
                           onValueChange={(value) => {
                              const occ = value as OccurrenceType;
                              setOccurrenceType(occ);
                              if (occ === "auto") {
                                 setActiveSection("review");
                              }
                           }}
                           value={occurrenceType || ""}
                        >
                           {OCCURRENCE_OPTIONS.map((option) => (
                              <ChoiceboxItem
                                 id={`occ-${option}`}
                                 key={option}
                                 value={option}
                              >
                                 <ChoiceboxItemHeader>
                                    <ChoiceboxItemTitle>
                                       {occurrenceOptionLabels[option].title}
                                    </ChoiceboxItemTitle>
                                    <ChoiceboxItemDescription>
                                       {
                                          occurrenceOptionLabels[option]
                                             .description
                                       }
                                    </ChoiceboxItemDescription>
                                 </ChoiceboxItemHeader>
                                 <ChoiceboxIndicator id={`occ-${option}`} />
                              </ChoiceboxItem>
                           ))}
                        </Choicebox>

                        {occurrenceType === "count" && (
                           <div className="space-y-2">
                              <Label>Quantidade de repetições</Label>
                              <Input
                                 max={365}
                                 min={1}
                                 onBlur={() => {
                                    // Normalize NaN or values < 1 to minimum (1)
                                    if (
                                       Number.isNaN(occurrenceCount) ||
                                       occurrenceCount < 1
                                    ) {
                                       setOccurrenceCount(1);
                                    }
                                 }}
                                 onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === "") {
                                       setOccurrenceCount(0);
                                    } else {
                                       const parsed = Number(val);
                                       // Guard against NaN by setting to 0
                                       if (Number.isNaN(parsed)) {
                                          setOccurrenceCount(0);
                                       } else {
                                          setOccurrenceCount(parsed);
                                       }
                                    }
                                 }}
                                 type="number"
                                 value={
                                    occurrenceCount === 0 ? "" : occurrenceCount
                                 }
                              />
                              <Button
                                 className="w-full mt-2"
                                 onClick={() => setActiveSection("review")}
                                 size="sm"
                                 type="button"
                              >
                                 Confirmar
                              </Button>
                           </div>
                        )}

                        {occurrenceType === "until-date" && (
                           <div className="space-y-2">
                              <DatePicker
                                 className="w-full"
                                 date={occurrenceUntilDate}
                                 onSelect={(date) => {
                                    setOccurrenceUntilDate(date);
                                    if (date) {
                                       setActiveSection("review");
                                    }
                                 }}
                              />
                           </div>
                        )}
                     </div>
                  </CollapsibleContent>
               </Collapsible>

               {/* Preview - Shows when all steps are complete */}
               {recurrencePattern &&
                  occurrenceType &&
                  activeSection === "review" && (
                     <Alert>
                        <CalendarCheck className="h-4 w-4" />
                        <AlertTitle>Resumo</AlertTitle>
                        <AlertDescription>
                           {`${frequencyLabels[recurrencePattern]} - ${
                              occurrenceType === "auto"
                                 ? "Automático"
                                 : occurrenceType === "count"
                                   ? `${occurrenceCount}x`
                                   : occurrenceUntilDate?.toLocaleDateString(
                                        "pt-BR",
                                     ) || ""
                           }`}
                        </AlertDescription>
                     </Alert>
                  )}
            </div>
         </div>

         <SheetFooter className="px-4">
            <Button
               className="w-full"
               disabled={isSubmitDisabled}
               onClick={handleSubmit}
            >
               {createBillMutation.isPending
                  ? "Carregando..."
                  : "Criar Recorrência"}
            </Button>
         </SheetFooter>
      </>
   );
}
