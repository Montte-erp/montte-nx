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

type SubcategoryFormProps =
   | {
        mode: "create";
        parentId: string;
        parentName: string;
        parentType: "income" | "expense";
        onSuccess: () => void;
     }
   | {
        mode: "edit";
        id: string;
        name: string;
        parentName: string;
        onSuccess: () => void;
     };

export function SubcategoryForm(props: SubcategoryFormProps) {
   const createMutation = useMutation(
      orpc.categories.create.mutationOptions({
         onSuccess: () => {
            toast.success("Subcategoria criada com sucesso.");
            props.onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar subcategoria.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.categories.update.mutationOptions({
         onSuccess: () => {
            toast.success("Subcategoria atualizada com sucesso.");
            props.onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar subcategoria.");
         },
      }),
   );

   const form = useForm({
      defaultValues: { name: props.mode === "edit" ? props.name : "" },
      onSubmit: async ({ value }) => {
         if (props.mode === "create") {
            createMutation.mutate({
               name: value.name.trim(),
               parentId: props.parentId,
               type: props.parentType,
            });
         } else {
            updateMutation.mutate({ id: props.id, name: value.name.trim() });
         }
      },
   });

   const isPending = createMutation.isPending || updateMutation.isPending;

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
               {props.mode === "create"
                  ? "Nova Subcategoria"
                  : "Editar Subcategoria"}
            </CredenzaTitle>
            <CredenzaDescription>
               {props.mode === "create"
                  ? "Adicionando subcategoria em"
                  : "Editando subcategoria de"}{" "}
               <strong>{props.parentName}</strong>.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
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
                              autoFocus
                              id={field.name}
                              name={field.name}
                              aria-invalid={isInvalid}
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
               />
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe selector={(s) => s}>
               {(state) => (
                  <Button
                     disabled={
                        !state.canSubmit || state.isSubmitting || isPending
                     }
                     type="submit"
                  >
                     {(state.isSubmitting || isPending) && (
                        <Spinner className="size-4" />
                     )}
                     {props.mode === "create" ? "Criar Subcategoria" : "Salvar"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
