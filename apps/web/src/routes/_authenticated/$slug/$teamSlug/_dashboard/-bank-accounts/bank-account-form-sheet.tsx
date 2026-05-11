import { of, toMajorUnitsString } from "@f-o-t/money";
import type { MaskitoOptions } from "@maskito/core";
import { useMaskito } from "@maskito/react";
import { Autocomplete } from "@packages/ui/components/autocomplete";
import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetClose,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { toast } from "@packages/ui/components/sonner";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
   CreditCard,
   Landmark,
   PiggyBank,
   TrendingUp,
   Wallet,
} from "lucide-react";
import { fromPromise } from "neverthrow";
import type { ReactNode } from "react";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import { QueryBoundary } from "@/components/query-boundary";
import { bankInitials, bankLogoUrl } from "@/lib/logos";

const BANK_ACCOUNT_TYPES = [
   "checking",
   "savings",
   "investment",
   "payment",
   "cash",
] as const;
type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

const BANK_TYPES = ["checking", "savings", "investment", "payment"] as const;
type BankType = (typeof BANK_TYPES)[number];
const isBankType = (t: BankAccountType): t is BankType =>
   BANK_TYPES.some((type) => type === t);

function parseBankAccountType(value: string): BankAccountType | undefined {
   return BANK_ACCOUNT_TYPES.find((type) => type === value);
}

const TYPE_OPTIONS: {
   value: BankAccountType;
   label: string;
   icon: ReactNode;
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
      value: "payment",
      label: "Conta Pagamento",
      icon: <CreditCard className="size-4" />,
   },
   {
      value: "cash",
      label: "Caixa Físico",
      icon: <Wallet className="size-4" />,
   },
];

const BANK_CODE_MASK: MaskitoOptions = { mask: /^\d{0,3}$/ };
const BRANCH_MASK: MaskitoOptions = { mask: /^\d{0,4}(-\d{0,1})?$/ };
const ACCOUNT_NUMBER_MASK: MaskitoOptions = {
   mask: /^\d{0,12}(-\d{0,1})?$/,
};

const formSchema = z
   .object({
      name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres."),
      type: z.enum(BANK_ACCOUNT_TYPES),
      bankCode: z.string(),
      bankName: z.string(),
      branch: z.string(),
      accountNumber: z.string(),
      initialBalance: z.number().min(0, "Saldo inicial não pode ser negativo."),
   })
   .superRefine((v, ctx) => {
      if (!isBankType(v.type)) return;
      if (!v.bankName.trim()) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bankName"],
            message: "Selecione um banco.",
         });
      }
      if (!/^\d{1,3}$/.test(v.bankCode)) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["bankCode"],
            message: "Código do banco é obrigatório (até 3 dígitos).",
         });
      }
   });

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   name: "",
   type: "checking",
   bankCode: "",
   bankName: "",
   branch: "",
   accountNumber: "",
   initialBalance: 0,
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

export function BankAccountFormSheet() {
   return (
      <QueryBoundary
         fallback={
            <div className="flex flex-col gap-4 p-4">
               <SheetHeader>
                  <SheetTitle>Nova conta bancária</SheetTitle>
                  <SheetDescription>Carregando bancos...</SheetDescription>
               </SheetHeader>
            </div>
         }
         errorTitle="Erro ao carregar bancos"
      >
         <BankAccountFormSheetContent />
      </QueryBoundary>
   );
}

function BankAccountFormSheetContent() {
   const { closeTopSheet } = useSheet();
   const router = useRouter();
   const logoDevToken = router.options.context.publicEnv?.LOGO_DEV_TOKEN;
   const bankCodeMaskRef = useMaskito({ options: BANK_CODE_MASK });
   const branchMaskRef = useMaskito({ options: BRANCH_MASK });
   const accountNumberMaskRef = useMaskito({ options: ACCOUNT_NUMBER_MASK });

   const { data: banks } = useSuspenseQuery(
      orpc.bankAccounts.searchBanks.queryOptions({ input: { query: "" } }),
   );

   const bankOptions = banks.map((b) => ({
      value: b.code,
      label: b.name,
   }));

   const renderBankOption = (option: { value: string; label: string }) => {
      const logo = bankLogoUrl(option.value, logoDevToken);
      return (
         <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-4 shrink-0 rounded-lg bg-white ring-1 ring-border">
               {logo ? (
                  <AvatarImage
                     alt={option.label}
                     className="object-contain p-2"
                     src={logo}
                  />
               ) : null}
               <AvatarFallback className="rounded-lg text-xs font-semibold">
                  {bankInitials(option.label)}
               </AvatarFallback>
            </Avatar>
            <span className="truncate">{option.label}</span>
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
               {option.value}
            </span>
         </div>
      );
   };

   const createMutation = useMutation(
      orpc.bankAccounts.create.mutationOptions({
         onSuccess: () => {
            toast.success("Conta criada com sucesso.");
            closeTopSheet();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const isBank = isBankType(value.type);
         const result = await fromPromise(
            createMutation.mutateAsync({
               name: value.name.trim(),
               type: value.type,
               color: "#6366f1",
               initialBalance: toMajorUnitsString(
                  of(String(value.initialBalance), "BRL"),
               ),
               bankCode: isBank ? value.bankCode : null,
               bankName: isBank ? value.bankName.trim() : null,
               branch: isBank ? value.branch.trim() || null : null,
               accountNumber: isBank
                  ? value.accountNumber.trim() || null
                  : null,
            }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   const fillBankCode = (code: string) => {
      const el = document.getElementById("bankCode");
      if (!(el instanceof HTMLInputElement)) return;
      const setter = Object.getOwnPropertyDescriptor(
         HTMLInputElement.prototype,
         "value",
      )?.set;
      setter?.call(el, code);
      el.dispatchEvent(new Event("input", { bubbles: true }));
   };

   return (
      <>
         <SheetHeader>
            <SheetTitle>Nova conta bancária</SheetTitle>
            <SheetDescription>
               Cadastre uma conta para registrar lançamentos.
            </SheetDescription>
         </SheetHeader>

         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(e) => {
               e.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field name="name">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder='Ex.: "Itaú principal"'
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {field.state.meta.errors[0]?.message}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <form.Field name="type">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) => {
                           const parsed = parseBankAccountType(v);
                           if (!parsed) return;
                           field.handleChange(parsed);
                        }}
                     >
                        <SelectTrigger id={field.name} name={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {TYPE_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={o.value}>
                                 <span className="flex items-center gap-2">
                                    {o.icon}
                                    {o.label}
                                 </span>
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>

            <form.Subscribe selector={(s) => s.values.type}>
               {(type) =>
                  isBankType(type) ? (
                     <div className="flex flex-col gap-4 rounded-md border p-4">
                        <span className="text-sm font-medium">
                           Detalhes bancários
                        </span>

                        <form.Field name="bankName">
                           {(field) => {
                              const selectedOption = bankOptions.find(
                                 (o) => o.label === field.state.value,
                              );
                              return (
                                 <Field
                                    data-invalid={
                                       isFieldInvalid(field) || undefined
                                    }
                                 >
                                    <FieldLabel htmlFor="bankName">
                                       Banco
                                    </FieldLabel>
                                    <div className="w-full">
                                       <Autocomplete
                                          emptyMessage="Nenhum banco encontrado."
                                          isLoading={false}
                                          options={bankOptions}
                                          placeholder="Digite o nome ou código"
                                          renderOption={renderBankOption}
                                          value={selectedOption}
                                          onBlur={field.handleBlur}
                                          onValueChange={(opt) => {
                                             field.handleChange(opt.label);
                                             form.setFieldValue(
                                                "bankCode",
                                                opt.value,
                                             );
                                             fillBankCode(opt.value);
                                          }}
                                       />
                                    </div>
                                    {isFieldInvalid(field) ? (
                                       <FieldError>
                                          {field.state.meta.errors[0]?.message}
                                       </FieldError>
                                    ) : null}
                                 </Field>
                              );
                           }}
                        </form.Field>

                        <form.Field name="bankCode">
                           {(field) => (
                              <Field
                                 data-invalid={
                                    isFieldInvalid(field) || undefined
                                 }
                              >
                                 <FieldLabel htmlFor={field.name}>
                                    Código do banco
                                 </FieldLabel>
                                 <Input
                                    aria-invalid={isFieldInvalid(field)}
                                    defaultValue={field.state.value}
                                    id={field.name}
                                    maxLength={3}
                                    name={field.name}
                                    placeholder="Ex.: 341"
                                    ref={bankCodeMaskRef}
                                    onBlur={field.handleBlur}
                                    onInput={(e) =>
                                       field.handleChange(
                                          (e.target as HTMLInputElement).value,
                                       )
                                    }
                                 />
                                 {isFieldInvalid(field) ? (
                                    <FieldError>
                                       {field.state.meta.errors[0]?.message}
                                    </FieldError>
                                 ) : null}
                              </Field>
                           )}
                        </form.Field>

                        <div className="grid grid-cols-2 gap-4">
                           <form.Field name="branch">
                              {(field) => (
                                 <Field>
                                    <FieldLabel htmlFor={field.name}>
                                       Agência
                                    </FieldLabel>
                                    <Input
                                       defaultValue={field.state.value}
                                       id={field.name}
                                       name={field.name}
                                       placeholder="0000"
                                       ref={branchMaskRef}
                                       onBlur={field.handleBlur}
                                       onInput={(e) =>
                                          field.handleChange(
                                             (e.target as HTMLInputElement)
                                                .value,
                                          )
                                       }
                                    />
                                 </Field>
                              )}
                           </form.Field>

                           <form.Field name="accountNumber">
                              {(field) => (
                                 <Field>
                                    <FieldLabel htmlFor={field.name}>
                                       Conta
                                    </FieldLabel>
                                    <Input
                                       defaultValue={field.state.value}
                                       id={field.name}
                                       name={field.name}
                                       placeholder="00000-0"
                                       ref={accountNumberMaskRef}
                                       onBlur={field.handleBlur}
                                       onInput={(e) =>
                                          field.handleChange(
                                             (e.target as HTMLInputElement)
                                                .value,
                                          )
                                       }
                                    />
                                 </Field>
                              )}
                           </form.Field>
                        </div>
                     </div>
                  ) : null
               }
            </form.Subscribe>

            <form.Field name="initialBalance">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Saldo inicial</FieldLabel>
                     <MoneyInput
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        valueInCents={false}
                        onChange={(v) => field.handleChange(v ?? 0)}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {field.state.meta.errors[0]?.message}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>
         </form>

         <SheetFooter>
            <SheetClose asChild>
               <Button variant="outline">Cancelar</Button>
            </SheetClose>
            <form.Subscribe
               selector={(s) => ({
                  canSubmit: s.canSubmit,
                  isSubmitting: s.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={!canSubmit || isSubmitting}
                     onClick={() => form.handleSubmit()}
                  >
                     Criar conta
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
