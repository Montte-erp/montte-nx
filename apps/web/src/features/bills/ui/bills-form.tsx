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
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { BillRow } from "./bills-columns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BillFormProps {
   bill: BillRow;
   onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Inner component (reads suspense data)
// ---------------------------------------------------------------------------

function BillFormInner({ bill, onSuccess }: BillFormProps) {
   const today = new Date().toISOString().substring(0, 10);

   const { data: accounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const categories = categoriesResult.data;

   const updateMutation = useMutation(
      orpc.bills.update.mutationOptions({
         onSuccess: () => {
            toast.success("Conta atualizada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar conta.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         type: bill.type as "payable" | "receivable",
         name: bill.name ?? "",
         amount: bill.amount ?? "",
         dueDate: bill.dueDate ?? today,
         bankAccountId: bill.bankAccount?.id ?? "",
         categoryId: bill.category?.id ?? "",
         description: "",
      },
      onSubmit: async ({ value }) => {
         await updateMutation.mutateAsync({
            id: bill.id,
            type: value.type,
            name: value.name.trim(),
            amount: value.amount,
            dueDate: value.dueDate,
            bankAccountId: value.bankAccountId || null,
            categoryId: value.categoryId || null,
            description: value.description?.trim() || null,
         });
      },
   });

   const isPending = updateMutation.isPending;

   return (
      <form
         className="h-full flex flex-col"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>Editar Conta</CredenzaTitle>
            <CredenzaDescription>
               Atualize as informações da conta.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            <FieldGroup>
               {/* Type */}
               <form.Field name="type">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Tipo</FieldLabel>
                           <Select
                              onValueChange={(v) =>
                                 field.handleChange(
                                    v as "payable" | "receivable",
                                 )
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="payable">
                                    A Pagar
                                 </SelectItem>
                                 <SelectItem value="receivable">
                                    A Receber
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Name */}
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Nome</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Aluguel, Energia Elétrica"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Amount */}
               <form.Field name="amount">
                  {(field) => (
                     <Field>
                        <FieldLabel>Valor</FieldLabel>
                        <MoneyInput
                           onChange={(v) =>
                              field.handleChange(
                                 v !== undefined ? String(v / 100) : "",
                              )
                           }
                           value={
                              field.state.value
                                 ? Math.round(Number(field.state.value) * 100)
                                 : 0
                           }
                           valueInCents={true}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               </form.Field>

               {/* Due Date */}
               <form.Field name="dueDate">
                  {(field) => (
                     <Field>
                        <FieldLabel>Data de Vencimento</FieldLabel>
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
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               </form.Field>

               {/* Bank Account */}
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
                                 <SelectValue placeholder="Selecione uma conta (opcional)" />
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

               {/* Category */}
               <form.Subscribe selector={(s) => s.values.type}>
                  {(billType) => {
                     const categoryType =
                        billType === "receivable" ? "income" : "expense";
                     const filtered = categories.filter(
                        (cat) => !cat.type || cat.type === categoryType,
                     );
                     if (filtered.length === 0) return null;
                     return (
                        <form.Field name="categoryId">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Categoria</FieldLabel>
                                 <Select
                                    onValueChange={field.handleChange}
                                    value={field.state.value}
                                 >
                                    <SelectTrigger>
                                       <SelectValue placeholder="Selecione uma categoria (opcional)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {filtered.map((cat) => (
                                          <SelectItem
                                             key={cat.id}
                                             value={cat.id}
                                          >
                                             {cat.name}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </Field>
                           )}
                        </form.Field>
                     );
                  }}
               </form.Subscribe>

               {/* Description */}
               <form.Field name="description">
                  {(field) => (
                     <Field>
                        <FieldLabel>Descrição (opcional)</FieldLabel>
                        <Textarea
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Observações sobre esta conta..."
                           rows={2}
                           value={field.state.value}
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit || state.isSubmitting || isPending
                     }
                     type="submit"
                  >
                     {(state.isSubmitting || isPending) && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     Salvar alterações
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

// ---------------------------------------------------------------------------
// Public export (with Suspense boundary)
// ---------------------------------------------------------------------------

export function BillForm(props: BillFormProps) {
   return (
      <Suspense fallback={null}>
         <BillFormInner {...props} />
      </Suspense>
   );
}
