import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import type { ComboboxOption } from "@packages/ui/components/combobox";
import { Combobox } from "@packages/ui/components/combobox";
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
import { Skeleton } from "@packages/ui/components/skeleton";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";
import type { TransactionRow } from "./transactions-columns";

type TransactionType = "income" | "expense" | "transfer";

const amountSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Valor deve ser maior que zero.",
   });

interface TransactionFormProps {
   mode: "create" | "edit";
   transaction?: TransactionRow;
   onSuccess: () => void;
}

interface TagCheckboxListProps {
   selectedTagIds: string[];
   onToggle: (tagId: string) => void;
}

function TagCheckboxList({ selectedTagIds, onToggle }: TagCheckboxListProps) {
   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   if (tags.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            Nenhuma tag cadastrada.
         </p>
      );
   }

   return (
      <div className="flex flex-wrap gap-x-4 gap-y-2">
         {tags.map((tag) => {
            const checked = selectedTagIds.includes(tag.id);
            return (
               // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is a Radix button, not a native input
               <label
                  className="flex items-center gap-2 cursor-pointer select-none"
                  key={tag.id}
               >
                  <Checkbox
                     checked={checked}
                     onCheckedChange={() => onToggle(tag.id)}
                  />
                  {tag.color ? (
                     <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                     />
                  ) : null}
                  <span className="text-sm">{tag.name}</span>
               </label>
            );
         })}
      </div>
   );
}

function ContactCombobox({
   value,
   onChange,
}: {
   value: string | null;
   onChange: (id: string | null) => void;
}) {
   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({}),
   );

   if (contacts.length === 0) {
      return (
         <p className="text-sm text-muted-foreground">
            Nenhum contato cadastrado.
         </p>
      );
   }

   const options: ComboboxOption[] = contacts.map((c) => ({
      value: c.id,
      label: c.name,
   }));

   return (
      <Combobox
         className="w-full"
         emptyMessage="Nenhum contato encontrado."
         onValueChange={(v) => onChange(v || null)}
         options={options}
         placeholder="Selecionar contato..."
         searchPlaceholder="Buscar contato..."
         value={value ?? ""}
      />
   );
}

function TransactionFormContent({
   mode,
   transaction,
   onSuccess,
}: TransactionFormProps) {
   const isCreate = mode === "create";

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         onSuccess: () => {
            toast.success("Transação criada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar transação.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onSuccess: () => {
            toast.success("Transação atualizada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar transação.");
         },
      }),
   );

   const isPending = createMutation.isPending || updateMutation.isPending;

   const form = useForm({
      defaultValues: {
         name:
            (transaction as TransactionRow & { name?: string | null })?.name ??
            "",
         type: (transaction?.type ?? "income") as TransactionType,
         amount: transaction?.amount ?? "",
         date: transaction?.date
            ? new Date(`${transaction.date}T12:00:00`)
            : (undefined as unknown as Date),
         bankAccountId: transaction?.bankAccountId ?? "",
         destinationBankAccountId: transaction?.destinationBankAccountId ?? "",
         categoryId: transaction?.categoryId ?? "",
         subcategoryId: transaction?.subcategoryId ?? "",
         tagIds: transaction?.tagIds ?? ([] as string[]),
         description: transaction?.description ?? "",
         contactId: transaction?.contactId ?? (null as string | null),
      },
      onSubmit: ({ value }) => {
         const dateStr = value.date
            ? value.date.toISOString().split("T")[0]
            : "";
         const payload = {
            type: value.type,
            name: value.name?.trim() || null,
            amount: value.amount,
            date: dateStr,
            bankAccountId: value.bankAccountId,
            destinationBankAccountId:
               value.type === "transfer"
                  ? value.destinationBankAccountId || null
                  : null,
            categoryId: value.categoryId || null,
            subcategoryId: value.subcategoryId || null,
            attachmentUrl: null as string | null,
            tagIds: value.tagIds,
            description: value.description || null,
            contactId: value.contactId,
         };

         if (isCreate) {
            createMutation.mutate(payload);
         } else if (transaction) {
            updateMutation.mutate({ id: transaction.id, ...payload });
         }
      },
   });

   return (
      <>
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Nova Transação" : "Editar Transação"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Registre uma nova transação financeira."
                  : "Atualize os dados da transação."}
            </CredenzaDescription>
         </CredenzaHeader>

         <form
            onSubmit={(e) => {
               e.preventDefault();
               e.stopPropagation();
               form.handleSubmit();
            }}
         >
            <CredenzaBody>
               <FieldGroup>
                  {/* Nome */}
                  <form.Field name="name">
                     {(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                           <Input
                              id={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Almoço, Salário"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>

                  {/* Tipo + Valor */}
                  <div className="grid grid-cols-2 gap-3">
                     <form.Field name="type">
                        {(field) => (
                           <Field>
                              <FieldLabel>Tipo</FieldLabel>
                              <Select
                                 onValueChange={(v) =>
                                    field.handleChange(v as TransactionType)
                                 }
                                 value={field.state.value}
                              >
                                 <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tipo" />
                                 </SelectTrigger>
                                 <SelectContent>
                                    <SelectItem value="income">
                                       Receita
                                    </SelectItem>
                                    <SelectItem value="expense">
                                       Despesa
                                    </SelectItem>
                                    <SelectItem value="transfer">
                                       Transferência
                                    </SelectItem>
                                 </SelectContent>
                              </Select>
                           </Field>
                        )}
                     </form.Field>

                     <form.Field
                        name="amount"
                        validators={{ onBlur: amountSchema }}
                     >
                        {(field) => {
                           const isInvalid =
                              field.state.meta.isTouched &&
                              !field.state.meta.isValid;
                           return (
                              <Field data-invalid={isInvalid}>
                                 <FieldLabel>Valor</FieldLabel>
                                 <MoneyInput
                                    disabled={isPending}
                                    onChange={(value) =>
                                       field.handleChange(String(value ?? 0))
                                    }
                                    value={field.state.value}
                                    valueInCents={false}
                                 />
                                 {isInvalid && (
                                    <FieldError
                                       errors={field.state.meta.errors}
                                    />
                                 )}
                              </Field>
                           );
                        }}
                     </form.Field>
                  </div>

                  {/* Data + Conta */}
                  <div className="grid grid-cols-2 gap-3">
                     <form.Field name="date">
                        {(field) => (
                           <Field>
                              <FieldLabel>Data</FieldLabel>
                              <DatePicker
                                 className="w-full"
                                 date={field.state.value}
                                 onSelect={(d) => field.handleChange(d as Date)}
                                 placeholder="Selecione"
                              />
                           </Field>
                        )}
                     </form.Field>

                     <form.Subscribe selector={(s) => s.values.type}>
                        {(type) => (
                           <form.Field name="bankAccountId">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>
                                       {type === "transfer"
                                          ? "Conta de Origem"
                                          : "Conta"}
                                    </FieldLabel>
                                    <Select
                                       onValueChange={field.handleChange}
                                       value={field.state.value}
                                    >
                                       <SelectTrigger>
                                          <SelectValue placeholder="Selecione" />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {bankAccounts.map((account) => (
                                             <SelectItem
                                                key={account.id}
                                                value={account.id}
                                             >
                                                {account.name}
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 </Field>
                              )}
                           </form.Field>
                        )}
                     </form.Subscribe>
                  </div>

                  {/* Conta de Destino (transfer only) */}
                  <form.Subscribe selector={(s) => s.values.type}>
                     {(type) =>
                        type === "transfer" ? (
                           <form.Field name="destinationBankAccountId">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>Conta de Destino</FieldLabel>
                                    <Select
                                       onValueChange={field.handleChange}
                                       value={field.state.value}
                                    >
                                       <SelectTrigger>
                                          <SelectValue placeholder="Selecione a conta de destino" />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {bankAccounts.map((account) => (
                                             <SelectItem
                                                key={account.id}
                                                value={account.id}
                                             >
                                                {account.name}
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 </Field>
                              )}
                           </form.Field>
                        ) : null
                     }
                  </form.Subscribe>

                  {/* Categoria + Subcategoria */}
                  <form.Field name="categoryId">
                     {(field) => (
                        <Field>
                           <FieldLabel>Categoria</FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 field.handleChange(v);
                                 form.setFieldValue("subcategoryId", "");
                              }}
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="Selecione a categoria" />
                              </SelectTrigger>
                              <SelectContent>
                                 {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                       {cat.name}
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>

                  <form.Subscribe selector={(s) => s.values.categoryId}>
                     {(categoryId) => {
                        const sub =
                           categories.find((c) => c.id === categoryId)
                              ?.subcategories ?? [];
                        return categoryId && sub.length > 0 ? (
                           <form.Field name="subcategoryId">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>Subcategoria</FieldLabel>
                                    <Select
                                       onValueChange={field.handleChange}
                                       value={field.state.value}
                                    >
                                       <SelectTrigger>
                                          <SelectValue placeholder="Selecione a subcategoria" />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {sub.map((s) => (
                                             <SelectItem
                                                key={s.id}
                                                value={s.id}
                                             >
                                                {s.name}
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 </Field>
                              )}
                           </form.Field>
                        ) : null;
                     }}
                  </form.Subscribe>

                  {/* Tags */}
                  <form.Field name="tagIds">
                     {(field) => (
                        <Field>
                           <FieldLabel>Tags</FieldLabel>
                           <Suspense
                              fallback={
                                 <p className="text-sm text-muted-foreground">
                                    Carregando tags...
                                 </p>
                              }
                           >
                              <TagCheckboxList
                                 onToggle={(tagId) => {
                                    field.handleChange(
                                       field.state.value.includes(tagId)
                                          ? field.state.value.filter(
                                               (id) => id !== tagId,
                                            )
                                          : [...field.state.value, tagId],
                                    );
                                 }}
                                 selectedTagIds={field.state.value}
                              />
                           </Suspense>
                        </Field>
                     )}
                  </form.Field>

                  {/* Contato */}
                  <form.Field name="contactId">
                     {(field) => (
                        <Field>
                           <FieldLabel>Contato</FieldLabel>
                           <Suspense
                              fallback={<Skeleton className="h-9 w-full" />}
                           >
                              <ContactCombobox
                                 onChange={field.handleChange}
                                 value={field.state.value}
                              />
                           </Suspense>
                        </Field>
                     )}
                  </form.Field>

                  {/* Observações */}
                  <form.Field name="description">
                     {(field) => (
                        <Field>
                           <FieldLabel>Observações</FieldLabel>
                           <Textarea
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Observações sobre a transação (opcional)"
                              rows={3}
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </CredenzaBody>

            <CredenzaFooter>
               <form.Subscribe>
                  {(formState) => (
                     <Button
                        className="w-full"
                        disabled={!formState.canSubmit || isPending}
                        type="submit"
                     >
                        {isPending ? <Spinner className="size-4 mr-2" /> : null}
                        {isCreate ? "Criar transação" : "Salvar alterações"}
                     </Button>
                  )}
               </form.Subscribe>
            </CredenzaFooter>
         </form>
      </>
   );
}

export function TransactionSheet({
   mode,
   transaction,
   onSuccess,
}: TransactionFormProps) {
   return (
      <Suspense
         fallback={
            <>
               <CredenzaHeader>
                  <CredenzaTitle>
                     {mode === "create" ? "Nova Transação" : "Editar Transação"}
                  </CredenzaTitle>
               </CredenzaHeader>
               <CredenzaBody className="flex items-center justify-center py-8">
                  <Spinner className="size-6" />
               </CredenzaBody>
            </>
         }
      >
         <TransactionFormContent
            mode={mode}
            onSuccess={onSuccess}
            transaction={transaction}
         />
      </Suspense>
   );
}
