import type { Bill } from "@packages/database/repositories/bill-repository";
import { Button } from "@packages/ui/components/button";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { Textarea } from "@packages/ui/components/textarea";
import { formatDate } from "@packages/utils/date";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import type { FormEvent } from "react";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

export type EditBillFormProps = {
   bill: Bill;
};

const editBillSchema = z.object({
   amount: z.number().min(0.01, "Este campo é obrigatório."),
   description: z.string().min(1, "Este campo é obrigatório."),
   dueDate: z.date(),
   issueDate: z.date().or(z.undefined()),
});

export function EditBillForm({ bill }: EditBillFormProps) {
   const { closeSheet } = useSheet();
   const trpc = useTRPC();

   const updateBillMutation = useMutation(
      trpc.bills.update.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         amount: Number(bill.amount),
         description: bill.description,
         dueDate: bill.dueDate ? new Date(bill.dueDate) : new Date(),
         issueDate: bill.issueDate ? new Date(bill.issueDate) : undefined,
      },
      validators: {
         onSubmit: editBillSchema,
      },
      onSubmit: async ({ value }) => {
         await updateBillMutation.mutateAsync({
            data: {
               amount: value.amount,
               description: value.description,
               dueDate: formatDate(value.dueDate, "YYYY-MM-DD"),
               issueDate: value.issueDate
                  ? formatDate(value.issueDate, "YYYY-MM-DD")
                  : undefined,
            },
            id: bill.id,
         });
      },
   });

   const handleSubmit = (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      form.handleSubmit();
   };

   const isPending = updateBillMutation.isPending;

   return (
      <form className="flex flex-col h-full" onSubmit={handleSubmit}>
         <SheetHeader>
            <SheetTitle>Editar Conta</SheetTitle>
            <SheetDescription>Atualize os detalhes da conta</SheetDescription>
         </SheetHeader>

         <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <FieldGroup>
               <form.Field name="description">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Descrição
                           </FieldLabel>
                           <Textarea
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Digite a descrição"
                              value={field.state.value || ""}
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
               <form.Field name="amount">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Valor</FieldLabel>
                           <MoneyInput
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(value) => {
                                 field.handleChange(value || 0);
                              }}
                              placeholder="0,00"
                              value={field.state.value}
                              valueInCents={false}
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
               <form.Field name="dueDate">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Data de Vencimento
                           </FieldLabel>
                           <DatePicker
                              date={field.state.value}
                              onSelect={(date) =>
                                 field.handleChange(date ?? new Date())
                              }
                              placeholder="Selecione uma data"
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
               <form.Field name="issueDate">
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Data de Emissão
                        </FieldLabel>
                        <DatePicker
                           date={field.state.value}
                           onSelect={(date) => field.handleChange(date)}
                           placeholder="Selecione uma data"
                        />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         </div>

         <SheetFooter className="px-4">
            <form.Subscribe
               selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     className="w-full"
                     disabled={!canSubmit || isSubmitting || isPending}
                     type="submit"
                  >
                     {isPending ? "Carregando..." : "Salvar"}
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </form>
   );
}
