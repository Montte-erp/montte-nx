import type { Attachment } from "@core/database/schemas/transactions";
import { Button } from "@packages/ui/components/button";
import { Checkbox } from "@packages/ui/components/checkbox";
import type { ComboboxOption } from "@packages/ui/components/combobox";
import { Combobox } from "@packages/ui/components/combobox";
import { DatePicker } from "@packages/ui/components/date-picker";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
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
import { useBlocker } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Plus } from "lucide-react";
import { QueryBoundary } from "@/components/query-boundary";
import { toast } from "sonner";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
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

const bankAccountIdSchema = z.string().uuid("Conta vinculada inválida.");
const daySchema = z
   .number()
   .int("Dia deve ser um número inteiro.")
   .min(1, "Dia deve ser entre 1 e 31.")
   .max(31, "Dia deve ser entre 1 e 31.");

const amountSchema = z
   .string()
   .min(1, "Campo obrigatório.")
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

const transactionFormSchema = z.object({
   name: z.string().default(""),
   type: z.enum(["income", "expense", "transfer"]).default("income"),
   amount: z.string().default(""),
   date: z.date().optional(),
   bankAccountId: z.string().default(""),
   destinationBankAccountId: z.string().default(""),
   categoryId: z.string().default(""),
   subcategoryId: z.string().default(""),
   tagIds: z.array(z.string()).default([]),
   description: z.string().default(""),
   contactId: z.string().nullable().default(null),
   creditCardId: z.string().default(""),
   createAsBill: z.boolean().default(false),
   paymentMethod: z.string().default(""),
   isInstallment: z.boolean().default(false),
   installmentCount: z.number().nullable().default(null),
   isRecurring: z.boolean().default(false),
   recurringFrequency: z.string().nullable().default(null),
   recurringCount: z.number().nullable().default(null),
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

function buildTransactionDefaultValues(
   transaction?: TransactionRow,
): TransactionFormValues {
   return transactionFormSchema.parse({
      name: transaction?.name,
      type: transaction?.type,
      amount: transaction?.amount,
      date: transaction?.date
         ? dayjs(`${transaction.date}T12:00:00`).toDate()
         : undefined,
      bankAccountId: transaction?.bankAccountId,
      destinationBankAccountId: transaction?.destinationBankAccountId,
      categoryId: transaction?.categoryId,
      contactId: transaction?.contactId,
      creditCardId: transaction?.creditCardId,
      paymentMethod: transaction?.paymentMethod,
      isInstallment: transaction?.isInstallment,
      installmentCount: transaction?.installmentCount,
   });
}

function TagCombobox({
   selectedIds,
   onChange,
}: {
   selectedIds: string[];
   onChange: (ids: string[]) => void;
}) {
   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));

   return (
      <div className="flex flex-col gap-2">
         <div className="flex flex-wrap gap-2">
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
         <p className="text-xs text-muted-foreground">
            Use o botão + para criar centros de custos
         </p>
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

function NovaConta({ onSuccess }: { onSuccess: (id: string) => void }) {
   const mutation = useMutation(
      orpc.bankAccounts.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Conta criada.");
            onSuccess(data.id);
         },
      }),
   );
   const form = useForm({
      defaultValues: {
         name: "",
         accountType: "checking" as "checking" | "savings" | "investment",
      },
      onSubmit: ({ value }) =>
         mutation.mutate({ name: value.name, type: value.accountType }),
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
            <CredenzaTitle>Nova Conta</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           name={field.name}
                           aria-invalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0
                           }
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Nubank, Bradesco"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               />
               <form.Field
                  name="accountType"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Tipo de conta</FieldLabel>
                        <Select
                           onValueChange={(v) =>
                              field.handleChange(
                                 v as "checking" | "savings" | "investment",
                              )
                           }
                           value={field.state.value}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Tipo" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="checking">Corrente</SelectItem>
                              <SelectItem value="savings">Poupança</SelectItem>
                              <SelectItem value="investment">
                                 Investimento
                              </SelectItem>
                           </SelectContent>
                        </Select>
                     </Field>
                  )}
               />
            </FieldGroup>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
               {({ canSubmit }) => (
                  <Button
                     className="w-full"
                     disabled={!canSubmit || mutation.isPending}
                     type="submit"
                  >
                     {mutation.isPending ? (
                        <Spinner className="size-4" />
                     ) : null}
                     Criar conta
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

function NovoCartao({ onSuccess }: { onSuccess: (id: string) => void }) {
   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const mutation = useMutation(
      orpc.creditCards.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Cartão criado.");
            onSuccess(data.id);
         },
      }),
   );
   const form = useForm({
      defaultValues: {
         name: "",
         bankAccountId: "",
         closingDay: 25,
         dueDay: 5,
      },
      onSubmit: ({ value }) =>
         mutation.mutate({
            name: value.name,
            closingDay: value.closingDay,
            dueDay: value.dueDay,
            bankAccountId: value.bankAccountId,
         }),
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
            <CredenzaTitle>Novo Cartão</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           name={field.name}
                           aria-invalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0
                           }
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Nubank, Visa"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               />
               <form.Field
                  name="bankAccountId"
                  validators={{ onBlur: bankAccountIdSchema }}
                  children={(field) => (
                     <Field>
                        <FieldLabel>
                           Conta vinculada{" "}
                           <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Combobox
                           className="w-full"
                           emptyMessage="Nenhuma conta cadastrada."
                           onValueChange={field.handleChange}
                           options={bankAccounts.map((a) => ({
                              value: a.id,
                              label: a.name,
                           }))}
                           placeholder="Selecione a conta..."
                           searchPlaceholder="Buscar conta..."
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               />
               <div className="grid grid-cols-2 gap-4">
                  <form.Field
                     name="closingDay"
                     validators={{ onBlur: daySchema }}
                     children={(field) => (
                        <Field>
                           <FieldLabel>Dia de fechamento</FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={
                                 field.state.meta.isTouched &&
                                 field.state.meta.errors.length > 0
                              }
                              max={31}
                              min={1}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(Number(e.target.value))
                              }
                              type="number"
                              value={field.state.value}
                           />
                           <FieldError errors={field.state.meta.errors} />
                        </Field>
                     )}
                  />
                  <form.Field
                     name="dueDay"
                     validators={{ onBlur: daySchema }}
                     children={(field) => (
                        <Field>
                           <FieldLabel>Dia de vencimento</FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={
                                 field.state.meta.isTouched &&
                                 field.state.meta.errors.length > 0
                              }
                              max={31}
                              min={1}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(Number(e.target.value))
                              }
                              type="number"
                              value={field.state.value}
                           />
                           <FieldError errors={field.state.meta.errors} />
                        </Field>
                     )}
                  />
               </div>
            </FieldGroup>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
               {({ canSubmit }) => (
                  <Button
                     className="w-full"
                     disabled={!canSubmit || mutation.isPending}
                     type="submit"
                  >
                     {mutation.isPending ? (
                        <Spinner className="size-4" />
                     ) : null}
                     Criar cartão
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

function NovoContato({ onSuccess }: { onSuccess: (id: string) => void }) {
   const mutation = useMutation(
      orpc.contacts.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Contato criado.");
            onSuccess(data.id);
         },
      }),
   );
   const form = useForm({
      defaultValues: { name: "" },
      onSubmit: ({ value }) =>
         mutation.mutate({ name: value.name, type: "ambos" }),
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
            <CredenzaTitle>Novo Contato</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           name={field.name}
                           aria-invalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0
                           }
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: João Silva"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               />
            </FieldGroup>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
               {({ canSubmit }) => (
                  <Button
                     className="w-full"
                     disabled={!canSubmit || mutation.isPending}
                     type="submit"
                  >
                     {mutation.isPending ? (
                        <Spinner className="size-4" />
                     ) : null}
                     Criar contato
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

function NovaCategoria({
   onSuccess,
   transactionType,
}: {
   onSuccess: (id: string) => void;
   transactionType: "income" | "expense";
}) {
   const mutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Categoria criada.");
            onSuccess(data.id);
         },
      }),
   );
   const form = useForm({
      defaultValues: { name: "" },
      onSubmit: ({ value }) =>
         mutation.mutate({ name: value.name, type: transactionType }),
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
            <CredenzaTitle>Nova Categoria</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           name={field.name}
                           aria-invalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0
                           }
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Alimentação, Transporte"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               />
            </FieldGroup>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
               {({ canSubmit }) => (
                  <Button
                     className="w-full"
                     disabled={!canSubmit || mutation.isPending}
                     type="submit"
                  >
                     {mutation.isPending ? (
                        <Spinner className="size-4" />
                     ) : null}
                     Criar categoria
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

function NovaTag({ onSuccess }: { onSuccess: (id: string) => void }) {
   const mutation = useMutation(
      orpc.tags.create.mutationOptions({
         onSuccess: (data) => {
            toast.success("Centro de Custo criada.");
            onSuccess(data.id);
         },
      }),
   );
   const form = useForm({
      defaultValues: { name: "" },
      onSubmit: ({ value }) => mutation.mutate({ name: value.name }),
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
            <CredenzaTitle>Novo Centro de Custo</CredenzaTitle>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           name={field.name}
                           aria-invalid={
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0
                           }
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Marketing, Pessoal"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               />
            </FieldGroup>
         </CredenzaBody>
         <CredenzaFooter>
            <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
               {({ canSubmit }) => (
                  <Button
                     className="w-full"
                     disabled={!canSubmit || mutation.isPending}
                     type="submit"
                  >
                     {mutation.isPending ? (
                        <Spinner className="size-4" />
                     ) : null}
                     Criar centro de custo
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

function TransactionCredenzaContent({
   mode,
   transaction,
   onSuccess,
}: TransactionCredenzaProps) {
   const isCreate = mode === "create";
   const { openCredenza, closeTopCredenza } = useCredenza();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const { data: creditCardsResult } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({ input: { pageSize: 100 } }),
   );
   const creditCards = creditCardsResult.data;

   const { openAlertDialog } = useAlertDialog();

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions(),
   );
   const updateMutation = useMutation(
      orpc.transactions.update.mutationOptions(),
   );
   const billCreateMutation = useMutation(orpc.bills.create.mutationOptions());

   const form = useForm({
      defaultValues: buildTransactionDefaultValues(transaction),
      validators: {
         onSubmitAsync: async ({ value }) => {
            const dateStr = value.date
               ? dayjs(value.date).format("YYYY-MM-DD")
               : "";
            const isTransfer = value.type === "transfer";

            try {
               if (isCreate && value.createAsBill && value.type === "expense") {
                  await billCreateMutation.mutateAsync({
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
                  toast.success("Conta a pagar criada com sucesso.");
                  onSuccess();
                  return null;
               }

               const tagIdsTouched =
                  form.getFieldMeta("tagIds")?.isTouched ?? false;

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
                  subcategoryId: isTransfer
                     ? null
                     : value.subcategoryId || null,
                  attachments: [] as Attachment[],
                  tagIds: isCreate || tagIdsTouched ? value.tagIds : undefined,
                  description: value.description || null,
                  contactId: value.contactId,
                  creditCardId:
                     value.type === "expense"
                        ? value.creditCardId || null
                        : null,
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
                  await createMutation.mutateAsync(payload);
                  toast.success("Lançamento criado com sucesso.");
               } else if (transaction) {
                  await updateMutation.mutateAsync({
                     id: transaction.id,
                     ...payload,
                  });
                  toast.success("Lançamento atualizado com sucesso.");
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
               {isCreate ? "Novo Lançamento" : "Editar Lançamento"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Registre um novo lançamento financeiro."
                  : "Atualize os dados do lançamento."}
            </CredenzaDescription>
         </CredenzaHeader>
         <CredenzaBody className="px-4">
            <FieldGroup>
               <div className="grid grid-cols-[3fr_2fr] gap-4">
                  <form.Field
                     name="name"
                     children={(field) => (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Nome <span className="text-destructive">*</span>
                           </FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={
                                 field.state.meta.isTouched &&
                                 field.state.meta.errors.length > 0
                              }
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Almoço, Salário"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  />

                  <form.Field
                     name="type"
                     children={(field) => (
                        <Field>
                           <FieldLabel>
                              Tipo <span className="text-destructive">*</span>
                           </FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 field.handleChange(v as TransactionType);
                                 if (v === "transfer") {
                                    form.setFieldValue("categoryId", "");
                                    form.setFieldValue("subcategoryId", "");
                                    form.setFieldValue("paymentMethod", "");
                                    form.setFieldValue("isInstallment", false);
                                    form.setFieldValue(
                                       "installmentCount",
                                       null,
                                    );
                                    form.setFieldValue("isRecurring", false);
                                    form.setFieldValue(
                                       "recurringFrequency",
                                       null,
                                    );
                                    form.setFieldValue("recurringCount", null);
                                    form.setFieldValue("creditCardId", "");
                                    form.setFieldValue("contactId", null);
                                 } else {
                                    const currentCatId =
                                       form.getFieldValue("categoryId");
                                    if (currentCatId) {
                                       const cat = categories.find(
                                          (c) => c.id === currentCatId,
                                       );
                                       if (cat?.type && cat.type !== v) {
                                          form.setFieldValue("categoryId", "");
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
                                 <SelectItem value="income">Receita</SelectItem>
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
                  />
               </div>

               <form.Subscribe
                  selector={(s) => ({
                     type: s.values.type,
                     bankAccountId: s.values.bankAccountId,
                     categoryId: s.values.categoryId,
                  })}
               >
                  {({ type, bankAccountId, categoryId }) => {
                     const isTransfer = type === "transfer";
                     const selectedSubcategories = categories.filter(
                        (c) => c.parentId === categoryId,
                     );

                     return (
                        <>
                           {isTransfer ? (
                              <>
                                 <div className="grid grid-cols-2 gap-4">
                                    <form.Field
                                       name="date"
                                       validators={{
                                          onSubmit: requiredDateSchema,
                                       }}
                                       children={(field) => {
                                          const isInvalid =
                                             field.state.meta.isTouched &&
                                             field.state.meta.errors.length > 0;
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
                                                         field.state.meta.errors
                                                      }
                                                   />
                                                )}
                                             </Field>
                                          );
                                       }}
                                    />

                                    <form.Field
                                       name="amount"
                                       validators={{
                                          onBlur: amountSchema,
                                          onSubmit: amountSchema,
                                       }}
                                       children={(field) => {
                                          const isInvalid =
                                             field.state.meta.isTouched &&
                                             field.state.meta.errors.length > 0;
                                          return (
                                             <Field data-invalid={isInvalid}>
                                                <FieldLabel>
                                                   Valor{" "}
                                                   <span className="text-destructive">
                                                      *
                                                   </span>
                                                </FieldLabel>
                                                <MoneyInput
                                                   disabled={false}
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
                                                         field.state.meta.errors
                                                      }
                                                   />
                                                )}
                                             </Field>
                                          );
                                       }}
                                    />
                                 </div>

                                 <div className="grid grid-cols-2 gap-4">
                                    <form.Field
                                       name="bankAccountId"
                                       validators={{
                                          onSubmit: requiredStringSchema,
                                       }}
                                       children={(field) => {
                                          const isInvalid =
                                             field.state.meta.isTouched &&
                                             field.state.meta.errors.length > 0;
                                          return (
                                             <Field data-invalid={isInvalid}>
                                                <div className="flex items-center justify-between">
                                                   <FieldLabel>
                                                      Conta de Origem{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <button
                                                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                      onClick={() =>
                                                         openCredenza({
                                                            children: (
                                                               <NovaConta
                                                                  onSuccess={(
                                                                     id,
                                                                  ) => {
                                                                     form.setFieldValue(
                                                                        "bankAccountId",
                                                                        id,
                                                                     );
                                                                     closeTopCredenza();
                                                                  }}
                                                               />
                                                            ),
                                                         })
                                                      }
                                                      type="button"
                                                   >
                                                      <Plus className="size-3" />{" "}
                                                      Nova
                                                   </button>
                                                </div>
                                                <Combobox
                                                   className="w-full"
                                                   emptyMessage="Nenhuma conta cadastrada."
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
                                                         field.state.meta.errors
                                                      }
                                                   />
                                                )}
                                             </Field>
                                          );
                                       }}
                                    />

                                    <form.Field
                                       name="destinationBankAccountId"
                                       validators={{
                                          onSubmit: requiredStringSchema,
                                       }}
                                       children={(field) => {
                                          const isInvalid =
                                             field.state.meta.isTouched &&
                                             field.state.meta.errors.length > 0;
                                          return (
                                             <Field data-invalid={isInvalid}>
                                                <div className="flex items-center justify-between">
                                                   <FieldLabel>
                                                      Conta de Destino{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <button
                                                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                      onClick={() =>
                                                         openCredenza({
                                                            children: (
                                                               <NovaConta
                                                                  onSuccess={(
                                                                     id,
                                                                  ) => {
                                                                     form.setFieldValue(
                                                                        "destinationBankAccountId",
                                                                        id,
                                                                     );
                                                                     closeTopCredenza();
                                                                  }}
                                                               />
                                                            ),
                                                         })
                                                      }
                                                      type="button"
                                                   >
                                                      <Plus className="size-3" />{" "}
                                                      Nova
                                                   </button>
                                                </div>
                                                <Combobox
                                                   className="w-full"
                                                   emptyMessage="Nenhuma conta cadastrada."
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
                                                         field.state.meta.errors
                                                      }
                                                   />
                                                )}
                                             </Field>
                                          );
                                       }}
                                    />
                                 </div>
                              </>
                           ) : (
                              <>
                                 <div className="grid grid-cols-3 gap-4">
                                    <form.Field
                                       name="date"
                                       validators={{
                                          onSubmit: requiredDateSchema,
                                       }}
                                       children={(field) => {
                                          const isInvalid =
                                             field.state.meta.isTouched &&
                                             field.state.meta.errors.length > 0;
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
                                                         field.state.meta.errors
                                                      }
                                                   />
                                                )}
                                             </Field>
                                          );
                                       }}
                                    />

                                    <form.Field
                                       name="amount"
                                       validators={{
                                          onBlur: amountSchema,
                                          onSubmit: amountSchema,
                                       }}
                                       children={(field) => {
                                          const isInvalid =
                                             field.state.meta.isTouched &&
                                             field.state.meta.errors.length > 0;
                                          return (
                                             <Field data-invalid={isInvalid}>
                                                <FieldLabel>
                                                   Valor{" "}
                                                   <span className="text-destructive">
                                                      *
                                                   </span>
                                                </FieldLabel>
                                                <MoneyInput
                                                   disabled={false}
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
                                                         field.state.meta.errors
                                                      }
                                                   />
                                                )}
                                             </Field>
                                          );
                                       }}
                                    />

                                    <form.Field
                                       name="bankAccountId"
                                       validators={{
                                          onSubmit: requiredStringSchema,
                                       }}
                                       children={(field) => {
                                          const isInvalid =
                                             field.state.meta.isTouched &&
                                             field.state.meta.errors.length > 0;
                                          return (
                                             <Field data-invalid={isInvalid}>
                                                <div className="flex items-center justify-between">
                                                   <FieldLabel>
                                                      Conta{" "}
                                                      <span className="text-destructive">
                                                         *
                                                      </span>
                                                   </FieldLabel>
                                                   <button
                                                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                      onClick={() =>
                                                         openCredenza({
                                                            children: (
                                                               <NovaConta
                                                                  onSuccess={(
                                                                     id,
                                                                  ) => {
                                                                     form.setFieldValue(
                                                                        "bankAccountId",
                                                                        id,
                                                                     );
                                                                     closeTopCredenza();
                                                                  }}
                                                               />
                                                            ),
                                                         })
                                                      }
                                                      type="button"
                                                   >
                                                      <Plus className="size-3" />{" "}
                                                      Nova
                                                   </button>
                                                </div>
                                                <Combobox
                                                   className="w-full"
                                                   emptyMessage="Nenhuma conta cadastrada."
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
                                                         field.state.meta.errors
                                                      }
                                                   />
                                                )}
                                             </Field>
                                          );
                                       }}
                                    />
                                 </div>
                              </>
                           )}

                           {type === "expense" && (
                              <form.Field
                                 name="creditCardId"
                                 children={(field) => (
                                    <Field>
                                       <div className="flex items-center justify-between">
                                          <FieldLabel>
                                             Cartão de Crédito
                                          </FieldLabel>
                                          <button
                                             className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                             onClick={() =>
                                                openCredenza({
                                                   children: (
                                                      <QueryBoundary
                                                         fallback={
                                                            <Skeleton className="h-40 w-full" />
                                                         }
                                                         errorTitle="Erro ao carregar contas"
                                                      >
                                                         <NovoCartao
                                                            onSuccess={(id) => {
                                                               form.setFieldValue(
                                                                  "creditCardId",
                                                                  id,
                                                               );
                                                               closeTopCredenza();
                                                            }}
                                                         />
                                                      </QueryBoundary>
                                                   ),
                                                })
                                             }
                                             type="button"
                                          >
                                             <Plus className="size-3" /> Novo
                                          </button>
                                       </div>
                                       <Combobox
                                          className="w-full"
                                          emptyMessage="Nenhum cartão cadastrado."
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
                              />
                           )}

                           {!isTransfer && (
                              <>
                                 <div className="grid grid-cols-2 gap-4">
                                    <form.Field
                                       name="categoryId"
                                       validators={{
                                          onSubmit: ({ value }) =>
                                             !value
                                                ? "Categoria é obrigatória."
                                                : undefined,
                                       }}
                                       children={(field) => (
                                          <Field>
                                             <div className="flex items-center justify-between">
                                                <FieldLabel>
                                                   Categoria
                                                </FieldLabel>
                                                <button
                                                   className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                   onClick={() =>
                                                      openCredenza({
                                                         children: (
                                                            <NovaCategoria
                                                               transactionType={
                                                                  type ===
                                                                     "income" ||
                                                                  type ===
                                                                     "expense"
                                                                     ? type
                                                                     : "expense"
                                                               }
                                                               onSuccess={(
                                                                  id,
                                                               ) => {
                                                                  form.setFieldValue(
                                                                     "categoryId",
                                                                     id,
                                                                  );
                                                                  closeTopCredenza();
                                                               }}
                                                            />
                                                         ),
                                                      })
                                                   }
                                                   type="button"
                                                >
                                                   <Plus className="size-3" />{" "}
                                                   Nova
                                                </button>
                                             </div>
                                             <Combobox
                                                className="w-full"
                                                emptyMessage="Nenhuma categoria cadastrada."
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
                                                         !cat.parentId &&
                                                         (!cat.type ||
                                                            cat.type === type),
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
                                                   field.state.meta.errors as (
                                                      | {
                                                           message?: string;
                                                        }
                                                      | undefined
                                                   )[]
                                                }
                                             />
                                          </Field>
                                       )}
                                    />

                                    <form.Field
                                       name="paymentMethod"
                                       children={(field) => (
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
                                    />
                                 </div>

                                 {categoryId && (
                                    <form.Field
                                       name="subcategoryId"
                                       children={(field) => (
                                          <Field>
                                             <FieldLabel>
                                                Subcategoria
                                             </FieldLabel>
                                             <Combobox
                                                className="w-full"
                                                emptyMessage="Nenhuma subcategoria."
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
                                    />
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
                        <form.Field
                           name="tagIds"
                           children={(field) => (
                              <Field>
                                 <div className="flex items-center justify-between">
                                    <FieldLabel>Centros de Custo</FieldLabel>
                                    <button
                                       className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                       onClick={() =>
                                          openCredenza({
                                             children: (
                                                <NovaTag
                                                   onSuccess={(id) => {
                                                      form.setFieldValue(
                                                         "tagIds",
                                                         [
                                                            ...form.getFieldValue(
                                                               "tagIds",
                                                            ),
                                                            id,
                                                         ],
                                                      );
                                                      form.setFieldMeta(
                                                         "tagIds",
                                                         (prev) => ({
                                                            ...prev,
                                                            isTouched: true,
                                                         }),
                                                      );
                                                      closeTopCredenza();
                                                   }}
                                                />
                                             ),
                                          })
                                       }
                                       type="button"
                                    >
                                       <Plus className="size-3" /> Nova
                                    </button>
                                 </div>
                                 <QueryBoundary
                                    fallback={
                                       <p className="text-sm text-muted-foreground">
                                          Carregando centros de custo...
                                       </p>
                                    }
                                    errorTitle="Erro ao carregar centros de custo"
                                 >
                                    <TagCombobox
                                       onChange={field.handleChange}
                                       selectedIds={field.state.value}
                                    />
                                 </QueryBoundary>
                              </Field>
                           )}
                        />

                        {type !== "transfer" ? (
                           <form.Field
                              name="contactId"
                              children={(field) => (
                                 <Field>
                                    <div className="flex items-center justify-between">
                                       <FieldLabel>Contato</FieldLabel>
                                       <button
                                          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                          onClick={() =>
                                             openCredenza({
                                                children: (
                                                   <NovoContato
                                                      onSuccess={(id) => {
                                                         form.setFieldValue(
                                                            "contactId",
                                                            id,
                                                         );
                                                         closeTopCredenza();
                                                      }}
                                                   />
                                                ),
                                             })
                                          }
                                          type="button"
                                       >
                                          <Plus className="size-3" /> Novo
                                       </button>
                                    </div>
                                    <QueryBoundary
                                       fallback={
                                          <Skeleton className="h-9 w-full" />
                                       }
                                       errorTitle="Erro ao carregar contatos"
                                    >
                                       <ContactCombobox
                                          onChange={field.handleChange}
                                          value={field.state.value}
                                       />
                                    </QueryBoundary>
                                 </Field>
                              )}
                           />
                        ) : null}
                     </div>
                  )}
               </form.Subscribe>

               <form.Field
                  name="description"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field>
                           <FieldLabel htmlFor={field.name}>
                              Observações
                           </FieldLabel>
                           <Textarea
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Observações sobre o lançamento (opcional)"
                              rows={3}
                              value={field.state.value}
                           />
                        </Field>
                     );
                  }}
               />

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
                              <form.Field
                                 name="isInstallment"
                                 children={(field) => (
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
                              />

                              <form.Field
                                 name="isRecurring"
                                 children={(field) => (
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
                              />
                           </div>

                           {isInstallment && (
                              <form.Field
                                 name="installmentCount"
                                 children={(field) => (
                                    <Field>
                                       <FieldLabel htmlFor={field.name}>
                                          Número de parcelas
                                       </FieldLabel>
                                       <Input
                                          id={field.name}
                                          name={field.name}
                                          aria-invalid={
                                             field.state.meta.isTouched &&
                                             field.state.meta.errors.length > 0
                                          }
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
                              />
                           )}

                           {isRecurring && (
                              <div className="grid grid-cols-2 gap-4">
                                 <form.Field
                                    name="recurringFrequency"
                                    children={(field) => (
                                       <Field>
                                          <FieldLabel>Frequência</FieldLabel>
                                          <Select
                                             onValueChange={field.handleChange}
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
                                 />

                                 <form.Field
                                    name="recurringCount"
                                    children={(field) => (
                                       <Field>
                                          <FieldLabel htmlFor={field.name}>
                                             Repetições
                                          </FieldLabel>
                                          <Input
                                             id={field.name}
                                             name={field.name}
                                             aria-invalid={
                                                field.state.meta.isTouched &&
                                                field.state.meta.errors.length >
                                                   0
                                             }
                                             max={120}
                                             min={2}
                                             onBlur={field.handleBlur}
                                             onChange={(e) =>
                                                field.handleChange(
                                                   e.target.value
                                                      ? Number(e.target.value)
                                                      : null,
                                                )
                                             }
                                             placeholder="Ex: 12"
                                             type="number"
                                             value={field.state.value ?? ""}
                                          />
                                       </Field>
                                    )}
                                 />
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
                        const isFuture = date && dayjs(date).isAfter(dayjs());
                        return (
                           <>
                              {isFuture && (
                                 <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-700 dark:text-amber-300">
                                    Este lançamento é no futuro. Considere
                                    registrá-la como conta a pagar.
                                 </div>
                              )}

                              {type === "expense" && (
                                 <form.Field
                                    name="createAsBill"
                                    children={(field) => (
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
                                 />
                              )}
                           </>
                        );
                     }}
                  </form.Subscribe>
               )}
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
               selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
                  createAsBill:
                     isCreate &&
                     state.values.createAsBill &&
                     state.values.type === "expense",
               })}
            >
               {({ canSubmit, isSubmitting, createAsBill }) => (
                  <Button
                     className="w-full gap-2"
                     disabled={!canSubmit || isSubmitting}
                     type="submit"
                  >
                     {isSubmitting ? <Spinner className="size-4" /> : null}
                     {createAsBill
                        ? "Criar conta a pagar"
                        : isCreate
                          ? "Criar lançamento"
                          : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}

export function TransactionCredenza({
   mode,
   transaction,
   onSuccess,
}: TransactionCredenzaProps) {
   return (
      <QueryBoundary
         fallback={
            <div className="p-6 flex items-center justify-center">
               <Spinner className="size-6" />
            </div>
         }
      >
         <TransactionCredenzaContent
            mode={mode}
            onSuccess={onSuccess}
            transaction={transaction}
         />
      </QueryBoundary>
   );
}
