import dayjs from "dayjs";
import { Button } from "@packages/ui/components/button";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
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
import { Skeleton } from "@packages/ui/components/skeleton";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useStore } from "@tanstack/react-store";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { BillInstallmentPreview } from "./bill-installment-preview";

const FREQUENCY_OPTIONS = [
   { value: "daily", label: "Diária" },
   { value: "weekly", label: "Semanal" },
   { value: "biweekly", label: "Quinzenal" },
   { value: "monthly", label: "Mensal" },
   { value: "quarterly", label: "Trimestral" },
   { value: "yearly", label: "Anual" },
] as const;

type ActionMode = "installment" | "recurring";
type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

interface BillFromTransactionDialogStackProps {
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

function addMonths(dateStr: string, months: number): string {
   return dayjs(dateStr).add(months, "month").format("YYYY-MM-DD");
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

function BillFromTransactionDialogStackInner({
   transactionId,
   transactionName,
   transactionAmount,
   transactionDate,
   transactionType,
   bankAccountId,
   categoryId,
   mode,
   onSuccess,
}: BillFromTransactionDialogStackProps) {
   const billType = deriveBillType(transactionType);

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

   const formValues = useStore(
      form.baseStore as never,
      (state: any) => state.values,
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
      <DialogStackContent index={0}>
         <DialogStackHeader>
            <DialogStackTitle>{title}</DialogStackTitle>
            <DialogStackDescription>{transactionName}</DialogStackDescription>
         </DialogStackHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4">
            <form
               id="bill-from-transaction-form"
               onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
               }}
            >
               <FieldGroup>
                  <form.Field
                     name="name"
                     children={(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                              <Input
                                 id={field.name}
                                 name={field.name}
                                 aria-invalid={isInvalid}
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
                  />

                  {mode === "installment" && (
                     <>
                        <form.Field
                           name="installmentCount"
                           children={(field) => {
                              const isInvalid =
                                 field.state.meta.isTouched &&
                                 field.state.meta.errors.length > 0;
                              return (
                                 <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>
                                       Número de parcelas
                                    </FieldLabel>
                                    <Input
                                       id={field.name}
                                       name={field.name}
                                       aria-invalid={isInvalid}
                                       min={2}
                                       onBlur={field.handleBlur}
                                       onChange={(e) =>
                                          field.handleChange(
                                             Number.parseInt(
                                                e.target.value,
                                                10,
                                             ) || 2,
                                          )
                                       }
                                       type="number"
                                       value={field.state.value}
                                    />
                                    <FieldError
                                       errors={field.state.meta.errors}
                                    />
                                 </Field>
                              );
                           }}
                        />

                        {previewItems.length > 0 && (
                           <BillInstallmentPreview items={previewItems} />
                        )}
                     </>
                  )}

                  {mode === "recurring" && (
                     <>
                        <form.Field
                           name="frequency"
                           children={(field) => (
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
                        />

                        <form.Field
                           name="windowMonths"
                           children={(field) => {
                              const isInvalid =
                                 field.state.meta.isTouched &&
                                 field.state.meta.errors.length > 0;
                              return (
                                 <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>
                                       Gerar contas para quantos meses?
                                    </FieldLabel>
                                    <Input
                                       id={field.name}
                                       name={field.name}
                                       aria-invalid={isInvalid}
                                       max={12}
                                       min={1}
                                       onBlur={field.handleBlur}
                                       onChange={(e) =>
                                          field.handleChange(
                                             Number.parseInt(
                                                e.target.value,
                                                10,
                                             ) || 1,
                                          )
                                       }
                                       type="number"
                                       value={field.state.value}
                                    />
                                    <FieldError
                                       errors={field.state.meta.errors}
                                    />
                                 </Field>
                              );
                           }}
                        />
                     </>
                  )}
               </FieldGroup>
            </form>
         </div>

         <div className="border-t px-4 py-4">
            <form.Subscribe selector={(state) => state}>
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
         </div>
      </DialogStackContent>
   );
}

function BillFromTransactionDialogSkeleton() {
   return (
      <div className="flex flex-col gap-4 p-4">
         <Skeleton className="h-4 w-32" />
         <Skeleton className="h-10 w-full" />
         <Skeleton className="h-4 w-24" />
         <Skeleton className="h-10 w-full" />
      </div>
   );
}

export function BillFromTransactionDialogStack(
   props: BillFromTransactionDialogStackProps,
) {
   return (
      <ErrorBoundary
         FallbackComponent={createErrorFallback({
            errorTitle: "Erro ao carregar transação",
         })}
      >
         <Suspense fallback={<BillFromTransactionDialogSkeleton />}>
            <BillFromTransactionDialogStackInner {...props} />
         </Suspense>
      </ErrorBoundary>
   );
}
