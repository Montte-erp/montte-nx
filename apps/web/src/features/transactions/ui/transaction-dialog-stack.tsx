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
   DialogStackContext,
   DialogStackContent,
   DialogStackDescription,
   DialogStackFooter,
   DialogStackHeader,
   DialogStackNext,
   DialogStackPrevious,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
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
import dayjs from "dayjs";
import { ChevronLeft, Plus } from "lucide-react";
import { Suspense, useContext, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAccountType } from "@/hooks/use-account-type";
import { orpc } from "@/integrations/orpc/client";
import type { TransactionRow } from "./transactions-columns";
import type { RateioLine } from "./rateio-section";
import { RateioSection } from "./rateio-section";

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

type SecondaryForm =
   | { type: "bankAccount" }
   | { type: "creditCard" }
   | { type: "contact" }
   | { type: "category"; transactionType: "income" | "expense" }
   | { type: "tag" }
   | null;

interface TransactionCredenzaProps {
   mode: "create" | "edit";
   transaction?: TransactionRow;
   onSuccess: () => void;
}

function TagCombobox({
   selectedIds,
   onChange,
}: {
   selectedIds: string[];
   onChange: (ids: string[]) => void;
}) {
   const { data: tags } = useSuspenseQuery(orpc.tags.getAll.queryOptions({}));
   const { isBusiness } = useAccountType();

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
         <p className="text-xs text-muted-foreground">
            Use o botão + para criar {label}s
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

function NovaConta({
   onSuccess,
   onBack,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
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
      <div className="flex flex-col gap-4">
         <DialogStackHeader>
            <div className="flex items-center gap-2">
               <DialogStackPrevious asChild>
                  <button onClick={onBack} type="button">
                     <ChevronLeft className="size-4" />
                  </button>
               </DialogStackPrevious>
               <DialogStackTitle>Nova Conta</DialogStackTitle>
            </div>
         </DialogStackHeader>
         <form
            onSubmit={(e) => {
               e.preventDefault();
               e.stopPropagation();
               form.handleSubmit();
            }}
         >
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
               >
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Nubank, Bradesco"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               </form.Field>
               <form.Field name="accountType">
                  {(field) => (
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
               </form.Field>
            </FieldGroup>
            <DialogStackFooter>
               <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
                  {({ canSubmit }) => (
                     <Button
                        className="w-full"
                        disabled={!canSubmit || mutation.isPending}
                        type="submit"
                     >
                        {mutation.isPending ? (
                           <Spinner className="size-4 mr-2" />
                        ) : null}
                        Criar conta
                     </Button>
                  )}
               </form.Subscribe>
            </DialogStackFooter>
         </form>
      </div>
   );
}

function NovoCartao({
   onSuccess,
   onBack,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
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
   const bankAccountIdSchema = z.string().uuid("Conta vinculada inválida.");
   const daySchema = z
      .number()
      .int("Dia deve ser um número inteiro.")
      .min(1, "Dia deve ser entre 1 e 31.")
      .max(31, "Dia deve ser entre 1 e 31.");
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
      <div className="flex flex-col gap-4">
         <DialogStackHeader>
            <div className="flex items-center gap-2">
               <DialogStackPrevious asChild>
                  <button onClick={onBack} type="button">
                     <ChevronLeft className="size-4" />
                  </button>
               </DialogStackPrevious>
               <DialogStackTitle>Novo Cartão</DialogStackTitle>
            </div>
         </DialogStackHeader>
         <form
            onSubmit={(e) => {
               e.preventDefault();
               e.stopPropagation();
               form.handleSubmit();
            }}
         >
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
               >
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Nubank, Visa"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               </form.Field>
               <form.Field
                  name="bankAccountId"
                  validators={{ onBlur: bankAccountIdSchema }}
               >
                  {(field) => (
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
               </form.Field>
               <div className="grid grid-cols-2 gap-4">
                  <form.Field
                     name="closingDay"
                     validators={{ onBlur: daySchema }}
                  >
                     {(field) => (
                        <Field>
                           <FieldLabel>Dia de fechamento</FieldLabel>
                           <Input
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
                  </form.Field>
                  <form.Field name="dueDay" validators={{ onBlur: daySchema }}>
                     {(field) => (
                        <Field>
                           <FieldLabel>Dia de vencimento</FieldLabel>
                           <Input
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
                  </form.Field>
               </div>
            </FieldGroup>
            <DialogStackFooter>
               <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
                  {({ canSubmit }) => (
                     <Button
                        className="w-full"
                        disabled={!canSubmit || mutation.isPending}
                        type="submit"
                     >
                        {mutation.isPending ? (
                           <Spinner className="size-4 mr-2" />
                        ) : null}
                        Criar cartão
                     </Button>
                  )}
               </form.Subscribe>
            </DialogStackFooter>
         </form>
      </div>
   );
}

function NovoContato({
   onSuccess,
   onBack,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
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
      <div className="flex flex-col gap-4">
         <DialogStackHeader>
            <div className="flex items-center gap-2">
               <DialogStackPrevious asChild>
                  <button onClick={onBack} type="button">
                     <ChevronLeft className="size-4" />
                  </button>
               </DialogStackPrevious>
               <DialogStackTitle>Novo Contato</DialogStackTitle>
            </div>
         </DialogStackHeader>
         <form
            onSubmit={(e) => {
               e.preventDefault();
               e.stopPropagation();
               form.handleSubmit();
            }}
         >
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
               >
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: João Silva"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
            <DialogStackFooter>
               <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
                  {({ canSubmit }) => (
                     <Button
                        className="w-full"
                        disabled={!canSubmit || mutation.isPending}
                        type="submit"
                     >
                        {mutation.isPending ? (
                           <Spinner className="size-4 mr-2" />
                        ) : null}
                        Criar contato
                     </Button>
                  )}
               </form.Subscribe>
            </DialogStackFooter>
         </form>
      </div>
   );
}

function NovaCategoria({
   onSuccess,
   onBack,
   transactionType,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
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
      <div className="flex flex-col gap-4">
         <DialogStackHeader>
            <div className="flex items-center gap-2">
               <DialogStackPrevious asChild>
                  <button onClick={onBack} type="button">
                     <ChevronLeft className="size-4" />
                  </button>
               </DialogStackPrevious>
               <DialogStackTitle>Nova Categoria</DialogStackTitle>
            </div>
         </DialogStackHeader>
         <form
            onSubmit={(e) => {
               e.preventDefault();
               e.stopPropagation();
               form.handleSubmit();
            }}
         >
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
               >
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Ex: Alimentação, Transporte"
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
            <DialogStackFooter>
               <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
                  {({ canSubmit }) => (
                     <Button
                        className="w-full"
                        disabled={!canSubmit || mutation.isPending}
                        type="submit"
                     >
                        {mutation.isPending ? (
                           <Spinner className="size-4 mr-2" />
                        ) : null}
                        Criar categoria
                     </Button>
                  )}
               </form.Subscribe>
            </DialogStackFooter>
         </form>
      </div>
   );
}

function NovaTag({
   onSuccess,
   onBack,
}: {
   onSuccess: (id: string) => void;
   onBack: () => void;
}) {
   const { isBusiness } = useAccountType();
   const label = isBusiness ? "Centro de Custo" : "Tag";
   const mutation = useMutation(
      orpc.tags.create.mutationOptions({
         onSuccess: (data) => {
            toast.success(`${label} criada.`);
            onSuccess(data.id);
         },
      }),
   );
   const form = useForm({
      defaultValues: { name: "" },
      onSubmit: ({ value }) => mutation.mutate({ name: value.name }),
   });

   return (
      <div className="flex flex-col gap-4">
         <DialogStackHeader>
            <div className="flex items-center gap-2">
               <DialogStackPrevious asChild>
                  <button onClick={onBack} type="button">
                     <ChevronLeft className="size-4" />
                  </button>
               </DialogStackPrevious>
               <DialogStackTitle>Nova {label}</DialogStackTitle>
            </div>
         </DialogStackHeader>
         <form
            onSubmit={(e) => {
               e.preventDefault();
               e.stopPropagation();
               form.handleSubmit();
            }}
         >
            <FieldGroup>
               <form.Field
                  name="name"
                  validators={{ onBlur: requiredStringSchema }}
               >
                  {(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Nome <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                           id={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder={`Ex: Marketing, Pessoal`}
                           value={field.state.value}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
            <DialogStackFooter>
               <form.Subscribe selector={(s) => ({ canSubmit: s.canSubmit })}>
                  {({ canSubmit }) => (
                     <Button
                        className="w-full"
                        disabled={!canSubmit || mutation.isPending}
                        type="submit"
                     >
                        {mutation.isPending ? (
                           <Spinner className="size-4 mr-2" />
                        ) : null}
                        Criar {label.toLowerCase()}
                     </Button>
                  )}
               </form.Subscribe>
            </DialogStackFooter>
         </form>
      </div>
   );
}

function TransactionDialogStackContent({
   mode,
   transaction,
   onSuccess,
}: TransactionCredenzaProps) {
   const isCreate = mode === "create";
   const { isBusiness } = useAccountType();
   const [secondaryForm, setSecondaryForm] = useState<SecondaryForm>(null);
   const { setActiveIndex } = useContext(DialogStackContext);

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );
   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );
   const { data: creditCards } = useSuspenseQuery(
      orpc.creditCards.getAll.queryOptions({}),
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

   const emptyTagIds: string[] = [];
   const emptyRateioLines: RateioLine[] = [];

   const form = useForm({
      defaultValues: {
         name: transaction?.name ?? "",
         type: (transaction?.type ?? "income") as TransactionType,
         amount: transaction?.amount ?? "",
         date: transaction?.date
            ? new Date(`${transaction.date}T12:00:00`)
            : undefined,
         bankAccountId: transaction?.bankAccountId ?? "",
         destinationBankAccountId: transaction?.destinationBankAccountId ?? "",
         categoryId: transaction?.categoryId ?? "",
         subcategoryId: "",
         tagIds: emptyTagIds,
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
         rateioLines: emptyRateioLines,
      },
      onSubmit: ({ value }) => {
         const dateStr = value.date
            ? dayjs(value.date).format("YYYY-MM-DD")
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

         const tagIdsTouched = form.getFieldMeta("tagIds")?.isTouched ?? false;

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
            attachments: [] as Attachment[],
            tagIds: isCreate || tagIdsTouched ? value.tagIds : undefined,
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

   function buildRateioLines(lines: RateioLine[]) {
      return lines
         .filter((l) => l.categoryId && l.amount !== undefined)
         .map((l) => ({
            categoryId: l.categoryId,
            tagId: l.tagId,
            amount: String((l.amount as number) / 100),
         }));
   }

   const setRateioMutation = useMutation(
      orpc.transactions.setRateio.mutationOptions(),
   );

   const createMutation = useMutation(
      orpc.transactions.create.mutationOptions({
         onSuccess: async (data) => {
            const lines = form.getFieldValue("rateioLines");
            const validLines = buildRateioLines(lines);
            const transactionType = form.getFieldValue("type");
            if (
               validLines.length > 0 &&
               data &&
               transactionType !== "transfer"
            ) {
               try {
                  await setRateioMutation.mutateAsync({
                     id: data.id,
                     lines: validLines,
                  });
               } catch (err) {
                  const msg = err instanceof Error ? err.message : undefined;
                  toast.error(msg || "Falha ao salvar rateio.");
                  onSuccess();
                  return;
               }
            }
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
         onSuccess: async (data) => {
            const lines = form.getFieldValue("rateioLines");
            const validLines = buildRateioLines(lines);
            const transactionType = form.getFieldValue("type");
            if (
               validLines.length > 0 &&
               data &&
               transactionType !== "transfer"
            ) {
               try {
                  await setRateioMutation.mutateAsync({
                     id: data.id,
                     lines: validLines,
                  });
               } catch (err) {
                  const msg = err instanceof Error ? err.message : undefined;
                  toast.error(msg || "Falha ao salvar rateio.");
                  onSuccess();
                  return;
               }
            }
            toast.success("Lançamento atualizado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar lançamento.");
         },
      }),
   );

   const isPending =
      createMutation.isPending ||
      updateMutation.isPending ||
      setRateioMutation.isPending ||
      billCreateMutation.isPending;

   return (
      <>
         <DialogStackContent index={0}>
            <DialogStackHeader>
               <DialogStackTitle>
                  {isCreate ? "Novo Lançamento" : "Editar Lançamento"}
               </DialogStackTitle>
               <DialogStackDescription>
                  {isCreate
                     ? "Registre um novo lançamento financeiro."
                     : "Atualize os dados do lançamento."}
               </DialogStackDescription>
            </DialogStackHeader>

            <form
               className="flex flex-1 flex-col overflow-hidden"
               onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
               }}
            >
               <div className="flex-1 overflow-y-auto px-4 py-4">
                  <FieldGroup>
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
                                          form.setFieldValue(
                                             "subcategoryId",
                                             "",
                                          );
                                          form.setFieldValue(
                                             "paymentMethod",
                                             "",
                                          );
                                          form.setFieldValue(
                                             "isInstallment",
                                             false,
                                          );
                                          form.setFieldValue(
                                             "installmentCount",
                                             null,
                                          );
                                          form.setFieldValue(
                                             "isRecurring",
                                             false,
                                          );
                                          form.setFieldValue(
                                             "recurringFrequency",
                                             null,
                                          );
                                          form.setFieldValue(
                                             "recurringCount",
                                             null,
                                          );
                                          form.setFieldValue(
                                             "creditCardId",
                                             "",
                                          );
                                          form.setFieldValue("contactId", null);
                                       } else {
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
                                          >
                                             {(field) => {
                                                const isInvalid =
                                                   field.state.meta.isTouched &&
                                                   !field.state.meta.isValid;
                                                return (
                                                   <Field
                                                      data-invalid={isInvalid}
                                                   >
                                                      <FieldLabel>
                                                         Data{" "}
                                                         <span className="text-destructive">
                                                            *
                                                         </span>
                                                      </FieldLabel>
                                                      <DatePicker
                                                         className="w-full"
                                                         date={
                                                            field.state.value
                                                         }
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
                                                   <Field
                                                      data-invalid={isInvalid}
                                                   >
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
                                                               String(
                                                                  value ?? 0,
                                                               ),
                                                            )
                                                         }
                                                         value={
                                                            field.state.value
                                                         }
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
                                                   <Field
                                                      data-invalid={isInvalid}
                                                   >
                                                      <div className="flex items-center justify-between">
                                                         <FieldLabel>
                                                            Conta de Origem{" "}
                                                            <span className="text-destructive">
                                                               *
                                                            </span>
                                                         </FieldLabel>
                                                         <DialogStackNext
                                                            asChild
                                                         >
                                                            <button
                                                               className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                               onClick={() =>
                                                                  setSecondaryForm(
                                                                     {
                                                                        type: "bankAccount",
                                                                     },
                                                                  )
                                                               }
                                                               type="button"
                                                            >
                                                               <Plus className="size-3" />{" "}
                                                               Nova
                                                            </button>
                                                         </DialogStackNext>
                                                      </div>
                                                      <Combobox
                                                         className="w-full"
                                                         emptyMessage="Nenhuma conta cadastrada."
                                                         onValueChange={(v) => {
                                                            field.handleChange(
                                                               v,
                                                            );
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
                                                         value={
                                                            field.state.value
                                                         }
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
                                                   <Field
                                                      data-invalid={isInvalid}
                                                   >
                                                      <div className="flex items-center justify-between">
                                                         <FieldLabel>
                                                            Conta de Destino{" "}
                                                            <span className="text-destructive">
                                                               *
                                                            </span>
                                                         </FieldLabel>
                                                         <DialogStackNext
                                                            asChild
                                                         >
                                                            <button
                                                               className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                               onClick={() =>
                                                                  setSecondaryForm(
                                                                     {
                                                                        type: "bankAccount",
                                                                     },
                                                                  )
                                                               }
                                                               type="button"
                                                            >
                                                               <Plus className="size-3" />{" "}
                                                               Nova
                                                            </button>
                                                         </DialogStackNext>
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
                                                         value={
                                                            field.state.value
                                                         }
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
                                                   <Field
                                                      data-invalid={isInvalid}
                                                   >
                                                      <FieldLabel>
                                                         Data{" "}
                                                         <span className="text-destructive">
                                                            *
                                                         </span>
                                                      </FieldLabel>
                                                      <DatePicker
                                                         className="w-full"
                                                         date={
                                                            field.state.value
                                                         }
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
                                                   <Field
                                                      data-invalid={isInvalid}
                                                   >
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
                                                               String(
                                                                  value ?? 0,
                                                               ),
                                                            )
                                                         }
                                                         value={
                                                            field.state.value
                                                         }
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
                                                   <Field
                                                      data-invalid={isInvalid}
                                                   >
                                                      <div className="flex items-center justify-between">
                                                         <FieldLabel>
                                                            Conta{" "}
                                                            <span className="text-destructive">
                                                               *
                                                            </span>
                                                         </FieldLabel>
                                                         <DialogStackNext
                                                            asChild
                                                         >
                                                            <button
                                                               className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                               onClick={() =>
                                                                  setSecondaryForm(
                                                                     {
                                                                        type: "bankAccount",
                                                                     },
                                                                  )
                                                               }
                                                               type="button"
                                                            >
                                                               <Plus className="size-3" />{" "}
                                                               Nova
                                                            </button>
                                                         </DialogStackNext>
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
                                                         value={
                                                            field.state.value
                                                         }
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
                                             <div className="flex items-center justify-between">
                                                <FieldLabel>
                                                   Cartão de Crédito
                                                </FieldLabel>
                                                <DialogStackNext asChild>
                                                   <button
                                                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                      onClick={() =>
                                                         setSecondaryForm({
                                                            type: "creditCard",
                                                         })
                                                      }
                                                      type="button"
                                                   >
                                                      <Plus className="size-3" />{" "}
                                                      Novo
                                                   </button>
                                                </DialogStackNext>
                                             </div>
                                             <Combobox
                                                className="w-full"
                                                emptyMessage="Nenhum cartão cadastrado."
                                                onValueChange={(v) =>
                                                   field.handleChange(v || "")
                                                }
                                                options={creditCards.map(
                                                   (c) => ({
                                                      value: c.id,
                                                      label: c.name,
                                                   }),
                                                )}
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
                                                   <div className="flex items-center justify-between">
                                                      <FieldLabel>
                                                         Categoria
                                                      </FieldLabel>
                                                      <DialogStackNext asChild>
                                                         <button
                                                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                            onClick={() =>
                                                               setSecondaryForm(
                                                                  {
                                                                     type: "category",
                                                                     transactionType:
                                                                        type ===
                                                                           "income" ||
                                                                        type ===
                                                                           "expense"
                                                                           ? type
                                                                           : "expense",
                                                                  },
                                                               )
                                                            }
                                                            type="button"
                                                         >
                                                            <Plus className="size-3" />{" "}
                                                            Nova
                                                         </button>
                                                      </DialogStackNext>
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
                                                                  cat.type ===
                                                                     type),
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
                                                         field.state.meta
                                                            .errors as (
                                                            | {
                                                                 message?: string;
                                                              }
                                                            | undefined
                                                         )[]
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
                                       <div className="flex items-center justify-between">
                                          <FieldLabel>
                                             {isBusiness
                                                ? "Centros de Custo"
                                                : "Tags"}
                                          </FieldLabel>
                                          <DialogStackNext asChild>
                                             <button
                                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                onClick={() =>
                                                   setSecondaryForm({
                                                      type: "tag",
                                                   })
                                                }
                                                type="button"
                                             >
                                                <Plus className="size-3" /> Nova
                                             </button>
                                          </DialogStackNext>
                                       </div>
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
                                          <div className="flex items-center justify-between">
                                             <FieldLabel>Contato</FieldLabel>
                                             <DialogStackNext asChild>
                                                <button
                                                   className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                                   onClick={() =>
                                                      setSecondaryForm({
                                                         type: "contact",
                                                      })
                                                   }
                                                   type="button"
                                                >
                                                   <Plus className="size-3" />{" "}
                                                   Novo
                                                </button>
                                             </DialogStackNext>
                                          </div>
                                          <Suspense
                                             fallback={
                                                <Skeleton className="h-9 w-full" />
                                             }
                                          >
                                             <ContactCombobox
                                                onChange={field.handleChange}
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
                           amount: s.values.amount,
                        })}
                     >
                        {({ type, amount }) =>
                           type !== "transfer" ? (
                              <form.Field name="rateioLines">
                                 {(field) => (
                                    <Suspense fallback={null}>
                                       <RateioSection
                                          onChange={field.handleChange}
                                          transactionAmount={
                                             amount
                                                ? Number(amount) * 100
                                                : undefined
                                          }
                                          value={field.state.value}
                                       />
                                    </Suspense>
                                 )}
                              </form.Field>
                           ) : null
                        }
                     </form.Subscribe>

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
                                                         ? Number(
                                                              e.target.value,
                                                           )
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
                                                <FieldLabel>
                                                   Frequência
                                                </FieldLabel>
                                                <Select
                                                   onValueChange={
                                                      field.handleChange
                                                   }
                                                   value={
                                                      field.state.value ?? ""
                                                   }
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
                                                <FieldLabel>
                                                   Repetições
                                                </FieldLabel>
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
                                                   value={
                                                      field.state.value ?? ""
                                                   }
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
                                                      checked={
                                                         field.state.value
                                                      }
                                                      id="createAsBill"
                                                      onCheckedChange={(v) =>
                                                         field.handleChange(!!v)
                                                      }
                                                   />
                                                   <label
                                                      className="text-sm cursor-pointer select-none"
                                                      htmlFor="createAsBill"
                                                   >
                                                      Registrar como conta a
                                                      pagar (não pago ainda)
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
               </div>

               <div className="border-t px-4 py-4">
                  <form.Subscribe selector={(state) => state}>
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
               </div>
            </form>
         </DialogStackContent>

         <DialogStackContent index={1}>
            <div className="flex flex-col h-full">
               {secondaryForm?.type === "bankAccount" && (
                  <NovaConta
                     onBack={() => setSecondaryForm(null)}
                     onSuccess={(id) => {
                        form.setFieldValue("bankAccountId", id);
                        setSecondaryForm(null);
                        setActiveIndex(0);
                     }}
                  />
               )}
               {secondaryForm?.type === "creditCard" && (
                  <Suspense fallback={<Skeleton className="h-40 w-full" />}>
                     <NovoCartao
                        onBack={() => setSecondaryForm(null)}
                        onSuccess={(id) => {
                           form.setFieldValue("creditCardId", id);
                           setSecondaryForm(null);
                           setActiveIndex(0);
                        }}
                     />
                  </Suspense>
               )}
               {secondaryForm?.type === "contact" && (
                  <NovoContato
                     onBack={() => setSecondaryForm(null)}
                     onSuccess={(id) => {
                        form.setFieldValue("contactId", id);
                        setSecondaryForm(null);
                        setActiveIndex(0);
                     }}
                  />
               )}
               {secondaryForm?.type === "category" && (
                  <NovaCategoria
                     onBack={() => setSecondaryForm(null)}
                     onSuccess={(id) => {
                        form.setFieldValue("categoryId", id);
                        setSecondaryForm(null);
                        setActiveIndex(0);
                     }}
                     transactionType={secondaryForm.transactionType}
                  />
               )}
               {secondaryForm?.type === "tag" && (
                  <NovaTag
                     onBack={() => setSecondaryForm(null)}
                     onSuccess={(id) => {
                        form.setFieldValue("tagIds", [
                           ...form.getFieldValue("tagIds"),
                           id,
                        ]);
                        form.setFieldMeta("tagIds", (prev) => ({
                           ...prev,
                           isTouched: true,
                        }));
                        setSecondaryForm(null);
                        setActiveIndex(0);
                     }}
                  />
               )}
            </div>
         </DialogStackContent>
      </>
   );
}

export function TransactionDialogStack({
   mode,
   transaction,
   onSuccess,
}: TransactionCredenzaProps) {
   return (
      <Suspense
         fallback={
            <div className="p-6 flex items-center justify-center">
               <Spinner className="size-6" />
            </div>
         }
      >
         <TransactionDialogStackContent
            mode={mode}
            onSuccess={onSuccess}
            transaction={transaction}
         />
      </Suspense>
   );
}
