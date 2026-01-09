import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { Button } from "@packages/ui/components/button";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
   Field,
   FieldDescription,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Separator } from "@packages/ui/components/separator";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { formatDate } from "@packages/utils/date";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AmountAnnouncement } from "@/features/transaction/ui/amount-announcement";
import { CategoryAnnouncement } from "@/features/transaction/ui/category-announcement";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type Bill = BillWithRelations;

interface CompleteBillSheetContentProps {
   bill: Bill;
   onClose: () => void;
}

function CompleteBillSheetContent({
   bill,
   onClose,
}: CompleteBillSheetContentProps) {
   const [completionDate, setCompletionDate] = useState(new Date());
   const [bankAccountId, setBankAccountId] = useState(
      bill.bankAccountId || undefined,
   );
   const trpc = useTRPC();
   const queryClient = useQueryClient();

   const { data: bankAccounts = [] } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const isExpense = bill.type === "expense";
   const category = categories.find((c) => c.id === bill.categoryId);

   const completeBillMutation = useMutation(
      trpc.bills.complete.mutationOptions({
         onError: (error) => {
            toast.error(
               error.message || "Erro ao completar conta",
            );
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getById.queryKey({ id: bill.id }),
            });
            queryClient.invalidateQueries({
               queryKey: trpc.bills.getAllPaginated.queryKey(),
            });
            toast.success(
               isExpense
                  ? "Pagamento registrado com sucesso"
                  : "Recebimento registrado com sucesso",
            );
            onClose();
         },
      }),
   );

   const handleComplete = async () => {
      try {
         await completeBillMutation.mutateAsync({
            data: {
               bankAccountId,
               completionDate: formatDate(completionDate, "YYYY-MM-DD"),
            },
            id: bill.id,
         });
      } catch (error) {
         console.error("Failed to complete bill:", error);
      }
   };

   return (
      <div className="flex flex-col h-full">
         <SheetHeader>
            <SheetTitle>
               {isExpense
                  ? "Registrar Pagamento"
                  : "Registrar Recebimento"}
            </SheetTitle>
            <SheetDescription>
               {isExpense
                  ? "Confirme os detalhes do pagamento desta conta"
                  : "Confirme os detalhes do recebimento desta conta"}
            </SheetDescription>
         </SheetHeader>

         <div className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
            {/* Bill Summary Card */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
               <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resumo
               </p>
               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-sm text-muted-foreground">
                        Descrição
                     </span>
                     <span className="font-medium text-sm truncate max-w-[200px]">
                        {bill.description}
                     </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                     <span className="text-sm text-muted-foreground">
                        Vencimento
                     </span>
                     <span className="text-sm">
                        {formatDate(new Date(bill.dueDate), "DD/MM/YYYY")}
                     </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                     <span className="text-sm text-muted-foreground">
                        Valor
                     </span>
                     <AmountAnnouncement
                        amount={Number(bill.amount)}
                        isPositive={!isExpense}
                     />
                  </div>
                  {category && (
                     <>
                        <Separator />
                        <div className="flex items-center justify-between">
                           <span className="text-sm text-muted-foreground">
                              Categoria
                           </span>
                           <CategoryAnnouncement
                              category={{
                                 color: category.color,
                                 icon: category.icon || "Wallet",
                                 name: category.name,
                              }}
                           />
                        </div>
                     </>
                  )}
               </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        {isExpense
                           ? "Data do Pagamento"
                           : "Data do Recebimento"}
                     </FieldLabel>
                     <DatePicker
                        className="w-full"
                        date={completionDate}
                        onSelect={(date) =>
                           setCompletionDate(date || new Date())
                        }
                     />
                  </Field>
               </FieldGroup>

               <FieldGroup>
                  <Field>
                     <FieldLabel>
                        Conta Bancária (Opcional)
                     </FieldLabel>
                     <Select
                        onValueChange={setBankAccountId}
                        value={bankAccountId}
                     >
                        <SelectTrigger>
                           <SelectValue
                              placeholder="Selecione uma conta bancária"
                           />
                        </SelectTrigger>
                        <SelectContent>
                           {bankAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                 {account.name} - {account.bank}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     <FieldDescription>
                        Selecione a conta bancária usada para este {isExpense ? "pagamento" : "recebimento"}
                     </FieldDescription>
                  </Field>
               </FieldGroup>
            </div>
         </div>

         <SheetFooter className="px-4">
            <Button
               className="w-full"
               disabled={completeBillMutation.isPending}
               onClick={handleComplete}
            >
               {completeBillMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
               ) : (
                  <Check className="size-4" />
               )}
               {completeBillMutation.isPending
                  ? "Carregando..."
                  : isExpense
                    ? "Confirmar Pagamento"
                    : "Confirmar Recebimento"}
            </Button>
         </SheetFooter>
      </div>
   );
}

interface CompleteBillDialogProps {
   bill: Bill;
   children: React.ReactNode;
}

export function CompleteBillDialog({
   bill,
   children,
}: CompleteBillDialogProps) {
   const { openSheet, closeSheet } = useSheet();

   const handleOpen = () => {
      openSheet({
         children: (
            <CompleteBillSheetContent bill={bill} onClose={closeSheet} />
         ),
      });
   };

   return <div onClick={handleOpen}>{children}</div>;
}
