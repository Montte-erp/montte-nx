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
import { Switch } from "@packages/ui/components/switch";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import * as React from "react";
import { Suspense } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAccountType } from "@/hooks/use-account-type";
import { orpc } from "@/integrations/orpc/client";
import type { TransactionRow } from "./transactions-columns";

type TransactionType = "income" | "expense" | "transfer";

type PaymentMethod =
   | "pix"
   | "credit_card"
   | "debit_card"
   | "boleto"
   | "cash"
   | "transfer"
   | "other"
   | "cheque"
   | "automatic_debit";

const amountSchema = z
   .string()
   .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, {
      message: "Valor deve ser maior que zero.",
   });

const requiredStringSchema = z.string().min(1, "Campo obrigatório.");
const requiredDateSchema = z
   .any()
   .refine((v) => v instanceof Date && !Number.isNaN(v.getTime()), {
      message: "Campo obrigatório.",
   });

interface TransactionCredenzaProps {
   mode: "create" | "edit";
   transaction?: TransactionRow;
   onSuccess: () => void;
}

function TagCombobox({
   selectedIds,
   onChange,
   onCreate,
}: {
   selectedIds: string[];
   onChange: (ids: string[]) => void;
   onCreate?: (name: string) => void;
}) {
   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));
   const { isBusiness } = useAccountType();
   const [newTagName, setNewTagName] = React.useState("");

   const label = isBusiness ? "centro de custo" : "tag";

   return (
      <div className="flex flex-col gap-2">
         <div className="flex flex-wrap gap-x-4 gap-y-2">
            {tags.map((tag) => {
               const checked = selectedIds.includes(tag.id);
               return (
                  // biome-ignore lint/a11y/noLabelWithoutControl: Checkbox is Radix
                  <label
                     className="flex items-center gap-2 cursor-pointer select-none"
                     key={tag.id}
                  >
                     <Checkbox
                        checked={checked}
                        onCheckedChange={() => {
                           onChange(
                              checked
                                 ? selectedIds.filter((id) => id !== tag.id)
                                 : [...selectedIds, tag.id],
                           );
                        }}
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
         {onCreate && (
            <div className="flex items-center gap-2">
               <Input
                  className="h-7 text-xs"
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === "Enter" && newTagName.trim()) {
                        e.preventDefault();
                        onCreate(newTagName.trim());
                        setNewTagName("");
                     }
                  }}
                  placeholder={`Nova ${label}...`}
                  value={newTagName}
               />
               <Button
                  className="h-7 text-xs"
                  disabled={!newTagName.trim()}
                  onClick={() => {
                     if (newTagName.trim()) {
                        onCreate(newTagName.trim());
                        setNewTagName("");
                     }
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
               >
                  <Plus className="size-3" />
               </Button>
            </div>
         )}
      </div>
   );
}

function ContactCombobox({
   value,
   onChange,
   onCreate,
}: {
   value: string | null;
   onChange: (id: string | null) => void;
   onCreate?: (name: string) => void;
}) {
   const { data: contacts } = useSuspenseQuery(
      orpc.contacts.getAll.queryOptions({}),
   );

   const options: ComboboxOption[] = contacts.map((c) => ({
      value: c.id,
      label: c.name,
   }));

   return (
      <Combobox
         className="w-full"
         createLabel="Criar contato"
         emptyMessage="Nenhum contato encontrado."
         onCreate={onCreate}
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
}: TransactionCredenzaProps) {
   const isCreate = mode === "create";
   const { isBusiness } = useAccountType();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categoriesResult } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const categories = categoriesResult.data;
   const { data: creditCards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         onSuccess: () => {
            toast.success("Lançamento criado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar lançamento.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions({
         onSuccess: () => {
            toast.success("Lançamento atualizado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar lançamento.");
         },
      }),
   );

   const billCreateMutation = useMutation(
      orpc.bills.create.mutationOptions({
         onSuccess: () => {
            toast.success("Conta a pagar criada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar conta a pagar.");
         },
      }),
   );

   const createBankAccountMutation = useMutation(
      orpc.bankAccounts.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Conta criada.");
            form.setFieldValue("bankAccountId", data.id);
         },
      }),
   );

   const createCategoryMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Categoria criada.");
            form.setFieldValue("categoryId", data.id);
         },
      }),
   );

   const createSubcategoryMutation = useMutation(
      orpc.subcategories.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Subcategoria criada.");
            form.setFieldValue("subcategoryId", data.id);
         },
      }),
   );

   const createCreditCardMutation = useMutation(
      orpc.creditCards.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Cartão criado.");
            form.setFieldValue("creditCardId", data.id);
         },
      }),
   );

   const createContactMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Contato criado.");
            form.setFieldValue("contactId", data.id);
         },
      }),
   );

   const createTagMutation = useMutation(
      orpc.tags.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Tag criada.");
            form.setFieldValue("tagIds", [
               ...form.getFieldValue("tagIds"),
               data.id,
            ]);
         },
      }),
   );

   const isPending =
      createMutation.isPending ||
      updateMutation.isPending ||
      billCreateMutation.isPending;

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
         creditCardId: transaction?.creditCardId ?? "",
         createAsBill: false as boolean,
         paymentMethod: (transaction?.paymentMethod ?? "") as
            | PaymentMethod
            | "",
         isInstallment: transaction?.isInstallment ?? false,
         installmentCount:
            transaction?.installmentCount ?? (null as number | null),
         isRecurring: false as boolean,
         recurringFrequency: null as string | null,
         recurringCount: null as number | null,
      },
      onSubmit: ({ value }) => {
         const dateStr = value.date
            ? value.date.toISOString().split("T")[0]
            : "";
         const isTransfer = value.type === "transfer";

         if (isCreate && value.createAsBill && value.type === "expense") {
            billCreateMutation.mutate({
               bill: {
                  name: value.name?.trim() || "Despesa",
                  type: "payable",
                  amount: value.amount,
                  dueDate: dateStr,
                  bankAccountId: value.bankAccountId || null,
                  categoryId: value.categoryId || null,
                  description: value.description || null,
               },
            });
            return;
         }

         const payload = {
            type: value.type,
            name: value.name?.trim() || null,
            amount: value.amount,
            date: dateStr,
            bankAccountId: value.bankAccountId || null,
            destinationBankAccountId: isTransfer
               ? value.destinationBankAccountId || null
               : null,
            categoryId: isTransfer ? null : value.categoryId || null,
            subcategoryId: isTransfer ? null : value.subcategoryId || null,
            attachmentUrl: null as string | null,
            tagIds: value.tagIds,
            description: value.description || null,
            contactId: value.contactId,
            creditCardId:
               value.type === "expense" ? value.creditCardId || null : null,
            paymentMethod: (isTransfer
               ? null
               : value.paymentMethod || null) as PaymentMethod | null,
            isInstallment: isTransfer ? false : value.isInstallment,
            installmentCount:
               !isTransfer && value.isInstallment
                  ? value.installmentCount
                  : null,
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
               {isCreate ? "Novo Lançamento" : "Editar Lançamento"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Registre um novo lançamento financeiro."
                  : "Atualize os dados do lançamento."}
            </CredenzaDescription>
         </CredenzaHeader>

         <form
            className="flex flex-1 flex-col overflow-hidden"
            onSubmit={(e) => {
               e.preventDefault();
               e.stopPropagation();
               form.handleSubmit();
            }}
         >
            <CredenzaBody>
               <FieldGroup>
                  {/* Row 1: Nome (3fr) + Tipo (2fr) */}
                  <div className="grid grid-cols-[3fr_2fr] gap-4">
                     <form.Field name="name">
                        {(field) => (
                           <Field>
                              <FieldLabel htmlFor={field.name}>
                                 Nome{" "}
                                 <span className="text-destructive">*</span>
                              </FieldLabel>
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

                     <form.Field name="type">
                        {(field) => (
                           <Field>
                              <FieldLabel>
                                 Tipo{" "}
                                 <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Select
                                 onValueChange={(v) => {
                                    field.handleChange(v as TransactionType);
                                    if (v === "transfer") {
                                       form.setFieldValue("categoryId", "");
                                       form.setFieldValue("subcategoryId", "");
                                       form.setFieldValue("paymentMethod", "");
                                       form.setFieldValue(
                                          "isInstallment",
                                          false,
                                       );
                                       form.setFieldValue(
                                          "installmentCount",
                                          null,
                                       );
                                       form.setFieldValue("isRecurring", false);
                                       form.setFieldValue(
                                          "recurringFrequency",
                                          null,
                                       );
                                       form.setFieldValue(
                                          "recurringCount",
                                          null,
                                       );
                                       form.setFieldValue("creditCardId", "");
                                       form.setFieldValue("contactId", null);
                                    } else {
                                       // Clear category if it doesn't match the new type
                                       const currentCatId =
                                          form.getFieldValue("categoryId");
                                       if (currentCatId) {
                                          const cat = categories.find(
                                             (c) => c.id === currentCatId,
                                          );
                                          if (cat?.type && cat.type !== v) {
                                             form.setFieldValue(
                                                "categoryId",
                                                "",
                                             );
                                             form.setFieldValue(
                                                "subcategoryId",
                                                "",
                                             );
                                          }
                                       }
                                    }
                                 }}
                                 value={field.state.value}
                              >
                                 <SelectTrigger>
                                    <SelectValue placeholder="Tipo" />
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
                  </div>

                  {/* Row 2+3: Layout depends on type */}
                  <form.Subscribe
                     selector={(s) => ({
                        type: s.values.type,
                        bankAccountId: s.values.bankAccountId,
                        categoryId: s.values.categoryId,
                     })}
                  >
                     {({ type, bankAccountId, categoryId }) => {
                        const isTransfer = type === "transfer";
                        const selectedSubcategories =
                           categories.find((c) => c.id === categoryId)
                              ?.subcategories ?? [];

                        return (
                           <>
                              {isTransfer ? (
                                 <>
                                    {/* Transfer: Row 2 — Data + Valor (2 cols) */}
                                    <div className="grid grid-cols-2 gap-4">
                                       <form.Field
                                          name="date"
                                          validators={{
                                             onSubmit: requiredDateSchema,
                                          }}
                                       >
                                          {(field) => {
                                             const isInvalid =
                                                field.state.meta.isTouched &&
                                                !field.state.meta.isValid;
                                             return (
                                                <Field data-invalid={isInvalid}>
                                                   <FieldLabel>
                                                      Data{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <DatePicker
                                                      className="w-full"
                                                      date={field.state.value}
                                                      onSelect={(d) =>
                                                         field.handleChange(
                                                            d as Date,
                                                         )
                                                      }
                                                      placeholder="Selecione"
                                                   />
                                                   {isInvalid && (
                                                      <FieldError
                                                         errors={
                                                            field.state.meta
                                                               .errors
                                                         }
                                                      />
                                                   )}
                                                </Field>
                                             );
                                          }}
                                       </form.Field>

                                       <form.Field
                                          name="amount"
                                          validators={{
                                             onBlur: amountSchema,
                                             onSubmit: amountSchema,
                                          }}
                                       >
                                          {(field) => {
                                             const isInvalid =
                                                field.state.meta.isTouched &&
                                                !field.state.meta.isValid;
                                             return (
                                                <Field data-invalid={isInvalid}>
                                                   <FieldLabel>
                                                      Valor{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <MoneyInput
                                                      disabled={isPending}
                                                      onChange={(value) =>
                                                         field.handleChange(
                                                            String(value ?? 0),
                                                         )
                                                      }
                                                      value={field.state.value}
                                                      valueInCents={false}
                                                   />
                                                   {isInvalid && (
                                                      <FieldError
                                                         errors={
                                                            field.state.meta
                                                               .errors
                                                         }
                                                      />
                                                   )}
                                                </Field>
                                             );
                                          }}
                                       </form.Field>
                                    </div>

                                    {/* Transfer: Row 3 — Origem + Destino (2 cols) */}
                                    <div className="grid grid-cols-2 gap-4">
                                       <form.Field
                                          name="bankAccountId"
                                          validators={{
                                             onSubmit: requiredStringSchema,
                                          }}
                                       >
                                          {(field) => {
                                             const isInvalid =
                                                field.state.meta.isTouched &&
                                                !field.state.meta.isValid;
                                             return (
                                                <Field data-invalid={isInvalid}>
                                                   <FieldLabel>
                                                      Conta de Origem{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <Combobox
                                                      className="w-full"
                                                      createLabel="Criar conta"
                                                      emptyMessage="Nenhuma conta cadastrada."
                                                      onCreate={(name) =>
                                                         createBankAccountMutation.mutate(
                                                            {
                                                               name,
                                                               type: "checking",
                                                            },
                                                         )
                                                      }
                                                      onValueChange={(v) => {
                                                         field.handleChange(v);
                                                         if (
                                                            v ===
                                                            form.getFieldValue(
                                                               "destinationBankAccountId",
                                                            )
                                                         ) {
                                                            form.setFieldValue(
                                                               "destinationBankAccountId",
                                                               "",
                                                            );
                                                         }
                                                      }}
                                                      options={bankAccounts.map(
                                                         (account) => ({
                                                            value: account.id,
                                                            label: account.name,
                                                         }),
                                                      )}
                                                      placeholder="Selecione a conta..."
                                                      searchPlaceholder="Buscar conta..."
                                                      value={field.state.value}
                                                   />
                                                   {isInvalid && (
                                                      <FieldError
                                                         errors={
                                                            field.state.meta
                                                               .errors
                                                         }
                                                      />
                                                   )}
                                                </Field>
                                             );
                                          }}
                                       </form.Field>

                                       <form.Field
                                          name="destinationBankAccountId"
                                          validators={{
                                             onSubmit: requiredStringSchema,
                                          }}
                                       >
                                          {(field) => {
                                             const isInvalid =
                                                field.state.meta.isTouched &&
                                                !field.state.meta.isValid;
                                             return (
                                                <Field data-invalid={isInvalid}>
                                                   <FieldLabel>
                                                      Conta de Destino{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <Combobox
                                                      className="w-full"
                                                      createLabel="Criar conta"
                                                      emptyMessage="Nenhuma conta cadastrada."
                                                      onCreate={(name) =>
                                                         createBankAccountMutation.mutate(
                                                            {
                                                               name,
                                                               type: "checking",
                                                            },
                                                         )
                                                      }
                                                      onValueChange={
                                                         field.handleChange
                                                      }
                                                      options={bankAccounts
                                                         .filter(
                                                            (a) =>
                                                               a.id !==
                                                               bankAccountId,
                                                         )
                                                         .map((account) => ({
                                                            value: account.id,
                                                            label: account.name,
                                                         }))}
                                                      placeholder="Selecione a conta..."
                                                      searchPlaceholder="Buscar conta..."
                                                      value={field.state.value}
                                                   />
                                                   {isInvalid && (
                                                      <FieldError
                                                         errors={
                                                            field.state.meta
                                                               .errors
                                                         }
                                                      />
                                                   )}
                                                </Field>
                                             );
                                          }}
                                       </form.Field>
                                    </div>
                                 </>
                              ) : (
                                 <>
                                    {/* Non-transfer: Row 2 — Data + Valor + Conta (3 cols) */}
                                    <div className="grid grid-cols-3 gap-4">
                                       <form.Field
                                          name="date"
                                          validators={{
                                             onSubmit: requiredDateSchema,
                                          }}
                                       >
                                          {(field) => {
                                             const isInvalid =
                                                field.state.meta.isTouched &&
                                                !field.state.meta.isValid;
                                             return (
                                                <Field data-invalid={isInvalid}>
                                                   <FieldLabel>
                                                      Data{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <DatePicker
                                                      className="w-full"
                                                      date={field.state.value}
                                                      onSelect={(d) =>
                                                         field.handleChange(
                                                            d as Date,
                                                         )
                                                      }
                                                      placeholder="Selecione"
                                                   />
                                                   {isInvalid && (
                                                      <FieldError
                                                         errors={
                                                            field.state.meta
                                                               .errors
                                                         }
                                                      />
                                                   )}
                                                </Field>
                                             );
                                          }}
                                       </form.Field>

                                       <form.Field
                                          name="amount"
                                          validators={{
                                             onBlur: amountSchema,
                                             onSubmit: amountSchema,
                                          }}
                                       >
                                          {(field) => {
                                             const isInvalid =
                                                field.state.meta.isTouched &&
                                                !field.state.meta.isValid;
                                             return (
                                                <Field data-invalid={isInvalid}>
                                                   <FieldLabel>
                                                      Valor{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <MoneyInput
                                                      disabled={isPending}
                                                      onChange={(value) =>
                                                         field.handleChange(
                                                            String(value ?? 0),
                                                         )
                                                      }
                                                      value={field.state.value}
                                                      valueInCents={false}
                                                   />
                                                   {isInvalid && (
                                                      <FieldError
                                                         errors={
                                                            field.state.meta
                                                               .errors
                                                         }
                                                      />
                                                   )}
                                                </Field>
                                             );
                                          }}
                                       </form.Field>

                                       <form.Field
                                          name="bankAccountId"
                                          validators={{
                                             onSubmit: requiredStringSchema,
                                          }}
                                       >
                                          {(field) => {
                                             const isInvalid =
                                                field.state.meta.isTouched &&
                                                !field.state.meta.isValid;
                                             return (
                                                <Field data-invalid={isInvalid}>
                                                   <FieldLabel>
                                                      Conta{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <Combobox
                                                      className="w-full"
                                                      createLabel="Criar conta"
                                                      emptyMessage="Nenhuma conta cadastrada."
                                                      onCreate={(name) =>
                                                         createBankAccountMutation.mutate(
                                                            {
                                                               name,
                                                               type: "checking",
                                                            },
                                                         )
                                                      }
                                                      onValueChange={
                                                         field.handleChange
                                                      }
                                                      options={bankAccounts.map(
                                                         (account) => ({
                                                            value: account.id,
                                                            label: account.name,
                                                         }),
                                                      )}
                                                      placeholder="Selecione a conta..."
                                                      searchPlaceholder="Buscar conta..."
                                                      value={field.state.value}
                                                   />
                                                   {isInvalid && (
                                                      <FieldError
                                                         errors={
                                                            field.state.meta
                                                               .errors
                                                         }
                                                      />
                                                   )}
                                                </Field>
                                             );
                                          }}
                                       </form.Field>
                                    </div>
                                 </>
                              )}

                              {type === "expense" && (
                                 <form.Field name="creditCardId">
                                    {(field) => (
                                       <Field>
                                          <FieldLabel>
                                             Cartão de Crédito
                                          </FieldLabel>
                                          <Combobox
                                             className="w-full"
                                             createLabel="Criar cartão"
                                             emptyMessage="Nenhum cartão cadastrado."
                                             onCreate={(name) =>
                                                createCreditCardMutation.mutate(
                                                   {
                                                      name,
                                                      closingDay: 25,
                                                      dueDay: 5,
                                                   },
                                                )
                                             }
                                             onValueChange={(v) =>
                                                field.handleChange(v || "")
                                             }
                                             options={creditCards.map((c) => ({
                                                value: c.id,
                                                label: c.name,
                                             }))}
                                             placeholder="Selecionar cartão (opcional)..."
                                             searchPlaceholder="Buscar cartão..."
                                             value={field.state.value}
                                          />
                                       </Field>
                                    )}
                                 </form.Field>
                              )}

                              {!isTransfer && (
                                 <>
                                    {/* Categoria + Forma de pagamento (2 cols) */}
                                    <div className="grid grid-cols-2 gap-4">
                                       <form.Field
                                          name="categoryId"
                                          validators={{
                                             onSubmit: ({ value }) =>
                                                !value
                                                   ? "Categoria é obrigatória."
                                                   : undefined,
                                          }}
                                       >
                                          {(field) => (
                                             <Field>
                                                <FieldLabel>
                                                   Categoria
                                                </FieldLabel>
                                                <Combobox
                                                   className="w-full"
                                                   createLabel="Criar categoria"
                                                   emptyMessage="Nenhuma categoria cadastrada."
                                                   onCreate={(name) =>
                                                      createCategoryMutation.mutate(
                                                         {
                                                            name,
                                                            type:
                                                               type ===
                                                                  "income" ||
                                                               type ===
                                                                  "expense"
                                                                  ? type
                                                                  : undefined,
                                                         },
                                                      )
                                                   }
                                                   onValueChange={(v) => {
                                                      field.handleChange(v);
                                                      form.setFieldValue(
                                                         "subcategoryId",
                                                         "",
                                                      );
                                                   }}
                                                   options={categories
                                                      .filter(
                                                         (cat) =>
                                                            !cat.type ||
                                                            cat.type === type,
                                                      )
                                                      .map((cat) => ({
                                                         value: cat.id,
                                                         label: cat.name,
                                                      }))}
                                                   placeholder="Selecione a categoria..."
                                                   searchPlaceholder="Buscar categoria..."
                                                   value={field.state.value}
                                                />
                                                <FieldError
                                                   errors={
                                                      field.state.meta.errors
                                                   }
                                                />
                                             </Field>
                                          )}
                                       </form.Field>

                                       <form.Field name="paymentMethod">
                                          {(field) => (
                                             <Field>
                                                <FieldLabel>
                                                   Forma de pagamento
                                                </FieldLabel>
                                                <Select
                                                   onValueChange={(v) =>
                                                      field.handleChange(
                                                         v as PaymentMethod,
                                                      )
                                                   }
                                                   value={field.state.value}
                                                >
                                                   <SelectTrigger>
                                                      <SelectValue placeholder="Selecione (opcional)" />
                                                   </SelectTrigger>
                                                   <SelectContent>
                                                      <SelectItem value="pix">
                                                         Pix
                                                      </SelectItem>
                                                      <SelectItem value="credit_card">
                                                         Cartão
                                                      </SelectItem>
                                                      <SelectItem value="boleto">
                                                         Boleto
                                                      </SelectItem>
                                                      <SelectItem value="cash">
                                                         Dinheiro
                                                      </SelectItem>
                                                      <SelectItem value="transfer">
                                                         Transferência
                                                      </SelectItem>
                                                      <SelectItem value="cheque">
                                                         Cheque
                                                      </SelectItem>
                                                      <SelectItem value="automatic_debit">
                                                         Débito Automático
                                                      </SelectItem>
                                                   </SelectContent>
                                                </Select>
                                             </Field>
                                          )}
                                       </form.Field>
                                    </div>

                                    {categoryId && (
                                       <form.Field name="subcategoryId">
                                          {(field) => (
                                             <Field>
                                                <FieldLabel>
                                                   Subcategoria
                                                </FieldLabel>
                                                <Combobox
                                                   className="w-full"
                                                   createLabel="Criar subcategoria"
                                                   emptyMessage="Nenhuma subcategoria."
                                                   onCreate={(name) =>
                                                      createSubcategoryMutation.mutate(
                                                         {
                                                            name,
                                                            categoryId,
                                                         },
                                                      )
                                                   }
                                                   onValueChange={
                                                      field.handleChange
                                                   }
                                                   options={selectedSubcategories.map(
                                                      (s) => ({
                                                         value: s.id,
                                                         label: s.name,
                                                      }),
                                                   )}
                                                   placeholder="Selecione a subcategoria..."
                                                   searchPlaceholder="Buscar subcategoria..."
                                                   value={field.state.value}
                                                />
                                             </Field>
                                          )}
                                       </form.Field>
                                    )}
                                 </>
                              )}
                           </>
                        );
                     }}
                  </form.Subscribe>

                  <form.Subscribe selector={(s) => s.values.type}>
                     {(type) => (
                        <div className="grid grid-cols-2 gap-4">
                           <form.Field name="tagIds">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>
                                       {isBusiness
                                          ? "Centros de Custo"
                                          : "Tags"}
                                    </FieldLabel>
                                    <Suspense
                                       fallback={
                                          <p className="text-sm text-muted-foreground">
                                             {isBusiness
                                                ? "Carregando centros de custo..."
                                                : "Carregando tags..."}
                                          </p>
                                       }
                                    >
                                       <TagCombobox
                                          onChange={field.handleChange}
                                          onCreate={(name) =>
                                             createTagMutation.mutate({
                                                name,
                                             })
                                          }
                                          selectedIds={field.state.value}
                                       />
                                    </Suspense>
                                 </Field>
                              )}
                           </form.Field>

                           {type !== "transfer" ? (
                              <form.Field name="contactId">
                                 {(field) => (
                                    <Field>
                                       <FieldLabel>Contato</FieldLabel>
                                       <Suspense
                                          fallback={
                                             <Skeleton className="h-9 w-full" />
                                          }
                                       >
                                          <ContactCombobox
                                             onChange={field.handleChange}
                                             onCreate={(name) =>
                                                createContactMutation.mutate({
                                                   name,
                                                   type: "ambos",
                                                })
                                             }
                                             value={field.state.value}
                                          />
                                       </Suspense>
                                    </Field>
                                 )}
                              </form.Field>
                           ) : null}
                        </div>
                     )}
                  </form.Subscribe>

                  <form.Field name="description">
                     {(field) => (
                        <Field>
                           <FieldLabel>Observações</FieldLabel>
                           <Textarea
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Observações sobre o lançamento (opcional)"
                              rows={3}
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>

                  <form.Subscribe
                     selector={(s) => ({
                        type: s.values.type,
                        isInstallment: s.values.isInstallment,
                        isRecurring: s.values.isRecurring,
                     })}
                  >
                     {({ type, isInstallment, isRecurring }) =>
                        type !== "transfer" ? (
                           <div className="flex flex-col gap-4">
                              <div className="grid grid-cols-2 gap-4">
                                 <form.Field name="isInstallment">
                                    {(field) => (
                                       <div className="flex items-center justify-between rounded-lg border p-3">
                                          <label
                                             className="text-sm font-medium cursor-pointer select-none"
                                             htmlFor="isInstallment"
                                          >
                                             Parcelado
                                          </label>
                                          <Switch
                                             checked={field.state.value}
                                             id="isInstallment"
                                             onCheckedChange={(v) => {
                                                field.handleChange(v);
                                                if (!v)
                                                   form.setFieldValue(
                                                      "installmentCount",
                                                      null,
                                                   );
                                                if (v) {
                                                   form.setFieldValue(
                                                      "isRecurring",
                                                      false,
                                                   );
                                                   form.setFieldValue(
                                                      "recurringFrequency",
                                                      null,
                                                   );
                                                }
                                             }}
                                          />
                                       </div>
                                    )}
                                 </form.Field>

                                 <form.Field name="isRecurring">
                                    {(field) => (
                                       <div className="flex items-center justify-between rounded-lg border p-3">
                                          <label
                                             className="text-sm font-medium cursor-pointer select-none"
                                             htmlFor="isRecurring"
                                          >
                                             Recorrente
                                          </label>
                                          <Switch
                                             checked={field.state.value}
                                             id="isRecurring"
                                             onCheckedChange={(v) => {
                                                field.handleChange(v);
                                                if (!v)
                                                   form.setFieldValue(
                                                      "recurringFrequency",
                                                      null,
                                                   );
                                                if (v) {
                                                   form.setFieldValue(
                                                      "isInstallment",
                                                      false,
                                                   );
                                                   form.setFieldValue(
                                                      "installmentCount",
                                                      null,
                                                   );
                                                }
                                             }}
                                          />
                                       </div>
                                    )}
                                 </form.Field>
                              </div>

                              {isInstallment && (
                                 <form.Field name="installmentCount">
                                    {(field) => (
                                       <Field>
                                          <FieldLabel>
                                             Número de parcelas
                                          </FieldLabel>
                                          <Input
                                             id={field.name}
                                             max={72}
                                             min={2}
                                             onBlur={field.handleBlur}
                                             onChange={(e) =>
                                                field.handleChange(
                                                   e.target.value
                                                      ? Number(e.target.value)
                                                      : null,
                                                )
                                             }
                                             placeholder="Ex: 3"
                                             type="number"
                                             value={field.state.value ?? ""}
                                          />
                                       </Field>
                                    )}
                                 </form.Field>
                              )}

                              {isRecurring && (
                                 <div className="grid grid-cols-2 gap-4">
                                    <form.Field name="recurringFrequency">
                                       {(field) => (
                                          <Field>
                                             <FieldLabel>Frequência</FieldLabel>
                                             <Select
                                                onValueChange={
                                                   field.handleChange
                                                }
                                                value={field.state.value ?? ""}
                                             >
                                                <SelectTrigger>
                                                   <SelectValue placeholder="Selecione a frequência" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                   <SelectItem value="daily">
                                                      Diária
                                                   </SelectItem>
                                                   <SelectItem value="weekly">
                                                      Semanal
                                                   </SelectItem>
                                                   <SelectItem value="biweekly">
                                                      Quinzenal
                                                   </SelectItem>
                                                   <SelectItem value="monthly">
                                                      Mensal
                                                   </SelectItem>
                                                   <SelectItem value="yearly">
                                                      Anual
                                                   </SelectItem>
                                                </SelectContent>
                                             </Select>
                                          </Field>
                                       )}
                                    </form.Field>

                                    <form.Field name="recurringCount">
                                       {(field) => (
                                          <Field>
                                             <FieldLabel>Repetições</FieldLabel>
                                             <Input
                                                id={field.name}
                                                max={120}
                                                min={2}
                                                onBlur={field.handleBlur}
                                                onChange={(e) =>
                                                   field.handleChange(
                                                      e.target.value
                                                         ? Number(
                                                              e.target.value,
                                                           )
                                                         : null,
                                                   )
                                                }
                                                placeholder="Ex: 12"
                                                type="number"
                                                value={field.state.value ?? ""}
                                             />
                                          </Field>
                                       )}
                                    </form.Field>
                                 </div>
                              )}
                           </div>
                        ) : null
                     }
                  </form.Subscribe>

                  {isCreate && (
                     <form.Subscribe
                        selector={(s) => ({
                           date: s.values.date,
                           type: s.values.type,
                        })}
                     >
                        {({ date, type }) => {
                           const isFuture = date && date > new Date();
                           return (
                              <>
                                 {isFuture && (
                                    <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
                                       Este lançamento é no futuro. Considere
                                       registrá-la como conta a pagar.
                                    </div>
                                 )}

                                 {type === "expense" && (
                                    <form.Field name="createAsBill">
                                       {(field) => (
                                          <Field>
                                             <div className="flex items-center gap-2">
                                                <Checkbox
                                                   checked={field.state.value}
                                                   id="createAsBill"
                                                   onCheckedChange={(v) =>
                                                      field.handleChange(!!v)
                                                   }
                                                />
                                                <label
                                                   className="text-sm cursor-pointer select-none"
                                                   htmlFor="createAsBill"
                                                >
                                                   Registrar como conta a pagar
                                                   (não pago ainda)
                                                </label>
                                             </div>
                                          </Field>
                                       )}
                                    </form.Field>
                                 )}
                              </>
                           );
                        }}
                     </form.Subscribe>
                  )}
               </FieldGroup>
            </CredenzaBody>

            <CredenzaFooter>
               <form.Subscribe>
                  {(formState) => {
                     const createAsBill =
                        isCreate &&
                        formState.values.createAsBill &&
                        formState.values.type === "expense";
                     return (
                        <Button
                           className="w-full"
                           disabled={!formState.canSubmit || isPending}
                           type="submit"
                        >
                           {isPending ? (
                              <Spinner className="size-4 mr-2" />
                           ) : null}
                           {createAsBill
                              ? "Criar conta a pagar"
                              : isCreate
                                ? "Criar lançamento"
                                : "Salvar alterações"}
                        </Button>
                     );
                  }}
               </form.Subscribe>
            </CredenzaFooter>
         </form>
      </>
   );
}

export function TransactionCredenza({
   mode,
   transaction,
   onSuccess,
}: TransactionCredenzaProps) {
   return (
      <Suspense
         fallback={
            <>
               <CredenzaHeader>
                  <CredenzaTitle>
                     {mode === "create"
                        ? "Novo Lançamento"
                        : "Editar Lançamento"}
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
