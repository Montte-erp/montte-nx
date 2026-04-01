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
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import Color from "color";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

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

   const createMutation = useMutation(
      orpc.creditCards.create.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito criado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar cartão de crédito.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.creditCards.update.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão de crédito atualizado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(
               error.message || "Erro ao atualizar cartão de crédito.",
            );
         },
      }),
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
      onSubmit: async ({ value }) => {
         if (isCreate) {
            createMutation.mutate({
               name: value.name.trim(),
               color: value.color,
               creditLimit: value.creditLimit,
               closingDay: value.closingDay,
               dueDay: value.dueDay,
               bankAccountId: value.bankAccountId || "",
            });
         } else if (card) {
            updateMutation.mutate({
               id: card.id,
               name: value.name.trim(),
               color: value.color,
               creditLimit: value.creditLimit,
               closingDay: value.closingDay,
               dueDay: value.dueDay,
               bankAccountId: value.bankAccountId || undefined,
            });
         }
      },
   });

   return (
      <form
         className="h-full flex flex-col"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <DialogStackContent index={0}>
            <DialogStackHeader>
               <DialogStackTitle>
                  {isCreate
                     ? "Novo Cartão de Crédito"
                     : "Editar Cartão de Crédito"}
               </DialogStackTitle>
               <DialogStackDescription>
                  {isCreate
                     ? "Adicione um cartão de crédito para controlar seus gastos."
                     : "Atualize as informações do cartão de crédito."}
               </DialogStackDescription>
            </DialogStackHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4">
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
                                 <FieldError
                                    errors={field.state.meta.errors as any}
                                 />
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
                              onChange={(v) =>
                                 field.handleChange(String(v ?? 0))
                              }
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
                                 <FieldError
                                    errors={field.state.meta.errors as any}
                                 />
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
                                 <FieldError
                                    errors={field.state.meta.errors as any}
                                 />
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
            </div>

            <div className="border-t px-4 py-4">
               <form.Subscribe selector={(state) => state}>
                  {(state) => (
                     <Button
                        className="w-full"
                        disabled={
                           !state.canSubmit ||
                           state.isSubmitting ||
                           createMutation.isPending ||
                           updateMutation.isPending
                        }
                        type="submit"
                     >
                        {(state.isSubmitting ||
                           createMutation.isPending ||
                           updateMutation.isPending) && (
                           <Spinner className="size-4 mr-2" />
                        )}
                        {isCreate ? "Criar cartão" : "Salvar alterações"}
                     </Button>
                  )}
               </form.Subscribe>
            </div>
         </DialogStackContent>
      </form>
   );
}
