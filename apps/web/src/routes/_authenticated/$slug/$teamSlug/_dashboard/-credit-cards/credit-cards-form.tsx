import { Button } from "@packages/ui/components/button";
import { Spinner } from "@packages/ui/components/spinner";
import {
   ColorPicker,
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
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import Color from "color";
import { fromPromise } from "neverthrow";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { Outputs } from "@/integrations/orpc/client";

type CreditCardRow = Outputs["creditCards"]["getAll"]["data"][number];

interface CreditCardFormProps {
   mode: "create" | "edit";
   card?: CreditCardRow;
   onSuccess: () => void;
}

const BRAND_OPTIONS = [
   { value: "visa", label: "Visa" },
   { value: "mastercard", label: "Mastercard" },
   { value: "elo", label: "Elo" },
   { value: "amex", label: "Amex" },
   { value: "hipercard", label: "Hipercard" },
   { value: "other", label: "Outra" },
] as const;

const STATUS_OPTIONS = [
   { value: "active", label: "Ativo" },
   { value: "blocked", label: "Bloqueado" },
   { value: "cancelled", label: "Cancelado" },
] as const;

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
         brand: card?.brand ?? null,
         status: card?.status ?? "active",
      },
      validators: {
         onSubmitAsync: async ({ value }) => {
            const promise = isCreate
               ? createMutation.mutateAsync({
                    name: value.name.trim(),
                    color: value.color,
                    creditLimit: value.creditLimit,
                    closingDay: value.closingDay,
                    dueDay: value.dueDay,
                    bankAccountId: value.bankAccountId,
                    brand: value.brand,
                 })
               : card
                 ? updateMutation.mutateAsync({
                      id: card.id,
                      name: value.name.trim(),
                      color: value.color,
                      creditLimit: value.creditLimit,
                      closingDay: value.closingDay,
                      dueDay: value.dueDay,
                      bankAccountId: value.bankAccountId || undefined,
                      brand: value.brand,
                      status: value.status,
                   })
                 : null;
            if (!promise) return null;
            const result = await fromPromise(promise, (e) => e);
            if (result.isErr()) {
               const err = result.error;
               return err instanceof Error ? err.message : "Erro inesperado.";
            }
            toast.success(
               isCreate
                  ? "Cartão de crédito criado com sucesso."
                  : "Cartão de crédito atualizado com sucesso.",
            );
            onSuccess();
            return null;
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
               onAction: () => blocker.proceed?.(),
               onCancel: () => blocker.reset?.(),
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
                                    className="size-4 rounded border border-border shrink-0"
                                    style={{
                                       backgroundColor: field.state.value,
                                    }}
                                 />
                                 <span className="font-mono text-sm">
                                    {field.state.value}
                                 </span>
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

               <div className="grid grid-cols-2 gap-4">
                  <form.Field
                     name="closingDay"
                     children={(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Dia de Fechamento
                           </FieldLabel>
                           <Select
                              value={String(field.state.value || 1)}
                              onValueChange={(v) =>
                                 field.handleChange(Number(v))
                              }
                           >
                              <SelectTrigger id={field.name} name={field.name}>
                                 <SelectValue placeholder="Selecionar dia" />
                              </SelectTrigger>
                              <SelectContent>
                                 {Array.from(
                                    { length: 31 },
                                    (_, i) => i + 1,
                                 ).map((day) => (
                                    <SelectItem key={day} value={String(day)}>
                                       Dia {day}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  />

                  <form.Field
                     name="dueDay"
                     children={(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Dia de Vencimento
                           </FieldLabel>
                           <Select
                              value={String(field.state.value || 1)}
                              onValueChange={(v) =>
                                 field.handleChange(Number(v))
                              }
                           >
                              <SelectTrigger id={field.name} name={field.name}>
                                 <SelectValue placeholder="Selecionar dia" />
                              </SelectTrigger>
                              <SelectContent>
                                 {Array.from(
                                    { length: 31 },
                                    (_, i) => i + 1,
                                 ).map((day) => (
                                    <SelectItem key={day} value={String(day)}>
                                       Dia {day}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  />
               </div>

               <form.Field
                  name="brand"
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>Bandeira</FieldLabel>
                        <Select
                           value={field.state.value ?? undefined}
                           onValueChange={(
                              v:
                                 | "visa"
                                 | "mastercard"
                                 | "elo"
                                 | "amex"
                                 | "hipercard"
                                 | "other",
                           ) => field.handleChange(v)}
                        >
                           <SelectTrigger id={field.name} name={field.name}>
                              <SelectValue placeholder="Selecionar bandeira (opcional)" />
                           </SelectTrigger>
                           <SelectContent>
                              {BRAND_OPTIONS.map((opt) => (
                                 <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  )}
               />

               {!isCreate && (
                  <form.Field
                     name="status"
                     children={(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                           <Select
                              value={field.state.value}
                              onValueChange={(
                                 v: "active" | "blocked" | "cancelled",
                              ) => field.handleChange(v)}
                           >
                              <SelectTrigger id={field.name} name={field.name}>
                                 <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 {STATUS_OPTIONS.map((opt) => (
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
               )}

               <form.Field
                  name="bankAccountId"
                  validators={{
                     onBlur: ({ value }) =>
                        !value ? "Conta bancária é obrigatória" : undefined,
                  }}
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Conta Bancária</FieldLabel>
                           <Combobox
                              className="w-full"
                              emptyMessage="Nenhuma conta encontrada."
                              onBlur={field.handleBlur}
                              onValueChange={(v) => field.handleChange(v || "")}
                              options={bankAccounts.map((a) => ({
                                 value: a.id,
                                 label: a.name,
                              }))}
                              placeholder="Selecionar conta..."
                              searchPlaceholder="Buscar conta..."
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               />
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter className="flex flex-col gap-2">
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
