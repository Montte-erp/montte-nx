import { Button } from "@packages/ui/components/button";
import { Calendar } from "@packages/ui/components/calendar";
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
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import { cn } from "@packages/ui/lib/utils";
import { useMaskito } from "@maskito/react";
import type { MaskitoOptions } from "@maskito/core";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import Color from "color";
import dayjs from "dayjs";
import {
   CalendarIcon,
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
import { useActiveTeam } from "@/hooks/use-active-team";
import { useCnpj } from "@/hooks/use-cnpj";
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

// Agência: up to 5 digits (FEBRABAN standard), optional "-" + 1 check digit
const branchMaskOptions: MaskitoOptions = {
   mask: [/\d/, /\d/, /\d/, /\d/, /\d/],
};

// Conta: up to 12 digits + "-" + 1 check digit (digit or X) per FEBRABAN CNAB240
const accountMaskOptions: MaskitoOptions = {
   mask: [
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      "-",
      /[\dXx]/,
   ],
};

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

function toDate(value: string | null | undefined): Date | undefined {
   if (!value) return undefined;
   const d = dayjs(value);
   return d.isValid() ? d.toDate() : undefined;
}

export function BankAccountForm({
   mode,
   account,
   onSuccess,
}: BankAccountFormProps) {
   const isCreate = mode === "create";
   const [typeOpen, setTypeOpen] = useState(false);
   const [dateOpen, setDateOpen] = useState(false);
   const { bankOptions } = useBrazilianBanks();

   const { activeTeamId } = useActiveTeam();
   const { minDate } = useCnpj(activeTeamId ?? "");

   const branchRef = useMaskito({ options: branchMaskOptions });
   const accountRef = useMaskito({ options: accountMaskOptions });

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
         initialBalanceDate: account?.initialBalanceDate
            ? dayjs(account.initialBalanceDate).format("YYYY-MM-DD")
            : dayjs().format("YYYY-MM-DD"),
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
            initialBalanceDate: value.initialBalanceDate || undefined,
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
               {isCreate ? "Nova Conta Bancária" : "Editar Conta Bancária"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Preencha os dados da nova conta bancária."
                  : "Atualize as informações da conta bancária."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <FieldGroup>
               <div className="grid grid-cols-2 gap-4">
                  <form.Field
                     name="type"
                     children={(field) => {
                        const selected = TYPE_OPTIONS.find(
                           (o) => o.value === field.state.value,
                        );
                        return (
                           <Field>
                              <FieldLabel>Tipo de conta</FieldLabel>
                              <Popover
                                 onOpenChange={setTypeOpen}
                                 open={typeOpen}
                              >
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
                                          {selected?.label ??
                                             "Selecione o tipo"}
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
                                    className="w-full justify-start gap-2"
                                    type="button"
                                    variant="outline"
                                 >
                                    <div
                                       className="size-4 rounded border border-border shrink-0"
                                       style={{
                                          backgroundColor: field.state.value,
                                       }}
                                    />
                                    <span className="font-mono text-xs">
                                       {field.state.value}
                                    </span>
                                 </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                 align="end"
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
               </div>

               <form.Subscribe selector={(s) => s.values.type}>
                  {(type) =>
                     type !== "cash" ? (
                        <>
                           <div className="grid grid-cols-2 gap-4">
                              <form.Field
                                 name="bankCode"
                                 children={(field) => {
                                    const isInvalid =
                                       field.state.meta.isTouched &&
                                       field.state.meta.errors.length > 0;
                                    return (
                                       <Field data-invalid={isInvalid}>
                                          <FieldLabel>Banco</FieldLabel>
                                          <Combobox
                                             className="w-full"
                                             emptyMessage="Nenhum banco encontrado."
                                             onBlur={field.handleBlur}
                                             onValueChange={(v) =>
                                                field.handleChange(v)
                                             }
                                             options={bankOptions}
                                             placeholder="Selecionar..."
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
                              />

                              <form.Field
                                 name="nickname"
                                 children={(field) => {
                                    const isInvalid =
                                       field.state.meta.isTouched &&
                                       field.state.meta.errors.length > 0;
                                    return (
                                       <Field data-invalid={isInvalid}>
                                          <FieldLabel htmlFor={field.name}>
                                             Apelido
                                          </FieldLabel>
                                          <Input
                                             id={field.name}
                                             name={field.name}
                                             aria-invalid={isInvalid}
                                             onBlur={field.handleBlur}
                                             onChange={(e) =>
                                                field.handleChange(
                                                   e.target.value,
                                                )
                                             }
                                             placeholder="Ex: Conta principal"
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
                              />
                           </div>

                           <div className="grid grid-cols-2 gap-4">
                              <form.Field
                                 name="branch"
                                 children={(field) => {
                                    const isInvalid =
                                       field.state.meta.isTouched &&
                                       field.state.meta.errors.length > 0;
                                    return (
                                       <Field data-invalid={isInvalid}>
                                          <FieldLabel htmlFor={field.name}>
                                             Agência
                                          </FieldLabel>
                                          <Input
                                             ref={branchRef}
                                             aria-invalid={isInvalid}
                                             defaultValue={field.state.value}
                                             id={field.name}
                                             inputMode="numeric"
                                             name={field.name}
                                             onBlur={field.handleBlur}
                                             onInput={(e) =>
                                                field.handleChange(
                                                   (
                                                      e.target as HTMLInputElement
                                                   ).value,
                                                )
                                             }
                                             placeholder="00000"
                                          />
                                          {isInvalid && (
                                             <FieldError
                                                errors={field.state.meta.errors}
                                             />
                                          )}
                                       </Field>
                                    );
                                 }}
                              />

                              <form.Field
                                 name="accountNumber"
                                 children={(field) => {
                                    const isInvalid =
                                       field.state.meta.isTouched &&
                                       field.state.meta.errors.length > 0;
                                    return (
                                       <Field data-invalid={isInvalid}>
                                          <FieldLabel htmlFor={field.name}>
                                             Conta
                                          </FieldLabel>
                                          <Input
                                             ref={accountRef}
                                             aria-invalid={isInvalid}
                                             defaultValue={field.state.value}
                                             id={field.name}
                                             inputMode="numeric"
                                             name={field.name}
                                             onBlur={field.handleBlur}
                                             onInput={(e) =>
                                                field.handleChange(
                                                   (
                                                      e.target as HTMLInputElement
                                                   ).value,
                                                )
                                             }
                                             placeholder="000000000000-0"
                                          />
                                          {isInvalid && (
                                             <FieldError
                                                errors={field.state.meta.errors}
                                             />
                                          )}
                                       </Field>
                                    );
                                 }}
                              />
                           </div>
                        </>
                     ) : null
                  }
               </form.Subscribe>

               {isCreate && (
                  <div className="grid grid-cols-2 gap-4">
                     <form.Field
                        name="initialBalance"
                        children={(field) => {
                           const isInvalid =
                              field.state.meta.isTouched &&
                              field.state.meta.errors.length > 0;
                           return (
                              <Field data-invalid={isInvalid}>
                                 <FieldLabel>Saldo inicial</FieldLabel>
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
                     />

                     <form.Field
                        name="initialBalanceDate"
                        children={(field) => {
                           const selectedDate = toDate(field.state.value);
                           return (
                              <Field>
                                 <FieldLabel>Data do saldo inicial</FieldLabel>
                                 <Popover
                                    open={dateOpen}
                                    onOpenChange={setDateOpen}
                                 >
                                    <PopoverTrigger asChild>
                                       <Button
                                          className={cn(
                                             "w-full justify-start gap-2 font-normal",
                                             !selectedDate &&
                                                "text-muted-foreground",
                                          )}
                                          type="button"
                                          variant="outline"
                                       >
                                          <CalendarIcon className="size-4 shrink-0" />
                                          {selectedDate
                                             ? dayjs(selectedDate).format(
                                                  "DD/MM/YYYY",
                                               )
                                             : "Selecionar data"}
                                       </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                       align="start"
                                       className="w-auto p-0"
                                    >
                                       <Calendar
                                          captionLayout="dropdown"
                                          components={{
                                             MonthCaption: (props) => (
                                                <>{props.children}</>
                                             ),
                                             DropdownNav: (props) => (
                                                <div className="flex w-full items-center gap-2">
                                                   {props.children}
                                                </div>
                                             ),
                                             Dropdown: (props) => (
                                                <Select
                                                   onValueChange={(value) => {
                                                      if (props.onChange) {
                                                         const ev = {
                                                            target: {
                                                               value: String(
                                                                  value,
                                                               ),
                                                            },
                                                         } as React.ChangeEvent<HTMLSelectElement>;
                                                         props.onChange(ev);
                                                      }
                                                   }}
                                                   value={String(props.value)}
                                                >
                                                   <SelectTrigger className="first:flex-1 last:shrink-0">
                                                      <SelectValue />
                                                   </SelectTrigger>
                                                   <SelectContent>
                                                      {props.options?.map(
                                                         (option) => (
                                                            <SelectItem
                                                               disabled={
                                                                  option.disabled
                                                               }
                                                               key={
                                                                  option.value
                                                               }
                                                               value={String(
                                                                  option.value,
                                                               )}
                                                            >
                                                               {option.label}
                                                            </SelectItem>
                                                         ),
                                                      )}
                                                   </SelectContent>
                                                </Select>
                                             ),
                                          }}
                                          fromDate={minDate}
                                          toDate={new Date()}
                                          hideNavigation
                                          mode="single"
                                          selected={selectedDate}
                                          onSelect={(date) => {
                                             field.handleChange(
                                                date
                                                   ? dayjs(date).format(
                                                        "YYYY-MM-DD",
                                                     )
                                                   : "",
                                             );
                                             setDateOpen(false);
                                          }}
                                       />
                                    </PopoverContent>
                                 </Popover>
                              </Field>
                           );
                        }}
                     />
                  </div>
               )}

               <form.Field
                  name="notes"
                  children={(field) => (
                     <Field>
                        <FieldLabel htmlFor={field.name}>
                           Observações{" "}
                           <span className="text-muted-foreground font-normal">
                              (opcional)
                           </span>
                        </FieldLabel>
                        <Textarea
                           id={field.name}
                           name={field.name}
                           onBlur={field.handleBlur}
                           onChange={(e) => field.handleChange(e.target.value)}
                           placeholder="Informações adicionais sobre a conta..."
                           rows={2}
                           value={field.state.value}
                        />
                     </Field>
                  )}
               />
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe selector={(state) => state}>
               {(state) => (
                  <Button
                     className="w-full gap-2"
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
                        <Spinner className="size-4" />
                     )}
                     {isCreate ? "Criar conta" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
