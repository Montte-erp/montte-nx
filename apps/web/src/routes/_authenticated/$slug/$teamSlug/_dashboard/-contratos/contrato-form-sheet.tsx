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
import type { ContratoRow } from "./contratos-columns";

const formSchema = z.object({
   numero: z.string().trim().min(2, "Informe o número do contrato."),
   cliente: z.string().trim().min(2, "Informe o cliente."),
   servico: z.string().trim().min(2, "Informe o serviço contratado."),
   inicioVigencia: z.string().trim().min(10, "Informe o início da vigência."),
   fimVigencia: z.string().trim().min(10, "Informe o fim da vigência."),
   diaCobranca: z.string().trim().min(1, "Informe o dia de cobrança."),
   valorRecorrente: z.string().trim().min(4, "Informe o valor recorrente."),
   periodicidade: z.enum(["mensal", "trimestral", "anual"]),
   proximaCobranca: z.string().trim().min(10, "Informe a próxima cobrança."),
   reajusteIndice: z.string().trim().min(2, "Informe o índice de reajuste."),
   status: z.enum([
      "ativo",
      "em_assinatura",
      "pausado",
      "encerrado",
      "revisar_reajuste",
   ]),
});

type FormValues = z.input<typeof formSchema>;

const defaultValues: FormValues = {
   numero: "",
   cliente: "",
   servico: "",
   inicioVigencia: "01/06/2026",
   fimVigencia: "31/05/2027",
   diaCobranca: "5",
   valorRecorrente: "",
   periodicidade: "mensal",
   proximaCobranca: "05/06/2026",
   reajusteIndice: "IPCA",
   status: "ativo",
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

export function ContratoFormSheet({
   onCreate,
}: {
   onCreate: (row: ContratoRow) => void;
}) {
   const { closeTopSheet } = useSheet();
   const form = useForm({
      defaultValues,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: ({ value }) => {
         onCreate({ id: crypto.randomUUID(), ...value });
         toast.success("Contrato recorrente criado na demo.");
         closeTopSheet();
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo contrato recorrente</SheetTitle>
            <SheetDescription>
               Cadastre vigência, recorrência, próxima cobrança e regra de
               reajuste como em um ERP operacional.
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
                     label="Contrato"
                     placeholder="CTR-2026-022"
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
               name="servico"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Serviço"
                     placeholder="Assinatura operacional"
                  />
               )}
            />
            <div className="grid gap-4 md:grid-cols-2">
               <form.Field
                  name="inicioVigencia"
                  children={(field) => (
                     <TextField
                        field={field}
                        label="Início vigência"
                        placeholder="01/06/2026"
                     />
                  )}
               />
               <form.Field
                  name="fimVigencia"
                  children={(field) => (
                     <TextField
                        field={field}
                        label="Fim vigência"
                        placeholder="31/05/2027"
                     />
                  )}
               />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
               <form.Field
                  name="valorRecorrente"
                  children={(field) => (
                     <TextField
                        field={field}
                        label="Valor recorrente"
                        placeholder="R$ 4.900,00"
                     />
                  )}
               />
               <form.Field
                  name="diaCobranca"
                  children={(field) => (
                     <TextField
                        field={field}
                        label="Dia de cobrança"
                        placeholder="5"
                     />
                  )}
               />
            </div>
            <form.Field
               name="proximaCobranca"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Próxima cobrança"
                     placeholder="05/06/2026"
                  />
               )}
            />
            <form.Field
               name="reajusteIndice"
               children={(field) => (
                  <TextField
                     field={field}
                     label="Índice de reajuste"
                     placeholder="IPCA"
                  />
               )}
            />
            <div className="grid gap-4 md:grid-cols-2">
               <form.Field
                  name="periodicidade"
                  children={(field) => (
                     <Field data-invalid={isFieldInvalid(field) || undefined}>
                        <FieldLabel htmlFor={field.name}>
                           Periodicidade
                        </FieldLabel>
                        <Select
                           value={field.state.value}
                           onValueChange={(value) => {
                              if (
                                 value === "mensal" ||
                                 value === "trimestral" ||
                                 value === "anual"
                              ) {
                                 field.handleChange(value);
                              }
                           }}
                        >
                           <SelectTrigger
                              aria-invalid={isFieldInvalid(field)}
                              id={field.name}
                           >
                              <SelectValue placeholder="Selecione" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="mensal">Mensal</SelectItem>
                              <SelectItem value="trimestral">
                                 Trimestral
                              </SelectItem>
                              <SelectItem value="anual">Anual</SelectItem>
                           </SelectContent>
                        </Select>
                     </Field>
                  )}
               />
               <form.Field
                  name="status"
                  children={(field) => (
                     <Field data-invalid={isFieldInvalid(field) || undefined}>
                        <FieldLabel htmlFor={field.name}>Status</FieldLabel>
                        <Select
                           value={field.state.value}
                           onValueChange={(value) => {
                              if (
                                 value === "ativo" ||
                                 value === "em_assinatura" ||
                                 value === "pausado" ||
                                 value === "encerrado" ||
                                 value === "revisar_reajuste"
                              ) {
                                 field.handleChange(value);
                              }
                           }}
                        >
                           <SelectTrigger
                              aria-invalid={isFieldInvalid(field)}
                              id={field.name}
                           >
                              <SelectValue placeholder="Selecione" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="em_assinatura">
                                 Em assinatura
                              </SelectItem>
                              <SelectItem value="pausado">Pausado</SelectItem>
                              <SelectItem value="encerrado">
                                 Encerrado
                              </SelectItem>
                              <SelectItem value="revisar_reajuste">
                                 Revisar reajuste
                              </SelectItem>
                           </SelectContent>
                        </Select>
                     </Field>
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
                     Criar contrato
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
