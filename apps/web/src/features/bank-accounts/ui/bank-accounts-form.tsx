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
import {
   Command,
   CommandEmpty,
   CommandGroup,
   CommandItem,
   CommandList,
} from "@packages/ui/components/command";
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
import { Textarea } from "@packages/ui/components/textarea";
import { cn } from "@packages/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import Color from "color";
import {
   CheckIcon,
   ChevronsUpDownIcon,
   CreditCard,
   Landmark,
   PiggyBank,
   TrendingUp,
   Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useBrazilianBanks } from "../hooks/use-brazilian-banks";

type BankAccountType =
   | "checking"
   | "savings"
   | "investment"
   | "payment"
   | "cash";

const TYPE_OPTIONS: {
   value: BankAccountType;
   label: string;
   icon: React.ReactNode;
}[] = [
   {
      value: "cash",
      label: "Caixa Físico",
      icon: <Wallet className="size-4" />,
   },
   {
      value: "checking",
      label: "Conta Corrente",
      icon: <Landmark className="size-4" />,
   },
   {
      value: "savings",
      label: "Conta Poupança",
      icon: <PiggyBank className="size-4" />,
   },
   {
      value: "payment",
      label: "Conta Pagamento",
      icon: <CreditCard className="size-4" />,
   },
   {
      value: "investment",
      label: "Conta Investimento",
      icon: <TrendingUp className="size-4" />,
   },
];

interface BankAccountFormProps {
   mode: "create" | "edit";
   account?: {
      id: string;
      name: string;
      type: BankAccountType;
      color: string;
      iconUrl?: string | null;
      initialBalance: string;
      bankCode?: string | null;
      bankName?: string | null;
      nickname?: string | null;
      branch?: string | null;
      accountNumber?: string | null;
      initialBalanceDate?: Date | string | null;
      notes?: string | null;
   };
   onSuccess: () => void;
}

function formatDateForInput(date: Date | string | null | undefined): string {
   if (!date) return new Date().toISOString().split("T")[0];
   const d = typeof date === "string" ? new Date(date) : date;
   return d.toISOString().split("T")[0];
}

export function BankAccountForm({
   mode,
   account,
   onSuccess,
}: BankAccountFormProps) {
   const isCreate = mode === "create";
   const [typeOpen, setTypeOpen] = useState(false);
   const { bankOptions, isLoading: banksLoading } = useBrazilianBanks();

   const createMutation = useMutation(
      orpc.bankAccounts.create.mutationOptions({
         onSuccess: () => {
            toast.success("Conta bancária criada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar conta bancária.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.bankAccounts.update.mutationOptions({
         onSuccess: () => {
            toast.success("Conta bancária atualizada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar conta bancária.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         color: account?.color ?? "#6366f1",
         initialBalance: account?.initialBalance ?? "0",
         initialBalanceDate: formatDateForInput(account?.initialBalanceDate),
         name: account?.name ?? "",
         type: (account?.type ?? "checking") as BankAccountType,
         bankCode: account?.bankCode ?? "",
         nickname: account?.nickname ?? "",
         branch: account?.branch ?? "",
         accountNumber: account?.accountNumber ?? "",
         notes: account?.notes ?? "",
      },
      onSubmit: async ({ value }) => {
         const selectedBank = bankOptions.find(
            (b) => b.value === value.bankCode,
         );
         const resolvedName =
            value.type === "cash"
               ? "Caixa Físico"
               : (value.nickname || selectedBank?.label || value.name).trim();

         const payload = {
            color: value.color,
            initialBalance: value.initialBalance,
            initialBalanceDate: value.initialBalanceDate
               ? new Date(value.initialBalanceDate)
               : null,
            name: resolvedName,
            type: value.type,
            bankCode: value.bankCode || null,
            bankName: selectedBank?.label || null,
            nickname: value.nickname || null,
            branch: value.branch || null,
            accountNumber: value.accountNumber || null,
            notes: value.notes || null,
         };

         if (isCreate) {
            createMutation.mutate(payload);
         } else if (account) {
            updateMutation.mutate({ id: account.id, ...payload });
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
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Novo Banco" : "Editar Banco"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "O cadastro de banco possui duas partes: Seleção do tipo da conta e as informações sobre o banco."
                  : "Atualize as informações do banco."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="flex flex-col gap-4">
            <FieldGroup>
               {/* Tipo de Conta */}
               <form.Field name="type">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     const selected = TYPE_OPTIONS.find(
                        (o) => o.value === field.state.value,
                     );
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Tipo de Conta</FieldLabel>
                           <Popover onOpenChange={setTypeOpen} open={typeOpen}>
                              <PopoverTrigger asChild>
                                 <Button
                                    aria-expanded={typeOpen}
                                    className="w-full justify-between"
                                    onBlur={field.handleBlur}
                                    role="combobox"
                                    type="button"
                                    variant="outline"
                                 >
                                    <span className="flex items-center gap-2">
                                       {selected?.icon}
                                       {selected?.label ?? "Selecione o tipo"}
                                    </span>
                                    <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                 align="start"
                                 className="p-0 w-[var(--radix-popover-trigger-width)]"
                              >
                                 <Command>
                                    <CommandList>
                                       <CommandEmpty>
                                          Nenhum tipo encontrado.
                                       </CommandEmpty>
                                       <CommandGroup>
                                          {TYPE_OPTIONS.map((opt) => (
                                             <CommandItem
                                                key={opt.value}
                                                onSelect={() => {
                                                   field.handleChange(
                                                      opt.value,
                                                   );
                                                   setTypeOpen(false);
                                                }}
                                                value={opt.value}
                                             >
                                                <span className="flex items-center gap-2 flex-1">
                                                   {opt.icon}
                                                   {opt.label}
                                                </span>
                                                <CheckIcon
                                                   className={cn(
                                                      "size-4 shrink-0",
                                                      field.state.value ===
                                                         opt.value
                                                         ? "opacity-100"
                                                         : "opacity-0",
                                                   )}
                                                />
                                             </CommandItem>
                                          ))}
                                       </CommandGroup>
                                    </CommandList>
                                 </Command>
                              </PopoverContent>
                           </Popover>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Banco + Apelido (side by side) */}
               <form.Subscribe selector={(s) => s.values.type}>
                  {(type) =>
                     type !== "cash" ? (
                        <div className="grid grid-cols-2 gap-4">
                           <form.Field name="bankCode">
                              {(field) => {
                                 const isInvalid =
                                    field.state.meta.isTouched &&
                                    !field.state.meta.isValid;
                                 return (
                                    <Field data-invalid={isInvalid}>
                                       <FieldLabel>Banco *</FieldLabel>
                                       <Combobox
                                          className="w-full"
                                          disabled={banksLoading}
                                          emptyMessage="Nenhum banco encontrado."
                                          onBlur={field.handleBlur}
                                          onValueChange={(v) =>
                                             field.handleChange(v)
                                          }
                                          options={bankOptions}
                                          placeholder={
                                             banksLoading
                                                ? "Carregando..."
                                                : "Selecionar banco..."
                                          }
                                          searchPlaceholder="Pesquisar"
                                          value={field.state.value}
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

                           <form.Field name="nickname">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>Apelido</FieldLabel>
                                    <Input
                                       onBlur={field.handleBlur}
                                       onChange={(e) =>
                                          field.handleChange(e.target.value)
                                       }
                                       placeholder="Ex: Conta principal"
                                       value={field.state.value}
                                    />
                                 </Field>
                              )}
                           </form.Field>
                        </div>
                     ) : null
                  }
               </form.Subscribe>

               {/* Agência + Conta (side by side) */}
               <form.Subscribe selector={(s) => s.values.type}>
                  {(type) =>
                     type !== "cash" ? (
                        <div className="grid grid-cols-2 gap-4">
                           <form.Field name="branch">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>Agência</FieldLabel>
                                    <Input
                                       onBlur={field.handleBlur}
                                       onChange={(e) =>
                                          field.handleChange(e.target.value)
                                       }
                                       placeholder="0001"
                                       value={field.state.value}
                                    />
                                 </Field>
                              )}
                           </form.Field>

                           <form.Field name="accountNumber">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>Conta</FieldLabel>
                                    <Input
                                       onBlur={field.handleBlur}
                                       onChange={(e) =>
                                          field.handleChange(e.target.value)
                                       }
                                       placeholder="12345-6"
                                       value={field.state.value}
                                    />
                                 </Field>
                              )}
                           </form.Field>
                        </div>
                     ) : null
                  }
               </form.Subscribe>

               {/* Saldo Inicial + Data do Saldo (side by side) */}
               {isCreate && (
                  <div className="grid grid-cols-2 gap-4">
                     <form.Field name="initialBalance">
                        {(field) => {
                           const isInvalid =
                              field.state.meta.isTouched &&
                              !field.state.meta.isValid;
                           return (
                              <Field data-invalid={isInvalid}>
                                 <FieldLabel>Saldo Inicial *</FieldLabel>
                                 <MoneyInput
                                    onChange={(v) =>
                                       field.handleChange(String(v ?? 0))
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

                     <form.Field name="initialBalanceDate">
                        {(field) => (
                           <Field>
                              <FieldLabel>Data do Saldo Inicial *</FieldLabel>
                              <Input
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 type="date"
                                 value={field.state.value}
                              />
                           </Field>
                        )}
                     </form.Field>
                  </div>
               )}

               {/* Cor */}
               <form.Field name="color">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Cor</FieldLabel>
                           <Popover>
                              <PopoverTrigger asChild>
                                 <Button
                                    aria-invalid={isInvalid || undefined}
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
                                       <div className="grid w-full gap-1">
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
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               {/* Outras informações */}
               <form.Field name="notes">
                  {(field) => (
                     <Field>
                        <FieldLabel>Outras informações</FieldLabel>
                        <Textarea
                           onBlur={field.handleBlur}
                           onChange={(e) =>
                              field.handleChange(e.target.value)
                           }
                           placeholder="Informações adicionais sobre a conta..."
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
                     {isCreate ? "Criar conta" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
