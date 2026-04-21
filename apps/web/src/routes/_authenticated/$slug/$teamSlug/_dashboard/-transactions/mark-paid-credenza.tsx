import { Button } from "@packages/ui/components/button";
import type { ComboboxOption } from "@packages/ui/components/combobox";
import { Combobox } from "@packages/ui/components/combobox";
import {
   CredenzaBody,
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
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { toast } from "sonner";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";

interface MarkPaidCredenzaProps {
   ids: string[];
   onSuccess: () => void;
}

const requiredDateSchema = z
   .any()
   .refine((v) => v instanceof Date && !Number.isNaN(v.getTime()), {
      message: "Campo obrigatório.",
   });

export function MarkPaidCredenza({ ids, onSuccess }: MarkPaidCredenzaProps) {
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const markBulk = useMutation(
      orpc.transactions.bulkMarkAsPaid.mutationOptions(),
   );

   const form = useForm({
      defaultValues: {
         paidDate: dayjs().hour(12).minute(0).second(0).toDate() as Date,
         bankAccountId: "",
      },
      onSubmit: async ({ value }) => {
         const paidDate = dayjs(value.paidDate).format("YYYY-MM-DD");
         const bankAccountId = value.bankAccountId || null;
         await markBulk.mutateAsync({ ids, paidDate, bankAccountId });
         toast.success(
            ids.length === 1
               ? "Lançamento marcado como pago."
               : `${ids.length} lançamentos marcados como pagos.`,
         );
         onSuccess();
      },
   });

   const options: ComboboxOption[] = bankAccounts.map((a) => ({
      value: a.id,
      label: a.name,
   }));

   return (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>Marcar lançamentos como pagos</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="paidDate"
                  validators={{ onSubmit: requiredDateSchema }}
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>
                              Data do pagamento{" "}
                              <span className="text-destructive">*</span>
                           </FieldLabel>
                           <DatePicker
                              className="w-full"
                              date={field.state.value}
                              onSelect={(d) => field.handleChange(d as Date)}
                              placeholder="Selecione"
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               />
               <form.Field
                  name="bankAccountId"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Conta bancária</FieldLabel>
                        <Combobox
                           className="w-full"
                           emptyMessage="Nenhuma conta cadastrada."
                           onValueChange={field.handleChange}
                           options={options}
                           placeholder="Selecione a conta (opcional)..."
                           searchPlaceholder="Buscar conta..."
                           value={field.state.value}
                        />
                     </Field>
                  )}
               />
            </FieldGroup>
         </CredenzaBody>
         <CredenzaFooter>
            <Button
               className="w-full gap-2"
               disabled={markBulk.isPending}
               type="submit"
            >
               {markBulk.isPending ? <Spinner className="size-4" /> : null}
               Confirmar pagamento
            </Button>
         </CredenzaFooter>
      </form>
   );
}
