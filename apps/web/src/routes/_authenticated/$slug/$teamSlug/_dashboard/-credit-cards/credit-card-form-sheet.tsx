import { of, toMajorUnitsString } from "@f-o-t/money";
import {
   Avatar,
   AvatarFallback,
   AvatarImage,
} from "@packages/ui/components/avatar";
import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import { NumberInput } from "@packages/ui/components/number-input";
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
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { QueryBoundary } from "@/components/query-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";
import { BRAND_LABEL, brandLogoUrl, type CreditCardBrand } from "@/lib/logos";

const CARD_BRANDS = [
   "visa",
   "mastercard",
   "elo",
   "amex",
   "hipercard",
   "other",
] satisfies [CreditCardBrand, ...CreditCardBrand[]];

const daySchema = z
   .number({ error: "Dia é obrigatório." })
   .int("Dia deve ser inteiro.")
   .min(1, "Dia deve ser entre 1 e 31.")
   .max(31, "Dia deve ser entre 1 e 31.");

const formSchema = z.object({
   name: z
      .string()
      .trim()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(80, "Nome deve ter no máximo 80 caracteres."),
   bankAccountId: z.string().uuid("Selecione uma conta vinculada."),
   brand: z.enum(CARD_BRANDS, { error: "Selecione a bandeira." }),
   last4: z
      .string()
      .refine(
         (value) => value === "" || /^\d{4}$/.test(value),
         "Informe os 4 últimos dígitos.",
      ),
   creditLimit: z.number().min(0.01, "Limite é obrigatório."),
   closingDay: daySchema,
   dueDay: daySchema,
});

interface FormValues {
   name: string;
   bankAccountId: string;
   brand: CreditCardBrand | "";
   last4: string;
   creditLimit: number;
   closingDay: number;
   dueDay: number;
}

const DEFAULT_VALUES: FormValues = {
   name: "",
   bankAccountId: "",
   brand: "",
   last4: "",
   creditLimit: 0,
   closingDay: 1,
   dueDay: 10,
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

function isCreditCardBrand(value: string): value is CreditCardBrand {
   return CARD_BRANDS.some((brand) => brand === value);
}

interface CreditCardBrandOptionProps {
   brand: CreditCardBrand;
}

function CreditCardBrandOption({ brand }: CreditCardBrandOptionProps) {
   const logo = brandLogoUrl(brand);

   return (
      <span className="flex min-w-0 items-center gap-2">
         <Avatar className="size-4 shrink-0 rounded-lg bg-white ring-1 ring-border">
            {logo ? (
               <AvatarImage
                  alt={BRAND_LABEL[brand]}
                  className="object-contain"
                  src={logo}
               />
            ) : null}
            <AvatarFallback className="rounded-lg text-xs">
               {BRAND_LABEL[brand][0]}
            </AvatarFallback>
         </Avatar>
         <span className="truncate">{BRAND_LABEL[brand]}</span>
      </span>
   );
}

export function CreditCardFormSheet() {
   return (
      <QueryBoundary
         fallback={
            <div className="flex flex-col gap-4 p-4">
               <SheetHeader>
                  <SheetTitle>Novo cartão de crédito</SheetTitle>
                  <SheetDescription>Carregando contas...</SheetDescription>
               </SheetHeader>
            </div>
         }
         errorTitle="Erro ao carregar contas"
      >
         <CreditCardFormSheetContent />
      </QueryBoundary>
   );
}

function CreditCardFormSheetContent() {
   const { closeTopSheet } = useSheet();

   const { data: bankAccounts } = useSuspenseQuery(
      orpc.bankAccounts.getAll.queryOptions({}),
   );

   const createMutation = useMutation(
      orpc.creditCards.create.mutationOptions({
         onSuccess: () => {
            toast.success("Cartão criado com sucesso.");
            closeTopSheet();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const result = await fromPromise(
            createMutation.mutateAsync({
               name: value.name.trim(),
               bankAccountId: value.bankAccountId,
               brand: value.brand || null,
               last4: value.last4 || null,
               color: "#6366f1",
               creditLimit: toMajorUnitsString(
                  of(String(value.creditLimit), "BRL"),
               ),
               closingDay: value.closingDay,
               dueDay: value.dueDay,
            }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   const hasBankAccounts = bankAccounts.length > 0;

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo cartão de crédito</SheetTitle>
            <SheetDescription>
               Cadastre um cartão para controlar gastos e faturas.
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
                     <FieldLabel htmlFor={field.name} required>
                        Nome
                     </FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder='Ex.: "Nubank Roxinho"'
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

            <form.Field name="bankAccountId">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name} required>
                        Conta vinculada
                     </FieldLabel>
                     <Select
                        disabled={!hasBankAccounts}
                        value={field.state.value || undefined}
                        onValueChange={(v) => field.handleChange(v)}
                     >
                        <SelectTrigger
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           name={field.name}
                        >
                           <SelectValue
                              placeholder={
                                 hasBankAccounts
                                    ? "Selecione uma conta"
                                    : "Crie uma conta bancária primeiro"
                              }
                           />
                        </SelectTrigger>
                        <SelectContent>
                           {bankAccounts.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                 {b.name}
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {field.state.meta.errors[0]?.message}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <form.Field
               name="brand"
               children={(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name} required>
                        Bandeira
                     </FieldLabel>
                     <Select
                        value={field.state.value || undefined}
                        onValueChange={(value) => {
                           if (!isCreditCardBrand(value)) return;
                           field.handleChange(value);
                        }}
                     >
                        <SelectTrigger
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           name={field.name}
                        >
                           <SelectValue placeholder="Selecione a bandeira" />
                        </SelectTrigger>
                        <SelectContent>
                           {CARD_BRANDS.map((brand) => (
                              <SelectItem key={brand} value={brand}>
                                 <CreditCardBrandOption brand={brand} />
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {field.state.meta.errors[0]?.message}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            />

            <form.Field name="last4">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>
                        4 últimos dígitos
                     </FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        inputMode="numeric"
                        maxLength={4}
                        name={field.name}
                        placeholder="Opcional"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                           field.handleChange(
                              e.target.value.replace(/\D/g, "").slice(0, 4),
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

            <form.Field name="creditLimit">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name} required>
                        Limite
                     </FieldLabel>
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

            <div className="grid grid-cols-2 gap-4">
               <form.Field name="closingDay">
                  {(field) => (
                     <Field data-invalid={isFieldInvalid(field) || undefined}>
                        <FieldLabel htmlFor={field.name} required>
                           Dia de fechamento
                        </FieldLabel>
                        <NumberInput
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           max={31}
                           min={1}
                           name={field.name}
                           placeholder="1"
                           value={field.state.value}
                           onBlur={field.handleBlur}
                           onChange={(value) => field.handleChange(value)}
                        />
                        {isFieldInvalid(field) ? (
                           <FieldError>
                              {field.state.meta.errors[0]?.message}
                           </FieldError>
                        ) : null}
                     </Field>
                  )}
               </form.Field>

               <form.Field name="dueDay">
                  {(field) => (
                     <Field data-invalid={isFieldInvalid(field) || undefined}>
                        <FieldLabel htmlFor={field.name} required>
                           Dia de vencimento
                        </FieldLabel>
                        <NumberInput
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                           max={31}
                           min={1}
                           name={field.name}
                           placeholder="10"
                           value={field.state.value}
                           onBlur={field.handleBlur}
                           onChange={(value) => field.handleChange(value)}
                        />
                        {isFieldInvalid(field) ? (
                           <FieldError>
                              {field.state.meta.errors[0]?.message}
                           </FieldError>
                        ) : null}
                     </Field>
                  )}
               </form.Field>
            </div>
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
                     Criar cartão
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
