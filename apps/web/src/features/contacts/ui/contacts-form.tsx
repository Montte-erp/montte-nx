import { Button } from "@packages/ui/components/button";
import {
   DialogStackContent,
   DialogStackDescription,
   DialogStackHeader,
   DialogStackTitle,
} from "@packages/ui/components/dialog-stack";
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
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";
import type { ContactRow } from "./contacts-columns";

interface ContactFormProps {
   mode: "create" | "edit";
   contact?: ContactRow;
   onSuccess: () => void;
}

export function ContactForm({ mode, contact, onSuccess }: ContactFormProps) {
   const isCreate = mode === "create";

   const createMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         onSuccess: () => {
            toast.success("Contato criado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar contato.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.contacts.update.mutationOptions({
         onSuccess: () => {
            toast.success("Contato atualizado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar contato.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         name: contact?.name ?? "",
         type: contact?.type ?? ("cliente" as ContactRow["type"]),
         email: contact?.email ?? "",
         phone: contact?.phone ?? "",
         document: contact?.document ?? "",
         documentType: contact?.documentType ?? ("" as "" | "cpf" | "cnpj"),
         notes: "",
      },
      onSubmit: async ({ value }) => {
         const payload = {
            name: value.name.trim(),
            type: value.type,
            email: value.email?.trim() || null,
            phone: value.phone?.trim() || null,
            document: value.document?.trim() || null,
            documentType: (value.documentType || null) as "cpf" | "cnpj" | null,
            notes: value.notes?.trim() || null,
         };
         if (isCreate) {
            createMutation.mutate(payload);
         } else if (contact) {
            updateMutation.mutate({ id: contact.id, ...payload });
         }
      },
   });

   const isPending = createMutation.isPending || updateMutation.isPending;

   return (
      <form
         className="h-full flex flex-col"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <DialogStackContent index={0}>
            <DialogStackHeader>
               <DialogStackTitle>
                  {isCreate ? "Novo Contato" : "Editar Contato"}
               </DialogStackTitle>
               <DialogStackDescription>
                  {isCreate
                     ? "Cadastre um cliente ou fornecedor."
                     : "Atualize as informações do contato."}
               </DialogStackDescription>
            </DialogStackHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4">
               <FieldGroup>
                  <form.Field name="name">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel>Nome *</FieldLabel>
                              <Input
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
                  </form.Field>

                  <form.Field name="type">
                     {(field) => (
                        <Field>
                           <FieldLabel>Tipo *</FieldLabel>
                           <Select
                              onValueChange={(v) =>
                                 field.handleChange(v as ContactRow["type"])
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="cliente">
                                    Cliente
                                 </SelectItem>
                                 <SelectItem value="fornecedor">
                                    Fornecedor
                                 </SelectItem>
                                 <SelectItem value="ambos">Ambos</SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>

                  <div className="grid grid-cols-3 gap-2">
                     <form.Field name="documentType">
                        {(field) => (
                           <Field>
                              <FieldLabel>Tipo Doc.</FieldLabel>
                              <Select
                                 onValueChange={(v) =>
                                    field.handleChange(v as "" | "cpf" | "cnpj")
                                 }
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
                     </form.Field>

                     <form.Field name="document">
                        {(field) => (
                           <Field className="col-span-2">
                              <FieldLabel>Número</FieldLabel>
                              <Input
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="000.000.000-00"
                                 value={field.state.value}
                              />
                           </Field>
                        )}
                     </form.Field>
                  </div>

                  <form.Field name="email">
                     {(field) => (
                        <Field>
                           <FieldLabel>Email</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="contato@empresa.com"
                              type="email"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="phone">
                     {(field) => (
                        <Field>
                           <FieldLabel>Telefone</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="(11) 99999-9999"
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>

                  <form.Field name="notes">
                     {(field) => (
                        <Field>
                           <FieldLabel>Observações</FieldLabel>
                           <Textarea
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Informações adicionais..."
                              rows={3}
                              value={field.state.value}
                           />
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            </div>

            <div className="border-t px-4 py-4">
               <form.Subscribe selector={(state) => state}>
                  {(state) => (
                     <Button
                        className="w-full"
                        disabled={
                           !state.canSubmit || state.isSubmitting || isPending
                        }
                        type="submit"
                     >
                        {(state.isSubmitting || isPending) && (
                           <Spinner className="size-4 mr-2" />
                        )}
                        {isCreate ? "Criar contato" : "Salvar alterações"}
                     </Button>
                  )}
               </form.Subscribe>
            </div>
         </DialogStackContent>
      </form>
   );
}
