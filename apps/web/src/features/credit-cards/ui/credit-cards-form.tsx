import { Button } from "@packages/ui/components/button";
import {
   ColorPicker,
   ColorPickerAlpha,
   ColorPickerEyeDropper,
   ColorPickerFormat,
   ColorPickerHue,
   ColorPickerOutput,
   ColorPickerSelection,
} from "@packages/ui/components/color-picker";
import { Combobox } from "@packages/ui/components/combobox";
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
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import Color from "color";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";

interface CreditCardFormProps {
   mode: "create" | "edit";
   card?: {
      id: string;
      name: string;
      color: string;
      iconUrl?: string | null;
      creditLimit: string;
      closingDay: number;
      dueDay: number;
      bankAccountId?: string | null;
   };
   onSuccess: () => void;
}

export function CreditCardForm({ mode, card, onSuccess }: CreditCardFormProps) {
   const isCreate = mode === "create";

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const { openAlertDialog } = useAlertDialog();

   const createMutation = useMutation(
      orpc.creditCards.create.mutationOptions(),
   );
   const updateMutation = useMutation(
      orpc.creditCards.update.mutationOptions(),
   );

   const form = useForm({
      defaultValues: {
         name: card?.name ?? "",
         color: card?.color ?? "#6366f1",
         creditLimit: card?.creditLimit ?? "0",
         closingDay: card?.closingDay ?? 1,
         dueDay: card?.dueDay ?? 10,
         bankAccountId: card?.bankAccountId ?? "",
      },
      validators: {
         onSubmitAsync: async ({ value }) => {
            try {
               if (isCreate) {
                  await createMutation.mutateAsync({
                     name: value.name.trim(),
                     color: value.color,
                     creditLimit: value.creditLimit,
                     closingDay: value.closingDay,
                     dueDay: value.dueDay,
                     bankAccountId: value.bankAccountId || "",
                  });
                  toast.success("Cartão de crédito criado com sucesso.");
               } else if (card) {
                  await updateMutation.mutateAsync({
                     id: card.id,
                     name: value.name.trim(),
                     color: value.color,
                     creditLimit: value.creditLimit,
                     closingDay: value.closingDay,
                     dueDay: value.dueDay,
                     bankAccountId: value.bankAccountId || undefined,
                  });
                  toast.success("Cartão de crédito atualizado com sucesso.");
               }
               onSuccess();
               return null;
            } catch (err) {
               return {
                  form: err instanceof Error ? err.message : "Erro inesperado.",
               };
            }
         },
      },
   });

   const blocker = useBlocker({
      withResolver: true,
      shouldBlockFn: () => {
         if (form.store.state.isDirty && !form.store.state.isSubmitted) {
            openAlertDialog({
               title: "Descartar alterações?",
               description:
                  "Você tem alterações não salvas. Tem certeza que deseja sair sem salvar?",
               actionLabel: "Descartar alterações",
               cancelLabel: "Continuar editando",
               onAction: () => blocker.proceed(),
               onCancel: () => blocker.reset(),
            });
            return true;
         }
         return false;
      },
      disabled: isCreate,
   });

   return (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate
                  ? "Novo Cartão de Crédito"
                  : "Editar Cartão de Crédito"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Adicione um cartão de crédito para controlar seus gastos."
                  : "Atualize as informações do cartão de crédito."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{
                     onBlur: ({ value }) =>
                        !value.trim() ? "Nome é obrigatório" : undefined,
                  }}
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
                              placeholder="Ex: Nubank, Itaú Visa"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="color"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Cor</FieldLabel>
                        <Popover>
                           <PopoverTrigger asChild>
                              <Button
                                 className="w-full flex gap-2 justify-start"
                                 type="button"
                                 variant="outline"
                              >
                                 <div
                                    className="w-4 h-4 rounded border border-border shrink-0"
                                    style={{
                                       backgroundColor: field.state.value,
                                    }}
                                 />
                                 {field.state.value}
                              </Button>
                           </PopoverTrigger>
                           <PopoverContent
                              align="start"
                              className="rounded-md border bg-background"
                           >
                              <ColorPicker
                                 className="flex flex-col gap-4"
                                 onChange={(rgba) => {
                                    if (Array.isArray(rgba)) {
                                       field.handleChange(
                                          Color.rgb(
                                             rgba[0],
                                             rgba[1],
                                             rgba[2],
                                          ).hex(),
                                       );
                                    }
                                 }}
                                 value={field.state.value || "#000000"}
                              >
                                 <div className="h-24">
                                    <ColorPickerSelection />
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <ColorPickerEyeDropper />
                                    <div className="grid w-full gap-2">
                                       <ColorPickerHue />
                                       <ColorPickerAlpha />
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                    <ColorPickerOutput />
                                    <ColorPickerFormat />
                                 </div>
                              </ColorPicker>
                           </PopoverContent>
                        </Popover>
                     </Field>
                  )}
               />

               <form.Field
                  name="creditLimit"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Limite de Crédito</FieldLabel>
                        <MoneyInput
                           onChange={(v) => field.handleChange(String(v ?? 0))}
                           value={field.state.value}
                           valueInCents={false}
                        />
                     </Field>
                  )}
               />

               <form.Field
                  name="closingDay"
                  validators={{
                     onBlur: ({ value }) =>
                        value < 1 || value > 31
                           ? "Dia deve ser entre 1 e 31"
                           : undefined,
                  }}
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Dia de Fechamento
                           </FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              max={31}
                              min={1}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(Number(e.target.value))
                              }
                              placeholder="Ex: 25"
                              type="number"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="dueDay"
                  validators={{
                     onBlur: ({ value }) =>
                        value < 1 || value > 31
                           ? "Dia deve ser entre 1 e 31"
                           : undefined,
                  }}
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Dia de Vencimento
                           </FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              max={31}
                              min={1}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(Number(e.target.value))
                              }
                              placeholder="Ex: 5"
                              type="number"
                              value={field.state.value}
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
                        <FieldLabel>Conta Bancária Vinculada</FieldLabel>
                        <Combobox
                           className="w-full"
                           emptyMessage="Nenhuma conta encontrada."
                           onValueChange={(v) => field.handleChange(v || "")}
                           options={bankAccounts.map((a) => ({
                              value: a.id,
                              label: a.name,
                           }))}
                           placeholder="Selecionar conta (opcional)..."
                           searchPlaceholder="Buscar conta..."
                           value={field.state.value}
                        />
                     </Field>
                  )}
               />
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter className="flex flex-col gap-2">
            <form.Subscribe
               selector={(state) =>
                  typeof state.errorMap.onSubmit === "object" &&
                  state.errorMap.onSubmit !== null &&
                  "form" in state.errorMap.onSubmit
                     ? String(state.errorMap.onSubmit.form)
                     : null
               }
            >
               {(formError) =>
                  formError && (
                     <p className="text-sm text-destructive text-center">
                        {formError}
                     </p>
                  )
               }
            </form.Subscribe>
            <form.Subscribe
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     className="w-full gap-2"
                     disabled={!canSubmit || isSubmitting}
                     type="submit"
                  >
                     {isSubmitting && <Spinner className="size-4" />}
                     {isCreate ? "Criar cartão" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
