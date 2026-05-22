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
import { toast } from "@packages/ui/hooks/use-toast";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import type { NfeRow, NfeStatus } from "./nfe-columns";

const formSchema = z.object({
   numero: z.string().trim().min(2, "Informe o número da NF-e."),
   cliente: z.string().trim().min(2, "Informe o cliente."),
   cnpj: z.string().trim().min(14, "Informe um CNPJ válido."),
   valor: z.string().trim().min(4, "Informe o valor."),
   emissao: z.string().trim().min(10, "Informe a data de emissão."),
   contrato: z.string().trim().min(2, "Informe o contrato vinculado."),
   status: z.enum(["rascunho", "validacao", "autorizada", "cancelada"]),
});

type FormValues = z.input<typeof formSchema>;

const defaultValues: FormValues = {
   numero: "",
   cliente: "",
   cnpj: "",
   valor: "",
   emissao: "21/05/2026",
   contrato: "",
   status: "rascunho",
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

export function NfeFormSheet({
   onCreate,
}: {
   onCreate: (row: NfeRow) => void;
}) {
   const { closeTopSheet } = useSheet();
   const form = useForm({
      defaultValues,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: ({ value }) => {
         onCreate({
            id: crypto.randomUUID(),
            numero: value.numero.trim(),
            cliente: value.cliente.trim(),
            cnpj: value.cnpj.trim(),
            valor: value.valor.trim(),
            emissao: value.emissao.trim(),
            contrato: value.contrato.trim(),
            status: value.status,
         });
         toast.success("NF-e mockada criada com sucesso.");
         closeTopSheet();
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Nova NF-e mockada</SheetTitle>
            <SheetDescription>
               Cadastre uma nota local para demonstrar validação, autorização e
               vínculo com contrato.
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
               name="numero"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Número"
                     placeholder="NFE-1052"
                  />
               )}
            />
            <form.Field
               name="cliente"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Cliente"
                     placeholder="Empresa Demo Ltda"
                  />
               )}
            />
            <form.Field
               name="cnpj"
               children={(field) => (
                  <TextField
                     field={field}
                     label="CNPJ"
                     placeholder="12.345.678/0001-90"
                  />
               )}
            />
            <form.Field
               name="valor"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Valor"
                     placeholder="R$ 4.900,00"
                  />
               )}
            />
            <form.Field
               name="emissao"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Emissão"
                     placeholder="21/05/2026"
                  />
               )}
            />
            <form.Field
               name="contrato"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Contrato"
                     placeholder="CTR-2026-022"
                  />
               )}
            />
            <form.Field
               name="status"
               children={(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(value: NfeStatus) =>
                           field.handleChange(value)
                        }
                     >
                        <SelectTrigger
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                        >
                           <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="rascunho">Rascunho</SelectItem>
                           <SelectItem value="validacao">
                              Em validação
                           </SelectItem>
                           <SelectItem value="autorizada">
                              Autorizada
                           </SelectItem>
                           <SelectItem value="cancelada">Cancelada</SelectItem>
                        </SelectContent>
                     </Select>
                  </Field>
               )}
            />
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
                     Criar NF-e
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
