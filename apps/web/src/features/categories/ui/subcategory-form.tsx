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
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface SubcategoryFormProps {
   parentId: string;
   parentName: string;
   parentType: "income" | "expense";
   onSuccess: () => void;
}

export function SubcategoryForm({
   parentId,
   parentName,
   parentType,
   onSuccess,
}: SubcategoryFormProps) {
   const createMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: () => {
            toast.success("Subcategoria criada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar subcategoria.");
         },
      }),
   );

   const form = useForm({
      defaultValues: { name: "" },
      onSubmit: async ({ value }) => {
         createMutation.mutate({
            name: value.name.trim(),
            parentId,
            type: parentType,
         });
      },
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
            <CredenzaTitle>Nova Subcategoria</CredenzaTitle>
            <CredenzaDescription>
               Adicionando subcategoria em <strong>{parentName}</strong>.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
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
                              autoFocus
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Supermercado, Farmácia"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe selector={(s) => s}>
               {(state) => (
                  <Button
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        createMutation.isPending
                     }
                     type="submit"
                  >
                     {(state.isSubmitting || createMutation.isPending) && (
                        <Spinner className="size-4" />
                     )}
                     Criar Subcategoria
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
