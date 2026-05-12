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
import { toast } from "@packages/ui/components/sonner";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { fromPromise } from "neverthrow";
import { z } from "zod";
import { useSheet } from "@/hooks/use-sheet";
import { orpc } from "@/integrations/orpc/client";

const formSchema = z.object({
   name: z
      .string()
      .trim()
      .min(2, "Nome deve ter no mínimo 2 caracteres.")
      .max(120, "Nome deve ter no máximo 120 caracteres."),
   description: z
      .string()
      .trim()
      .max(500, "Descrição deve ter no máximo 500 caracteres."),
});

type FormValues = z.input<typeof formSchema>;

const DEFAULT_VALUES: FormValues = { name: "", description: "" };

function isFieldInvalid(field: {
   state: { meta: { isTouched: boolean; errors: unknown[] } };
}) {
   return field.state.meta.isTouched && field.state.meta.errors.length > 0;
}

export function ServiceFormSheet() {
   const { closeTopSheet } = useSheet();

   const createMutation = useMutation(
      orpc.services.create.mutationOptions({
         onSuccess: () => {
            toast.success("Serviço criado com sucesso.");
            closeTopSheet();
         },
         onError: (e) => toast.error(e.message),
      }),
   );

   const form = useForm({
      defaultValues: DEFAULT_VALUES,
      validators: { onMount: formSchema, onChange: formSchema },
      onSubmit: async ({ value }) => {
         const description = value.description.trim() || undefined;
         const result = await fromPromise(
            createMutation.mutateAsync({
               name: value.name.trim(),
               description,
            }),
            (e) => e,
         );
         if (result.isErr()) return;
      },
   });

   return (
      <>
         <SheetHeader>
            <SheetTitle>Novo serviço</SheetTitle>
            <SheetDescription>
               Cadastre um serviço para começar a oferecer no catálogo.
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
                        placeholder="Ex.: Coworking diário"
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

            <form.Field name="description">
               {(field) => (
                  <Field data-invalid={isFieldInvalid(field) || undefined}>
                     <FieldLabel htmlFor={field.name}>Descrição</FieldLabel>
                     <Textarea
                        aria-invalid={isFieldInvalid(field)}
                        id={field.name}
                        name={field.name}
                        placeholder="Detalhes opcionais do serviço"
                        rows={3}
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
                     Criar serviço
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </>
   );
}
