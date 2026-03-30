import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaDescription,
   CredenzaFooter,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import { Field, FieldError, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { useForm } from "@tanstack/react-form";

interface SubcategoryMiniFormProps {
   parentName: string;
   onAdd: (name: string) => void;
}

export function SubcategoryMiniForm({ parentName, onAdd }: SubcategoryMiniFormProps) {
   const form = useForm({
      defaultValues: { name: "" },
      onSubmit: ({ value }) => {
         onAdd(value.name.trim());
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
               Adicionando em <strong>{parentName}</strong>.
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <FieldGroup>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Nome *</FieldLabel>
                           <Input
                              autoFocus
                              onBlur={field.handleBlur}
                              onChange={(e) => field.handleChange(e.target.value)}
                              placeholder="Ex: Supermercado, Farmácia"
                              value={field.state.value}
                           />
                           {isInvalid && <FieldError errors={field.state.meta.errors} />}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe selector={(s) => s}>
               {(state) => (
                  <Button disabled={!state.canSubmit || !state.values.name.trim()} type="submit">
                     Adicionar
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
