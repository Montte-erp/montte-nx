import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import {
   SheetClose,
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { toast } from "@packages/ui/hooks/use-toast";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import type { ProdutoRow } from "./produtos-columns";

const formSchema = z.object({
   sku: z.string().trim().min(2, "Informe o SKU."),
   nome: z.string().trim().min(2, "Informe o produto."),
   deposito: z.string().trim().min(2, "Informe o depósito."),
   saldo: z.number().int().min(0, "Saldo não pode ser negativo."),
   reservado: z.number().int().min(0, "Reserva não pode ser negativa."),
   minimo: z.number().int().min(0, "Mínimo não pode ser negativo."),
});

type FormValues = z.input<typeof formSchema>;

const defaultValues: FormValues = {
   sku: "",
   nome: "",
   deposito: "Principal",
   saldo: 0,
   reservado: 0,
   minimo: 0,
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

function getFieldErrorMessage(error: unknown) {
   if (typeof error === "string") return error;
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
   )
      return error.message;
   return undefined;
}

export function ProdutoFormSheet({
   onCreate,
}: {
   onCreate: (row: ProdutoRow) => void;
}) {
   const { closeTopSheet } = useSheet();
   const form = useForm({
      defaultValues,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: ({ value }) => {
         onCreate({
            id: crypto.randomUUID(),
            sku: value.sku.trim(),
            nome: value.nome.trim(),
            deposito: value.deposito.trim(),
            saldo: value.saldo,
            reservado: value.reservado,
            minimo: value.minimo,
         });
         toast.success("Produto criado no estoque da demo.");
         closeTopSheet();
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo produto</SheetTitle>
            <SheetDescription>
               Cadastre um item local para demonstrar saldo, reserva, mínimo e
               depósito.
            </SheetDescription>
         </SheetHeader>
         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(event) => {
               event.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field
               name="sku"
               children={(field) => (
                  <TextField field={field} label="SKU" placeholder="SKU-5050" />
               )}
            />
            <form.Field
               name="nome"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Produto"
                     placeholder="Módulo recorrência"
                  />
               )}
            />
            <form.Field
               name="deposito"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Depósito"
                     placeholder="Principal"
                  />
               )}
            />
            <div className="grid gap-4 md:grid-cols-3">
               <form.Field
                  name="saldo"
                  children={(field) => (
                     <NumberField field={field} label="Saldo" />
                  )}
               />
               <form.Field
                  name="reservado"
                  children={(field) => (
                     <NumberField field={field} label="Reservado" />
                  )}
               />
               <form.Field
                  name="minimo"
                  children={(field) => (
                     <NumberField field={field} label="Mínimo" />
                  )}
               />
            </div>
         </form>
         <SheetFooter>
            <SheetClose asChild>
               <Button variant="outline">Cancelar</Button>
            </SheetClose>
            <form.Subscribe
               selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
               })}
            >
               {({ canSubmit, isSubmitting }) => (
                  <Button
                     disabled={!canSubmit || isSubmitting}
                     onClick={() => form.handleSubmit()}
                  >
                     Criar produto
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}

function TextField({
   field,
   label,
   placeholder,
}: {
   field: {
      name: string;
      state: { value: string; meta: { isTouched: boolean; errors: unknown[] } };
      handleBlur: () => void;
      handleChange: (value: string) => void;
   };
   label: string;
   placeholder: string;
}) {
   return (
      <Field data-invalid={isFieldInvalid(field) || undefined}>
         <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
         <Input
            aria-invalid={isFieldInvalid(field)}
            id={field.name}
            name={field.name}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder={placeholder}
            value={field.state.value}
         />
         {isFieldInvalid(field) ? (
            <FieldError>
               {getFieldErrorMessage(field.state.meta.errors[0])}
            </FieldError>
         ) : null}
      </Field>
   );
}

function NumberField({
   field,
   label,
}: {
   field: {
      name: string;
      state: { value: number; meta: { isTouched: boolean; errors: unknown[] } };
      handleBlur: () => void;
      handleChange: (value: number) => void;
   };
   label: string;
}) {
   return (
      <Field data-invalid={isFieldInvalid(field) || undefined}>
         <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
         <Input
            aria-invalid={isFieldInvalid(field)}
            id={field.name}
            name={field.name}
            min={0}
            onBlur={field.handleBlur}
            onChange={(event) =>
               field.handleChange(
                  Number.parseInt(event.target.value || "0", 10),
               )
            }
            type="number"
            value={field.state.value}
         />
         {isFieldInvalid(field) ? (
            <FieldError>
               {getFieldErrorMessage(field.state.meta.errors[0])}
            </FieldError>
         ) : null}
      </Field>
   );
}
