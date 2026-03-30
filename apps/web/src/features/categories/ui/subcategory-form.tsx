import { Badge } from "@packages/ui/components/badge";
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
import { X } from "lucide-react";
import { useCallback, useState } from "react";
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
   const [keywordInput, setKeywordInput] = useState("");

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
      defaultValues: {
         keywords: [] as string[],
         name: "",
      },
      onSubmit: async ({ value }) => {
         createMutation.mutate({
            keywords: value.keywords.length > 0 ? value.keywords : null,
            name: value.name.trim(),
            parentId,
            type: parentType,
         });
      },
   });

   const addKeyword = useCallback(
      (keywords: string[], push: (val: string) => void) => {
         const trimmed = keywordInput.trim().toLowerCase();
         if (trimmed && !keywords.includes(trimmed)) {
            push(trimmed);
         }
         setKeywordInput("");
      },
      [keywordInput],
   );

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

               <form.Field name="keywords" mode="array">
                  {(field) => (
                     <Field>
                        <FieldLabel>Palavras-chave</FieldLabel>
                        <div className="flex flex-col gap-2">
                           <Input
                              onKeyDown={(e) => {
                                 if (e.key === "Enter") {
                                    e.preventDefault();
                                    addKeyword(field.state.value, field.pushValue);
                                 }
                              }}
                              onChange={(e) => setKeywordInput(e.target.value)}
                              placeholder="Digite e pressione Enter para adicionar..."
                              value={keywordInput}
                           />
                           {field.state.value.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                 {field.state.value.map((kw, i) => (
                                    <Badge className="gap-1 pr-1" key={`kw-${i + 1}`} variant="secondary">
                                       {kw}
                                       <button
                                          className="rounded-full hover:text-foreground"
                                          onClick={() => field.removeValue(i)}
                                          type="button"
                                       >
                                          <X className="size-3" />
                                       </button>
                                    </Badge>
                                 ))}
                              </div>
                           )}
                        </div>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe selector={(s) => s}>
               {(state) => (
                  <Button
                     disabled={!state.canSubmit || state.isSubmitting || createMutation.isPending}
                     type="submit"
                  >
                     {(state.isSubmitting || createMutation.isPending) && (
                        <Spinner className="size-4 mr-2" />
                     )}
                     Criar Subcategoria
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
