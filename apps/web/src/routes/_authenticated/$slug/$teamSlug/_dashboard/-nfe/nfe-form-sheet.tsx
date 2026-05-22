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
import type { NfeRow } from "./nfe-columns";

const formSchema = z.object({
   numero: z.string().trim().min(2, "Informe o número da NF-e."),
   serie: z.string().trim().min(1, "Informe a série."),
   cliente: z.string().trim().min(2, "Informe o cliente."),
   cnpj: z.string().trim().min(14, "Informe um CNPJ válido."),
   valor: z.string().trim().min(4, "Informe o valor."),
   emissao: z.string().trim().min(10, "Informe a data de emissão."),
   contrato: z.string().trim().min(2, "Informe o vínculo comercial."),
   operacao: z.string().trim().min(2, "Informe a operação fiscal."),
   ambiente: z.enum(["normal", "contingencia", "homologacao"]),
});

type FormValues = z.input<typeof formSchema>;

const defaultValues: FormValues = {
   numero: "",
   serie: "1",
   cliente: "",
   cnpj: "",
   valor: "",
   emissao: "22/05/2026",
   contrato: "",
   operacao: "Venda de produto",
   ambiente: "normal",
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
   ) {
      return error.message;
   }
   return undefined;
}

function buildDemoAccessKey(numero: string, cnpj: string) {
   const digits = `${cnpj}${numero}`.replaceAll(/\D/g, "");
   return `${digits.padEnd(44, "0").slice(0, 44)}`;
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
         const numero = value.numero.trim();
         const cnpj = value.cnpj.trim();
         onCreate({
            id: crypto.randomUUID(),
            numero,
            serie: value.serie.trim(),
            modelo: "55",
            cliente: value.cliente.trim(),
            cnpj,
            valor: value.valor.trim(),
            emissao: value.emissao.trim(),
            contrato: value.contrato.trim(),
            operacao: value.operacao.trim(),
            ambiente: value.ambiente,
            chave: buildDemoAccessKey(numero, cnpj),
            recibo: "Aguardando envio",
            protocolo: "Sem protocolo",
            retorno: "Nota pronta para emissão com certificado digital.",
            evento: "Documento criado localmente.",
            status: "pronta",
         });
         toast.success("NF-e criada na demo fiscal.");
         closeTopSheet();
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Emitir NF-e</SheetTitle>
            <SheetDescription>
               O certificado digital mockado já está conectado. Informe os dados
               comerciais e o Montte prepara a assinatura, envio e XML/DANFE.
            </SheetDescription>
         </SheetHeader>
         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(event) => {
               event.preventDefault();
               form.handleSubmit();
            }}
         >
            <div className="grid gap-4 md:grid-cols-2">
               <form.Field
                  name="numero"
                  children={(field) => (
                     <TextField
                        field={field}
                        label="Número"
                        placeholder="1052"
                     />
                  )}
               />
               <form.Field
                  name="serie"
                  children={(field) => (
                     <TextField field={field} label="Série" placeholder="1" />
                  )}
               />
            </div>
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
            <div className="grid gap-4 md:grid-cols-2">
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
                        placeholder="22/05/2026"
                     />
                  )}
               />
            </div>
            <form.Field
               name="contrato"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Vínculo"
                     placeholder="CTR-2026-022"
                  />
               )}
            />
            <form.Field
               name="operacao"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Operação fiscal"
                     placeholder="Venda de produto"
                  />
               )}
            />
            <form.Field
               name="ambiente"
               children={(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Ambiente</FieldLabel>
                     <Select
                        onValueChange={(value) =>
                           field.handleChange(
                              formSchema.shape.ambiente.parse(value),
                           )
                        }
                        value={field.state.value}
                     >
                        <SelectTrigger
                           aria-invalid={isFieldInvalid(field)}
                           id={field.name}
                        >
                           <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="normal">Normal</SelectItem>
                           <SelectItem value="contingencia">
                              Contingência
                           </SelectItem>
                           <SelectItem value="homologacao">
                              Homologação
                           </SelectItem>
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
                     Preparar emissão
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
      state: {
         value: string;
         meta: { isTouched: boolean; errors: unknown[] };
      };
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
