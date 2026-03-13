import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { BillRow } from "./bills-columns";

interface BillPayCredenzaProps {
   bill: BillRow;
   onSuccess: () => void;
}

function BillPayCredenzaInner({ bill, onSuccess }: BillPayCredenzaProps) {
   const { data: accounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const payMutation = useMutation(
      orpc.bills.pay.mutationOptions({
         onSuccess: () => {
            toast.success(
               bill.type === "payable"
                  ? "Conta paga com sucesso!"
                  : "Recebimento registrado!",
            );
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao registrar pagamento.");
         },
      }),
   );

   const today = new Date().toISOString().substring(0, 10);
   const defaultBankAccountId = bill.bankAccount?.id ?? "";

   const form = useForm({
      defaultValues: {
         paymentType: "total" as "total" | "partial",
         amount: bill.amount,
         date: today,
         bankAccountId: defaultBankAccountId,
      },
      onSubmit: async ({ value }) => {
         await payMutation.mutateAsync({
            id: bill.id,
            amount: value.amount,
            date: value.date,
            bankAccountId: value.bankAccountId || undefined,
            paymentType: value.paymentType,
         });
      },
   });

   const title =
      bill.type === "payable" ? "Registrar Pagamento" : "Registrar Recebimento";

   const isPayable = bill.type === "payable";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{title}</CredenzaTitle>
            <CredenzaDescription>{bill.name}</CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody>
            <form
               id="bill-pay-form"
               onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
               }}
            >
               <FieldGroup>
                  <form.Field name="paymentType">
                     {(field) => (
                        <Field>
                           <FieldLabel>
                              {isPayable
                                 ? "Tipo de Pagamento"
                                 : "Tipo de Recebimento"}
                           </FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 const payType = v as "total" | "partial";
                                 field.handleChange(payType);
                                 if (payType === "total") {
                                    form.setFieldValue("amount", bill.amount);
                                 }
                              }}
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="total">
                                    {isPayable
                                       ? "Pagamento Total"
                                       : "Recebimento Total"}
                                 </SelectItem>
                                 <SelectItem value="partial">
                                    {isPayable
                                       ? "Pagamento Parcial"
                                       : "Recebimento Parcial"}
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
                  <form.Field
                     name="amount"
                     validators={{
                        onChange: ({ value, fieldApi }) => {
                           const payType =
                              fieldApi.form.getFieldValue("paymentType");
                           if (payType === "partial") {
                              const numValue = Number(value);
                              const billAmount = Number(bill.amount);
                              if (numValue >= billAmount) {
                                 return "Valor deve ser menor que o valor da conta.";
                              }
                           }
                           return undefined;
                        },
                     }}
                  >
                     {(field) => (
                        <Field>
                           <FieldLabel>Valor</FieldLabel>
                           <form.Subscribe
                              selector={(s) => s.values.paymentType}
                           >
                              {(paymentType) => (
                                 <MoneyInput
                                    disabled={paymentType === "total"}
                                    onChange={(v) =>
                                       field.handleChange(
                                          v !== undefined
                                             ? String(v / 100)
                                             : "",
                                       )
                                    }
                                    value={
                                       field.state.value
                                          ? Math.round(
                                               Number(field.state.value) * 100,
                                            )
                                          : 0
                                    }
                                    valueInCents={true}
                                 />
                              )}
                           </form.Subscribe>
                           <FieldError
                              errors={field.state.meta.errors.map((e) =>
                                 typeof e === "string" ? { message: e } : e,
                              )}
                           />
                        </Field>
                     )}
                  </form.Field>
                  <form.Field name="date">
                     {(field) => (
                        <Field>
                           <FieldLabel>Data do Pagamento</FieldLabel>
                           <DatePicker
                              date={
                                 field.state.value
                                    ? new Date(`${field.state.value}T00:00:00`)
                                    : undefined
                              }
                              onSelect={(d) =>
                                 field.handleChange(
                                    d?.toISOString().substring(0, 10) ?? today,
                                 )
                              }
                           />
                        </Field>
                     )}
                  </form.Field>
                  {accounts.length > 0 && (
                     <form.Field name="bankAccountId">
                        {(field) => (
                           <Field>
                              <FieldLabel>Conta Bancária</FieldLabel>
                              <Select
                                 onValueChange={field.handleChange}
                                 value={field.state.value}
                              >
                                 <SelectTrigger>
                                    <SelectValue placeholder="Selecione uma conta" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    {accounts.map((acc) => (
                                       <SelectItem key={acc.id} value={acc.id}>
                                          {acc.name}
                                       </SelectItem>
                                    ))}
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </form.Field>
                  )}
               </FieldGroup>
            </form>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe selector={(state) => state}>
               {(state) => (
                  <Button
                     disabled={!state.canSubmit || payMutation.isPending}
                     form="bill-pay-form"
                     type="submit"
                  >
                     {payMutation.isPending && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     Confirmar
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </>
   );
}

export function BillPayCredenza(props: BillPayCredenzaProps) {
   return (
      <Suspense fallback={null}>
         <BillPayCredenzaInner {...props} />
      </Suspense>
   );
}
