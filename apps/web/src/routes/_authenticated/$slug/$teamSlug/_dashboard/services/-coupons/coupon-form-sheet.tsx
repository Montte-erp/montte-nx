import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
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
import { useMutation } from "@tanstack/react-query";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";

const formSchema = z.object({
   code: z
      .string()
      .trim()
      .min(1, "Código obrigatório.")
      .max(40, "Código deve ter no máximo 40 caracteres."),
   direction: z.enum(["discount", "surcharge"]),
   amount: z
      .string()
      .refine(
         (v) => Number.isFinite(Number(v)) && Number(v) >= 0,
         "Valor inválido.",
      ),
});

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   code: "",
   direction: "discount",
   amount: "0",
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

export function CouponFormSheet() {
   const { closeTopSheet } = useSheet();

   const createMutation = useMutation(
      orpc.coupons.create.mutationOptions({
         onSuccess: () => {
            toast.success("Cupom criado.");
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
               code: value.code.trim(),
               direction: value.direction,
               trigger: "code",
               scope: "team",
               type: "percent",
               amount: Number(value.amount).toFixed(4),
               duration: "once",
               durationMonths: null,
               maxUses: null,
               meterId: null,
            }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo cupom</SheetTitle>
            <SheetDescription>
               Cadastre um cupom com valores essenciais. Ajuste regras avançadas
               diretamente na linha após criar.
            </SheetDescription>
         </SheetHeader>

         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(e) => {
               e.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field name="code">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Código</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder="EX: BLACKFRIDAY10"
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

            <form.Field name="direction">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                           field.handleChange(v as "discount" | "surcharge")
                        }
                     >
                        <SelectTrigger id={field.name} name={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="discount">Desconto</SelectItem>
                           <SelectItem value="surcharge">Acréscimo</SelectItem>
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            </form.Field>

            <form.Field name="amount">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>
                        Percentual (0 a 100)
                     </FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder="10"
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
                     Criar cupom
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
