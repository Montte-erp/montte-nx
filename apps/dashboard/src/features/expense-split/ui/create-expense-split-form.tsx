import type { SplitType } from "@packages/database/schemas/expense-splits";
import { translate } from "@packages/localization";
import { of, toDecimal } from "@packages/money";
import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import {
   calculateSplit,
   formatCurrency,
   validateSplit,
} from "../lib/split-calculator";

interface CreateExpenseSplitFormProps {
   teamId?: string;
   transactionId?: string;
   billId?: string;
   defaultAmount?: number;
   defaultDescription?: string;
}

interface ParticipantEntry {
   memberId: string;
   shareValue: number;
   percentageValue: number;
   customAmount: number;
}

const SPLIT_TYPES: { value: SplitType; label: string }[] = [
   { label: "Equal Split", value: "equal" },
   { label: "By Percentage", value: "percentage" },
   { label: "By Shares", value: "shares" },
   { label: "Custom Amounts", value: "amount" },
];

export function CreateExpenseSplitForm({
   teamId,
   transactionId,
   billId,
   defaultAmount = 0,
   defaultDescription = "",
}: CreateExpenseSplitFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();

   const { data: organizationData } = useSuspenseQuery(
      trpc.organization.getActiveOrganizationMembers.queryOptions(),
   );

   const members = organizationData || [];

   const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
   const [splitType, setSplitType] = useState<SplitType>("equal");

   const createMutation = useMutation(
      trpc.expenseSplits.create.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         description: defaultDescription,
         totalAmount: defaultAmount.toString(),
      },
      onSubmit: async ({ value }) => {
         const totalAmount = Number.parseFloat(value.totalAmount);
         if (Number.isNaN(totalAmount) || totalAmount <= 0) {
            return;
         }

         if (participants.length === 0) {
            return;
         }

         const splitResults = calculateSplit(
            totalAmount,
            participants.map((p) => ({
               customAmount: p.customAmount,
               memberId: p.memberId,
               percentageValue: p.percentageValue,
               shareValue: p.shareValue,
            })),
            splitType,
         );

         const validation = validateSplit(totalAmount, splitResults);
         if (!validation.isValid) {
            console.error(validation.message);
            return;
         }

         await createMutation.mutateAsync({
            billId,
            description: value.description,
            participants: splitResults.map((r) => ({
               allocatedAmount: r.allocatedAmount,
               memberId: r.memberId,
               percentageValue: r.percentageValue,
               shareValue: r.shareValue,
            })),
            splitType,
            teamId,
            totalAmount: toDecimal(of(String(totalAmount), "BRL")),
            transactionId,
         });
      },
   });

   const addParticipant = useCallback(
      (memberId: string) => {
         if (participants.some((p) => p.memberId === memberId)) {
            return;
         }
         setParticipants((prev) => [
            ...prev,
            {
               customAmount: 0,
               memberId,
               percentageValue: 0,
               shareValue: 1,
            },
         ]);
      },
      [participants],
   );

   const removeParticipant = useCallback((memberId: string) => {
      setParticipants((prev) => prev.filter((p) => p.memberId !== memberId));
   }, []);

   const updateParticipant = useCallback(
      (memberId: string, field: keyof ParticipantEntry, value: number) => {
         setParticipants((prev) =>
            prev.map((p) =>
               p.memberId === memberId ? { ...p, [field]: value } : p,
            ),
         );
      },
      [],
   );

   const getMemberName = useCallback(
      (memberId: string) => {
         const member = members.find((m) => m.id === memberId);
         return member?.user?.name || member?.user?.email || "Unknown";
      },
      [members],
   );

   const availableMembers = members.filter(
      (m) => !participants.some((p) => p.memberId === m.id),
   );

   const previewSplit = () => {
      const totalAmount = Number.parseFloat(form.state.values.totalAmount);
      if (Number.isNaN(totalAmount) || participants.length === 0) {
         return [];
      }
      return calculateSplit(
         totalAmount,
         participants.map((p) => ({
            customAmount: p.customAmount,
            memberId: p.memberId,
            percentageValue: p.percentageValue,
            shareValue: p.shareValue,
         })),
         splitType,
      );
   };

   const preview = previewSplit();

   return (
      <form
         className="h-full flex flex-col"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <SheetHeader>
            <SheetTitle>Create Expense Split</SheetTitle>
            <SheetDescription>
               Split an expense among team members
            </SheetDescription>
         </SheetHeader>

         <div className="grid gap-4 px-4 flex-1 overflow-y-auto">
            <FieldGroup>
               <form.Field name="totalAmount">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Total Amount</FieldLabel>
                           <Input
                              min="0"
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="0.00"
                              step="0.01"
                              type="number"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="description">
                  {(field) => (
                     <Field>
                        <FieldLabel>
                           {translate("common.form.description.label")}
                        </FieldLabel>
                        <Textarea
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="What is this expense for?"
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <Field>
                  <FieldLabel>Split Type</FieldLabel>
                  <Select
                     onValueChange={(value) => setSplitType(value as SplitType)}
                     value={splitType}
                  >
                     <SelectTrigger>
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent>
                        {SPLIT_TYPES.map((type) => (
                           <SelectItem key={type.value} value={type.value}>
                              {type.label}
                           </SelectItem>
                        ))}
                     </SelectContent>
                  </Select>
               </Field>
            </FieldGroup>

            <div className="space-y-2">
               <div className="flex items-center justify-between">
                  <FieldLabel>Participants</FieldLabel>
                  {availableMembers.length > 0 && (
                     <Select onValueChange={addParticipant}>
                        <SelectTrigger className="w-[180px]">
                           <Plus className="size-4 mr-2" />
                           <span>Add Participant</span>
                        </SelectTrigger>
                        <SelectContent>
                           {availableMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                 {member.user?.name || member.user?.email}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  )}
               </div>

               {participants.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                     Add participants to split the expense
                  </div>
               ) : (
                  <div className="space-y-2">
                     {participants.map((participant) => {
                        const previewItem = preview.find(
                           (p) => p.memberId === participant.memberId,
                        );
                        return (
                           <div
                              className="flex items-center gap-2 p-2 border rounded-md"
                              key={participant.memberId}
                           >
                              <div className="flex-1">
                                 <div className="font-medium text-sm">
                                    {getMemberName(participant.memberId)}
                                 </div>
                                 {previewItem && (
                                    <div className="text-xs text-muted-foreground">
                                       {formatCurrency(
                                          previewItem.allocatedAmount,
                                       )}
                                    </div>
                                 )}
                              </div>

                              {splitType === "percentage" && (
                                 <Input
                                    className="w-20"
                                    max="100"
                                    min="0"
                                    onChange={(e) =>
                                       updateParticipant(
                                          participant.memberId,
                                          "percentageValue",
                                          Number.parseFloat(e.target.value) ||
                                             0,
                                       )
                                    }
                                    placeholder="%"
                                    step="0.01"
                                    type="number"
                                    value={participant.percentageValue}
                                 />
                              )}

                              {splitType === "shares" && (
                                 <Input
                                    className="w-20"
                                    min="1"
                                    onChange={(e) =>
                                       updateParticipant(
                                          participant.memberId,
                                          "shareValue",
                                          Number.parseInt(e.target.value, 10) ||
                                             1,
                                       )
                                    }
                                    placeholder="Shares"
                                    step="1"
                                    type="number"
                                    value={participant.shareValue}
                                 />
                              )}

                              {splitType === "amount" && (
                                 <Input
                                    className="w-24"
                                    min="0"
                                    onChange={(e) =>
                                       updateParticipant(
                                          participant.memberId,
                                          "customAmount",
                                          Number.parseFloat(e.target.value) ||
                                             0,
                                       )
                                    }
                                    placeholder="0.00"
                                    step="0.01"
                                    type="number"
                                    value={participant.customAmount}
                                 />
                              )}

                              <Button
                                 onClick={() =>
                                    removeParticipant(participant.memberId)
                                 }
                                 size="icon"
                                 type="button"
                                 variant="ghost"
                              >
                                 <Trash2 className="size-4 text-destructive" />
                              </Button>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
         </div>

         <SheetFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        createMutation.isPending ||
                        participants.length === 0
                     }
                     type="submit"
                  >
                     Create Split
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </form>
   );
}
