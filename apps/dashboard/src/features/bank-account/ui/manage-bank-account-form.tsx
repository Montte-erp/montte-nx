import type { BankAccount } from "@packages/database/repositories/bank-account-repository";
import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldDescription,
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
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useCallback, useMemo } from "react";
import { z } from "zod";
import { BankAccountCombobox } from "@/features/bank-account/ui/bank-account-combobox";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type ManageBankAccountFormProps = {
   bankAccount?: BankAccount;
};

export function ManageBankAccountForm({
   bankAccount,
}: ManageBankAccountFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const isEditMode = !!bankAccount;

   const modeTexts = useMemo(() => {
      const createTexts = {
         description:
            "Crie sua conta bancária para começar a fazer transações.",
         title: "Criar conta bancária",
      };

      const editTexts = {
         description: "Edite os detalhes da sua conta bancária existente.",
         title: "Editar conta bancária",
      };

      return isEditMode ? editTexts : createTexts;
   }, [isEditMode]);

   const createBankAccountMutation = useMutation(
      trpc.bankAccounts.create.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const updateBankAccountMutation = useMutation(
      trpc.bankAccounts.update.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const schema = z.object({
      bank: z.string().min(1, "Este campo é obrigatório."),
      name: z.string(),
      type: z
         .enum(["", "checking", "savings", "investment"])
         .refine((val) => val !== "", "Este campo é obrigatório."),
   });

   const form = useForm({
      defaultValues: {
         bank: bankAccount?.bank || "",
         name: bankAccount?.name || "",
         type: (bankAccount?.type || "") as
            | "checking"
            | "investment"
            | "savings"
            | "",
      },
      onSubmit: async ({ value, formApi }) => {
         if (!value.type || !value.bank) {
            return;
         }
         try {
            if (isEditMode && bankAccount) {
               await updateBankAccountMutation.mutateAsync({
                  data: {
                     bank: value.bank,
                     name: value.name || undefined,
                     type: value.type as "checking" | "investment" | "savings",
                  },
                  id: bankAccount.id,
               });
            } else {
               await createBankAccountMutation.mutateAsync({
                  bank: value.bank,
                  name: value.name || undefined,
                  type: value.type as "checking" | "investment" | "savings",
               });
            }
            formApi.reset();
         } catch (error) {
            console.error(
               `Failed to ${isEditMode ? "update" : "create"} bank account:`,
               error,
            );
         }
      },
      validators: {
         onBlur: schema,
      },
   });

   const handleSubmit = useCallback(
      (e: FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         form.handleSubmit();
      },
      [form],
   );

   return (
      <form className="h-full flex flex-col" onSubmit={handleSubmit}>
         <SheetHeader>
            <SheetTitle>{modeTexts.title}</SheetTitle>
            <SheetDescription>{modeTexts.description}</SheetDescription>
         </SheetHeader>

         <div className="grid gap-4 px-4">
            <FieldGroup>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Apelido da Conta
                           </FieldLabel>
                           <Input
                              aria-invalid={isInvalid}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Conta Salário, Banco Principal"
                              value={field.state.value}
                           />
                           <FieldDescription>
                              Opcional. Use para identificar facilmente esta
                              conta, como 'Conta Salário' ou 'Banco Principal'
                           </FieldDescription>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="bank">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Banco</FieldLabel>
                           <BankAccountCombobox
                              onBlur={field.handleBlur}
                              onValueChange={field.handleChange}
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
               <form.Field name="type">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Tipo de Conta
                           </FieldLabel>
                           <Select
                              onValueChange={(value) =>
                                 field.handleChange(
                                    value as
                                       | ""
                                       | "checking"
                                       | "savings"
                                       | "investment",
                                 )
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="Selecione o tipo de conta" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="checking">
                                    Conta corrente
                                 </SelectItem>
                                 <SelectItem value="savings">
                                    Conta poupança
                                 </SelectItem>
                                 <SelectItem value="investment">
                                    Conta de investimento
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
            </FieldGroup>
         </div>

         <SheetFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        createBankAccountMutation.isPending ||
                        updateBankAccountMutation.isPending
                     }
                     type="submit"
                  >
                     {modeTexts.title}
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </form>
   );
}
