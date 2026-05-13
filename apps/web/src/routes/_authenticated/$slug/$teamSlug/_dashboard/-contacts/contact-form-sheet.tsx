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
   type: z.enum(["cliente", "fornecedor", "ambos"]),
   email: z.string().trim(),
   phone: z.string().trim(),
});

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = {
   name: "",
   type: "ambos",
   email: "",
   phone: "",
};

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

export function ContactFormSheet() {
   const { closeTopSheet } = useSheet();

   const createMutation = useMutation(
      orpc.contacts.create.mutationOptions({
         onSuccess: () => {
            toast.success("Contato criado com sucesso.");
            closeTopSheet();
         },
         onError: (e) => toast.error(e.message || "Erro ao criar contato."),
      }),
   );

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const result = await fromPromise(
            createMutation.mutateAsync({
               name: value.name.trim(),
               type: value.type,
               email: value.email.trim() || null,
               phone: value.phone.trim() || null,
            }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo contato</SheetTitle>
            <SheetDescription>
               Cadastre um cliente, fornecedor ou ambos.
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
                        placeholder="Ex.: Maria Oliveira"
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

            <form.Field name="type">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Tipo</FieldLabel>
                     <Select
                        value={field.state.value}
                        onValueChange={(v) =>
                           field.handleChange(
                              v as "cliente" | "fornecedor" | "ambos",
                           )
                        }
                     >
                        <SelectTrigger id={field.name} name={field.name}>
                           <SelectValue />
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
            </form.Field>

            <form.Field name="email">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>E-mail</FieldLabel>
                     <Input
                        id={field.name}
                        name={field.name}
                        placeholder="contato@exemplo.com"
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                     />
                  </Field>
               )}
            </form.Field>

            <form.Field name="phone">
               {(field) => (
                  <Field>
                     <FieldLabel htmlFor={field.name}>Telefone</FieldLabel>
                     <Input
                        id={field.name}
                        name={field.name}
                        placeholder="(11) 99999-0000"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                     />
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
                     Criar contato
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
