import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
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
import { Spinner } from "@packages/ui/components/spinner";
import type { BaseFormState } from "@tanstack/react-form";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { Suspense } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { BillInstallmentPreview } from "./bill-installment-preview";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREQUENCY_OPTIONS = [
   { value: "daily", label: "Diária" },
   { value: "weekly", label: "Semanal" },
   { value: "biweekly", label: "Quinzenal" },
   { value: "monthly", label: "Mensal" },
   { value: "quarterly", label: "Trimestral" },
   { value: "yearly", label: "Anual" },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionMode = "installment" | "recurring";
type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

interface BillFromTransactionCredenzaProps {
   transactionId: string;
   transactionName: string;
   transactionAmount: string;
   transactionDate: string;
   transactionType: "income" | "expense" | "transfer";
   bankAccountId?: string | null;
   categoryId?: string | null;
   mode: ActionMode;
   onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addMonths(dateStr: string, months: number): string {
   const d = new Date(`${dateStr}T00:00:00`);
   d.setMonth(d.getMonth() + months);
   return d.toISOString().substring(0, 10);
}

function deriveBillType(
   transactionType: "income" | "expense" | "transfer",
): "payable" | "receivable" {
   if (transactionType === "income") return "receivable";
   return "payable";
}

function buildInstallmentItems(amount: string, count: number, dueDate: string) {
   if (!amount || !count || count < 2 || !dueDate) return [];
   const totalAmount = Number(amount);
   if (Number.isNaN(totalAmount) || totalAmount <= 0) return [];

   return Array.from({ length: count }, (_, i) => ({
      index: i + 1,
      dueDate: addMonths(dueDate, i),
      amount: (totalAmount / count).toFixed(2),
   }));
}

// ---------------------------------------------------------------------------
// Inner component
// ---------------------------------------------------------------------------

function BillFromTransactionCredenzaInner({
   transactionId,
   transactionName,
   transactionAmount,
   transactionDate,
   transactionType,
   bankAccountId,
   categoryId,
   mode,
   onSuccess,
}: BillFromTransactionCredenzaProps) {
   const billType = deriveBillType(transactionType);

   // First due date = transactionDate + 1 month
   const firstDueDate = addMonths(transactionDate, 1);

   const createFromTransactionMutation = useMutation(
      orpc.bills.createFromTransaction.mutationOptions({
         onSuccess: () => {
            toast.success(
               mode === "installment"
                  ? "Parcelas criadas com sucesso!"
                  : "Transação recorrente criada com sucesso!",
            );
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar conta.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         name: transactionName,
         installmentCount: 2,
         frequency: "monthly" as Frequency,
         windowMonths: 3,
      },
      onSubmit: async ({ value }) => {
         await createFromTransactionMutation.mutateAsync({
            transactionId,
            bill: {
               type: billType,
               name: value.name.trim(),
               amount: transactionAmount,
               dueDate: firstDueDate,
               bankAccountId: bankAccountId ?? null,
               categoryId: categoryId ?? null,
            },
            installment:
               mode === "installment"
                  ? {
                       mode: "equal",
                       count: value.installmentCount,
                    }
                  : undefined,
            recurrence:
               mode === "recurring"
                  ? {
                       frequency: value.frequency,
                       windowMonths: value.windowMonths,
                    }
                  : undefined,
         });
      },
   });

   // Live installment preview items
   const formValues = useStore(
      form.baseStore as never,
      (
         state: BaseFormState<{
            name: string;
            installmentCount: number;
            frequency: Frequency;
            windowMonths: number;
         }>,
      ) => state.values,
   );
   const previewItems =
      mode === "installment"
         ? buildInstallmentItems(
              transactionAmount,
              formValues.installmentCount,
              firstDueDate,
           )
         : [];

   const title =
      mode === "installment"
         ? "Parcelar Transação"
         : "Criar Transação Recorrente";

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>{title}</CredenzaTitle>
            <CredenzaDescription>{transactionName}</CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <form
               id="bill-from-transaction-form"
               onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
               }}
            >
               <FieldGroup>
                  {/* Name */}
                  <form.Field name="name">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel>Nome</FieldLabel>
                              <Input
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>

                  {/* Installment mode fields */}
                  {mode === "installment" && (
                     <>
                        <form.Field name="installmentCount">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Número de parcelas</FieldLabel>
                                 <Input
                                    min={2}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                       field.handleChange(
                                          Number.parseInt(e.target.value, 10) ||
                                             2,
                                       )
                                    }
                                    type="number"
                                    value={field.state.value}
                                 />
                                 <FieldError errors={field.state.meta.errors} />
                              </Field>
                           )}
                        </form.Field>

                        {previewItems.length > 0 && (
                           <BillInstallmentPreview items={previewItems} />
                        )}
                     </>
                  )}

                  {/* Recurring mode fields */}
                  {mode === "recurring" && (
                     <>
                        <form.Field name="frequency">
                           {(field) => (
                              <Field>
                                 <FieldLabel>Frequência</FieldLabel>
                                 <Select
                                    onValueChange={(v) =>
                                       field.handleChange(v as Frequency)
                                    }
                                    value={field.state.value}
                                 >
                                    <SelectTrigger>
                                       <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                       {FREQUENCY_OPTIONS.map((opt) => (
                                          <SelectItem
                                             key={opt.value}
                                             value={opt.value}
                                          >
                                             {opt.label}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              </Field>
                           )}
                        </form.Field>

                        <form.Field name="windowMonths">
                           {(field) => (
                              <Field>
                                 <FieldLabel>
                                    Gerar contas para quantos meses?
                                 </FieldLabel>
                                 <Input
                                    max={12}
                                    min={1}
                                    onBlur={field.handleBlur}
                                    onChange={(e) =>
                                       field.handleChange(
                                          Number.parseInt(e.target.value, 10) ||
                                             1,
                                       )
                                    }
                                    type="number"
                                    value={field.state.value}
                                 />
                                 <FieldError errors={field.state.meta.errors} />
                              </Field>
                           )}
                        </form.Field>
                     </>
                  )}
               </FieldGroup>
            </form>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        createFromTransactionMutation.isPending
                     }
                     form="bill-from-transaction-form"
                     type="submit"
                  >
                     {(state.isSubmitting ||
                        createFromTransactionMutation.isPending) && (
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

// ---------------------------------------------------------------------------
// Public export (with Suspense boundary)
// ---------------------------------------------------------------------------

export function BillFromTransactionCredenza(
   props: BillFromTransactionCredenzaProps,
) {
   return (
      <Suspense fallback={null}>
         <BillFromTransactionCredenzaInner {...props} />
      </Suspense>
   );
}
