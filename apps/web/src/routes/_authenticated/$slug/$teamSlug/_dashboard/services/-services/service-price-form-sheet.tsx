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
   name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres."),
   basePrice: z
      .string()
      .refine(
         (v) => Number.isFinite(Number(v)) && Number(v) >= 0,
         "Valor inválido.",
      ),
   interval: z.enum([
      "monthly",
      "annual",
      "weekly",
      "daily",
      "hourly",
      "semestral",
      "shift",
      "one_time",
   ]),
});

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   name: "",
   basePrice: "0",
   interval: "monthly",
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

export function ServicePriceFormSheet({ serviceId }: { serviceId: string }) {
   const { closeTopSheet } = useSheet();

   const createMutation = useMutation(
      orpc.prices.create.mutationOptions({
         onSuccess: () => {
            toast.success("Preço criado.");
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
               serviceId,
               name: value.name.trim(),
               type: "flat",
               basePrice: Number(value.basePrice).toFixed(2),
               interval: value.interval,
               autoEnroll: false,
            }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo preço</SheetTitle>
            <SheetDescription>
               Crie um preço base. Refine tipo, medidor e tetos diretamente na
               linha após criar.
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
                        placeholder="Ex.: Mensal Básico"
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

            <form.Field name="basePrice">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>
                        Preço base (R$)
                     </FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder="0.00"
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

            <form.Field name="interval">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Ciclo</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                           field.handleChange(
                              v as
                                 | "monthly"
                                 | "annual"
                                 | "semestral"
                                 | "weekly"
                                 | "daily"
                                 | "hourly"
                                 | "shift"
                                 | "one_time",
                           )
                        }
                     >
                        <SelectTrigger id={field.name} name={field.name}>
                           <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="monthly">Mensal</SelectItem>
                           <SelectItem value="annual">Anual</SelectItem>
                           <SelectItem value="semestral">Semestral</SelectItem>
                           <SelectItem value="weekly">Semanal</SelectItem>
                           <SelectItem value="daily">Diário</SelectItem>
                           <SelectItem value="hourly">Por hora</SelectItem>
                           <SelectItem value="shift">Por turno</SelectItem>
                           <SelectItem value="one_time">Única vez</SelectItem>
                        </SelectContent>
                     </Select>
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
                     Criar preço
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
