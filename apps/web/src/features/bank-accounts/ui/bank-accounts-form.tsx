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
import { cn } from "@packages/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import Color from "color";
import {
   CheckIcon,
   ChevronsUpDownIcon,
   Landmark,
   PiggyBank,
   TrendingUp,
   Wallet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

type BankAccountType = "checking" | "savings" | "investment" | "cash";

const TYPE_OPTIONS: {
   value: BankAccountType;
   label: string;
   icon: React.ReactNode;
}[] = [
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
      value: "investment",
      label: "Conta Investimento",
      icon: <TrendingUp className="size-4" />,
   },
   {
      value: "cash",
      label: "Carteira",
      icon: <Wallet className="size-4" />,
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
   };
   onSuccess: () => void;
}

export function BankAccountForm({
   mode,
   account,
   onSuccess,
}: BankAccountFormProps) {
   const isCreate = mode === "create";
   const [typeOpen, setTypeOpen] = useState(false);

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
         name: account?.name ?? "",
         type: (account?.type ?? "checking") as BankAccountType,
      },
      onSubmit: async ({ value }) => {
         const resolvedName =
            value.type === "cash" ? "Dinheiro" : value.name.trim();
         if (isCreate) {
            createMutation.mutate({
               color: value.color,
               initialBalance: value.initialBalance,
               name: resolvedName,
               type: value.type,
            });
         } else if (account) {
            updateMutation.mutate({
               color: value.color,
               id: account.id,
               name: resolvedName,
               type: value.type,
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
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Nova Conta Bancária" : "Editar Conta Bancária"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Adicione uma nova conta para organizar suas finanças."
                  : "Atualize as informações da conta bancária."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            <FieldGroup>
               <form.Field name="type">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     const selected = TYPE_OPTIONS.find(
                        (o) => o.value === field.state.value,
                     );
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Tipo</FieldLabel>
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

               <form.Subscribe selector={(s) => s.values.type}>
                  {(type) =>
                     type !== "cash" ? (
                        <form.Field name="name">
                           {(field) => {
                              const isInvalid =
                                 field.state.meta.isTouched &&
                                 !field.state.meta.isValid;
                              return (
                                 <Field data-invalid={isInvalid}>
                                    <FieldLabel>Nome</FieldLabel>
                                    <Input
                                       onBlur={field.handleBlur}
                                       onChange={(e) =>
                                          field.handleChange(e.target.value)
                                       }
                                       placeholder="Ex: Nubank, Itaú Corrente"
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
                     ) : null
                  }
               </form.Subscribe>

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

               {isCreate && (
                  <form.Field name="initialBalance">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel>Saldo Inicial</FieldLabel>
                              <MoneyInput
                                 onChange={(v) =>
                                    field.handleChange(String(v ?? 0))
                                 }
                                 value={field.state.value}
                                 valueInCents={false}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               )}
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
