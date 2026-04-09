import { Button } from "@packages/ui/components/button";
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
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Textarea } from "@packages/ui/components/textarea";
import type { MaskitoOptions } from "@maskito/core";
import { useMaskito } from "@maskito/react";
import { ORPCError } from "@orpc/client";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import { useBlocker } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import type { ContactRow } from "./contacts-columns";

const phoneMaskOptions: MaskitoOptions = {
   mask: [
      "(",
      /\d/,
      /\d/,
      ")",
      " ",
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      "-",
      /\d/,
      /\d/,
      /\d/,
      /\d/,
   ],
};

const cpfMaskOptions: MaskitoOptions = {
   mask: [
      /\d/,
      /\d/,
      /\d/,
      ".",
      /\d/,
      /\d/,
      /\d/,
      ".",
      /\d/,
      /\d/,
      /\d/,
      "-",
      /\d/,
      /\d/,
   ],
};

const cnpjMaskOptions: MaskitoOptions = {
   mask: [
      /\d/,
      /\d/,
      ".",
      /\d/,
      /\d/,
      /\d/,
      ".",
      /\d/,
      /\d/,
      /\d/,
      "/",
      /\d/,
      /\d/,
      /\d/,
      /\d/,
      "-",
      /\d/,
      /\d/,
   ],
};

const noMaskOptions: MaskitoOptions = { mask: /^.*$/ };

interface ContactFormProps {
   mode: "create" | "edit";
   contact?: ContactRow;
   onSuccess: () => void;
}

export function ContactForm({ mode, contact, onSuccess }: ContactFormProps) {
   const isCreate = mode === "create";

   const documentTypeDefault: "" | "cpf" | "cnpj" = contact?.documentType ?? "";

   const form = useForm({
      defaultValues: {
         name: contact?.name ?? "",
         type: contact?.type ?? ("cliente" satisfies ContactRow["type"]),
         email: contact?.email ?? "",
         phone: contact?.phone ?? "",
         document: contact?.document ?? "",
         documentType: documentTypeDefault,
         notes: contact?.notes ?? "",
      },
      validators: {
         onSubmitAsync: async ({ value }) => {
            const payload = {
               name: value.name.trim(),
               type: value.type,
               email: value.email?.trim() || null,
               phone: value.phone?.trim() || null,
               document: value.document?.trim() || null,
               documentType:
                  value.documentType === "" ? null : value.documentType,
               notes: value.notes?.trim() || null,
            };
            try {
               if (isCreate) {
                  await orpc.contacts.create.call(payload);
                  toast.success("Contato criado com sucesso.");
               } else if (contact) {
                  await orpc.contacts.update.call({
                     id: contact.id,
                     ...payload,
                  });
                  toast.success("Contato atualizado com sucesso.");
               }
               onSuccess();
               return null;
            } catch (err) {
               if (err instanceof ORPCError && err.code === "CONFLICT") {
                  return {
                     fields: { document: "CNPJ/CPF já cadastrado." },
                  };
               }
               return {
                  form: err instanceof Error ? err.message : "Erro inesperado.",
               };
            }
         },
      },
   });

   const docType = useStore(
      form.baseStore,
      (state) => state.values.documentType,
   );

   const documentMaskOptions = useMemo<MaskitoOptions>(() => {
      if (docType === "cpf") return cpfMaskOptions;
      if (docType === "cnpj") return cnpjMaskOptions;
      return noMaskOptions;
   }, [docType]);

   const phoneRef = useMaskito({ options: phoneMaskOptions });
   const documentRef = useMaskito({ options: documentMaskOptions });

   const { openAlertDialog } = useAlertDialog();

   const blocker = useBlocker({
      withResolver: true,
      shouldBlockFn: () => {
         if (form.store.state.isDirty && !form.store.state.isSubmitted) {
            openAlertDialog({
               title: "Descartar alterações?",
               description:
                  "Você tem alterações não salvas. Tem certeza que deseja sair sem salvar?",
               actionLabel: "Descartar alterações",
               cancelLabel: "Continuar editando",
               onAction: () => blocker.proceed(),
               onCancel: () => blocker.reset(),
            });
            return true;
         }
         return false;
      },
      disabled: isCreate,
   });

   return (
      <form
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Novo Contato" : "Editar Contato"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Cadastre um cliente ou fornecedor."
                  : "Atualize as informações do contato."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="px-4">
            <FieldGroup>
               <form.Field
                  name="name"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Nome *</FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Empresa XYZ"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="type"
                  children={(field) => (
                     <Field>
                        <FieldLabel>Tipo *</FieldLabel>
                        <Select
                           onValueChange={(v) => {
                              if (
                                 v === "cliente" ||
                                 v === "fornecedor" ||
                                 v === "ambos"
                              ) {
                                 field.handleChange(v);
                              }
                           }}
                           value={field.state.value}
                        >
                           <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                           </SelectTrigger>
                           <SelectContent>
                              <SelectItem value="cliente">Cliente</SelectItem>
                              <SelectItem value="fornecedor">
                                 Fornecedor
                              </SelectItem>
                              <SelectItem value="ambos">Ambos</SelectItem>
                           </SelectContent>
                        </Select>
                     </Field>
                  )}
               />

               <div className="grid grid-cols-3 gap-2">
                  <form.Field
                     name="documentType"
                     children={(field) => (
                        <Field>
                           <FieldLabel>Tipo Doc.</FieldLabel>
                           <Select
                              onValueChange={(v) => {
                                 if (v === "" || v === "cpf" || v === "cnpj") {
                                    field.handleChange(v);
                                 }
                              }}
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="cpf">CPF</SelectItem>
                                 <SelectItem value="cnpj">CNPJ</SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  />

                  <form.Field
                     name="document"
                     children={(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field
                              className="col-span-2"
                              data-invalid={isInvalid}
                           >
                              <FieldLabel htmlFor={field.name}>
                                 Número
                              </FieldLabel>
                              <Input
                                 ref={documentRef}
                                 aria-invalid={isInvalid}
                                 defaultValue={field.state.value}
                                 id={field.name}
                                 inputMode="numeric"
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onInput={(e) =>
                                    field.handleChange(
                                       (e.target as HTMLInputElement).value,
                                    )
                                 }
                                 placeholder={
                                    docType === "cnpj"
                                       ? "00.000.000/0000-00"
                                       : "000.000.000-00"
                                 }
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  />
               </div>

               <form.Field
                  name="email"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                           <Input
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="contato@empresa.com"
                              type="email"
                              value={field.state.value}
                           />
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="phone"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Telefone
                           </FieldLabel>
                           <Input
                              ref={phoneRef}
                              aria-invalid={isInvalid}
                              defaultValue={field.state.value}
                              id={field.name}
                              inputMode="numeric"
                              name={field.name}
                              onBlur={field.handleBlur}
                              onInput={(e) =>
                                 field.handleChange(
                                    (e.target as HTMLInputElement).value,
                                 )
                              }
                              placeholder="(11) 99999-9999"
                           />
                        </Field>
                     );
                  }}
               />

               <form.Field
                  name="notes"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Observações
                           </FieldLabel>
                           <Textarea
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Informações adicionais..."
                              rows={3}
                              value={field.state.value}
                           />
                        </Field>
                     );
                  }}
               />
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter className="flex flex-col gap-2">
            <form.Subscribe
               selector={(state) =>
                  state.errors.flatMap((e) => {
                     if (!e) return [];
                     if (typeof e === "string") return [e];
                     if ("form" in e && typeof e.form === "string")
                        return [e.form];
                     return [];
                  })
               }
            >
               {(messages) =>
                  messages.length > 0 && <FieldError errors={messages} />
               }
            </form.Subscribe>
            <form.Subscribe
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     className="w-full gap-2"
                     disabled={!canSubmit}
                     type="submit"
                  >
                     {isSubmitting && <Spinner className="size-4" />}
                     {isCreate ? "Criar contato" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
