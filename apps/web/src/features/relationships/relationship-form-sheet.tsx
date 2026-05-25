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
import type { Collection } from "@tanstack/react-db";
import { useForm } from "@tanstack/react-form";
import { Result } from "better-result";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import {
   buildOptimisticRelationshipRow,
   buildOptimisticRelationshipRowId,
   createRelationshipAction,
   type RelationshipRole,
   type RelationshipsCollectionRow,
} from "@/integrations/tanstack-db/relationships";

const KIND_VALUES = ["company", "person"] as const;

type RelationshipKind = (typeof KIND_VALUES)[number];

type RelationshipFormSheetProps = {
   collection: Collection<RelationshipsCollectionRow, string>;
   role: RelationshipRole;
   teamId: string | null;
};

const formSchema = z
   .object({
      kind: z.enum(KIND_VALUES),
      name: z
         .string()
         .trim()
         .min(2, "Nome deve ter no mínimo 2 caracteres.")
         .max(160, "Nome deve ter no máximo 160 caracteres."),
      documentNumber: z.string().trim(),
      email: z.union([
         z.literal(""),
         z.string().email("Informe um e-mail válido."),
      ]),
      phone: z.string().trim(),
   })
   .superRefine((value, ctx) => {
      const documentDigits = value.documentNumber.replace(/\D/g, "");
      if (
         value.kind === "person" &&
         documentDigits &&
         !isValidCpf(value.documentNumber)
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["documentNumber"],
            message:
               documentDigits.length === 11
                  ? "CPF inválido."
                  : "CPF deve conter 11 dígitos.",
         });
      }
      if (
         value.kind === "company" &&
         documentDigits &&
         !isValidCnpj(value.documentNumber)
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["documentNumber"],
            message:
               documentDigits.length === 14
                  ? "CNPJ inválido."
                  : "CNPJ deve conter 14 dígitos.",
         });
      }
      const phoneDigits = value.phone.replace(/\D/g, "");
      if (
         phoneDigits &&
         phoneDigits.length !== 10 &&
         phoneDigits.length !== 11
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["phone"],
            message: "Telefone deve ter 10 ou 11 dígitos.",
         });
      }
   });

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   kind: "company",
   name: "",
   documentNumber: "",
   email: "",
   phone: "",
};

function parseKind(value: string): RelationshipKind | undefined {
   return KIND_VALUES.find((kind) => kind === value);
}

function formatDocumentNumber(value: string, kind: RelationshipKind) {
   const digits = value
      .replace(/\D/g, "")
      .slice(0, kind === "person" ? 11 : 14);
   if (kind === "person") {
      return digits
         .replace(/^(\d{3})(\d)/, "$1.$2")
         .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
         .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
   }
   return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
      .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

function formatPhone(value: string) {
   const digits = value.replace(/\D/g, "").slice(0, 11);

   if (digits.length <= 10) {
      return digits
         .replace(/^(\d{2})(\d)/, "($1) $2")
         .replace(/^(\(\d{2}\) \d{4})(\d)/, "$1-$2");
   }

   return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/^(\(\d{2}\) \d{5})(\d)/, "$1-$2");
}

function allDigitsEqual(value: string) {
   return value.split("").every((digit) => digit === value[0]);
}

function cpfDigit(values: string, weights: readonly number[]) {
   const total = values
      .split("")
      .reduce(
         (acc, digit, index) => acc + Number(digit) * (weights[index] ?? 0),
         0,
      );
   const remainder = total % 11;
   return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCpf(value: string) {
   const digits = value.replace(/\D/g, "");
   if (digits.length !== 11 || allDigitsEqual(digits)) return false;
   const body = digits.slice(0, 9);
   const first = cpfDigit(body, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
   const second = cpfDigit(`${body}${first}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
   return `${first}${second}` === digits.slice(9);
}

function cnpjDigit(values: string, weights: readonly number[]) {
   const total = values
      .split("")
      .reduce(
         (acc, digit, index) => acc + Number(digit) * (weights[index] ?? 0),
         0,
      );
   const remainder = total % 11;
   return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCnpj(value: string) {
   const digits = value.replace(/\D/g, "");
   if (digits.length !== 14 || allDigitsEqual(digits)) return false;
   const body = digits.slice(0, 12);
   const first = cnpjDigit(body, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
   const second = cnpjDigit(
      `${body}${first}`,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
   );
   return `${first}${second}` === digits.slice(12);
}

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

function getErrorMessage(error: unknown, fallback: string) {
   if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length > 0
   ) {
      return error.message;
   }
   return fallback;
}

export function RelationshipFormSheet({
   collection,
   role,
   teamId,
}: RelationshipFormSheetProps) {
   const { closeTopSheet } = useSheet();

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         if (!teamId) {
            toast.error("Time ativo não encontrado.");
            return;
         }

         const input = {
            role,
            kind: value.kind,
            name: value.name.trim(),
            documentNumber: value.documentNumber.replace(/\D/g, "") || null,
            email: value.email.trim() || null,
            phone: value.phone.replace(/\D/g, "") || null,
         };
         const createRelationship = createRelationshipAction(collection);
         const transaction = createRelationship({
            input,
            row: buildOptimisticRelationshipRow({
               id: buildOptimisticRelationshipRowId(),
               input,
               teamId,
            }),
         });
         const result = await Result.tryPromise({
            try: () => transaction.isPersisted.promise,
            catch: (error) => error,
         });
         if (Result.isError(result)) {
            toast.error(
               getErrorMessage(result.error, "Erro ao criar relacionamento."),
            );
            return;
         }

         toast.success("Relacionamento criado com sucesso.");
         closeTopSheet();
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>
               {role === "customer" ? "Novo cliente" : "Novo fornecedor"}
            </SheetTitle>
            <SheetDescription>
               Cadastre os dados básicos do relacionamento.
            </SheetDescription>
         </SheetHeader>

         <form
            className="flex flex-1 min-h-0 flex-col gap-4 overflow-y-auto px-4"
            onSubmit={(event) => {
               event.preventDefault();
               form.handleSubmit();
            }}
         >
            <form.Field name="kind">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(value) => {
                           const parsed = parseKind(value);
                           if (!parsed) return;
                           field.handleChange(parsed);
                           form.setFieldValue("documentNumber", (current) =>
                              formatDocumentNumber(current, parsed),
                           );
                        }}
                     >
                        <SelectTrigger
                           id={field.name}
                           aria-invalid={isFieldInvalid(field)}
                        >
                           <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                           <SelectItem value="company">Empresa</SelectItem>
                           <SelectItem value="person">Pessoa física</SelectItem>
                        </SelectContent>
                     </Select>
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {getFieldErrorMessage(field.state.meta.errors[0])}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <form.Field name="name">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                           field.handleChange(event.target.value)
                        }
                        placeholder="Ex.: Acme Ltda."
                        value={field.state.value}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {getFieldErrorMessage(field.state.meta.errors[0])}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.kind}>
               {(kind) => (
                  <form.Field name="documentNumber">
                     {(field) => (
                        <Field
                           data-invalid={isFieldInvalid(field) || undefined}
                        >
                           <FieldLabel htmlFor={field.name}>
                              CPF/CNPJ
                           </FieldLabel>
                           <Input
                              aria-invalid={isFieldInvalid(field)}
                              id={field.name}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(event) =>
                                 field.handleChange(
                                    formatDocumentNumber(
                                       event.target.value,
                                       kind,
                                    ),
                                 )
                              }
                              placeholder={
                                 kind === "person"
                                    ? "000.000.000-00"
                                    : "00.000.000/0000-00"
                              }
                              value={field.state.value}
                           />
                           {isFieldInvalid(field) ? (
                              <FieldError>
                                 {getFieldErrorMessage(
                                    field.state.meta.errors[0],
                                 )}
                              </FieldError>
                           ) : null}
                        </Field>
                     )}
                  </form.Field>
               )}
            </form.Subscribe>

            <form.Field name="email">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                           field.handleChange(event.target.value)
                        }
                        placeholder="financeiro@empresa.com.br"
                        type="email"
                        value={field.state.value}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {getFieldErrorMessage(field.state.meta.errors[0])}
                        </FieldError>
                     ) : null}
                  </Field>
               )}
            </form.Field>

            <form.Field name="phone">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Telefone</FieldLabel>
                     <Input
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) =>
                           field.handleChange(formatPhone(event.target.value))
                        }
                        placeholder="(11) 99999-9999"
                        value={field.state.value}
                     />
                     {isFieldInvalid(field) ? (
                        <FieldError>
                           {getFieldErrorMessage(field.state.meta.errors[0])}
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
               selector={(state) => ({
                  canSubmit: state.canSubmit,
                  isSubmitting: state.isSubmitting,
               })}
            >
               {(state) => (
                  <Button
                     disabled={!state.canSubmit || state.isSubmitting}
                     onClick={() => form.handleSubmit()}
                  >
                     {state.isSubmitting ? "Salvando..." : "Salvar"}
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
