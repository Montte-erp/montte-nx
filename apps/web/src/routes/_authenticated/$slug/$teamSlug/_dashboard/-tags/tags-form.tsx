import { Button } from "@packages/ui/components/button";
import {
   ColorPicker,
   ColorPickerAlpha,
   ColorPickerEyeDropper,
   ColorPickerFormat,
   ColorPickerHue,
   ColorPickerOutput,
   ColorPickerSelection,
} from "@packages/ui/components/color-picker";
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
import { Textarea } from "@packages/ui/components/textarea";
import {
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import Color from "color";
import { toast } from "sonner";
import { orpc } from "@/integrations/orpc/client";

interface TagFormProps {
   mode: "create" | "edit";
   tag?: {
      id: string;
      name: string;
      color: string;
      description: string | null;
   };
   onSuccess: () => void;
}

export function TagForm({ mode, tag, onSuccess }: TagFormProps) {
   const isCreate = mode === "create";

   const createMutation = useMutation(
      orpc.tags.create.mutationOptions({
         onSuccess: () => {
            toast.success("Centro de custo criado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar centro de custo.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.tags.update.mutationOptions({
         onSuccess: () => {
            toast.success("Centro de custo atualizado com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar centro de custo.");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         color: tag?.color ?? "#6366f1",
         name: tag?.name ?? "",
         description: tag?.description ?? "",
      },
      onSubmit: async ({ value }) => {
         if (isCreate) {
            createMutation.mutate({
               color: value.color,
               name: value.name.trim(),
               description: value.description.trim() || null,
            });
         } else if (tag) {
            updateMutation.mutate({
               color: value.color,
               id: tag.id,
               name: value.name.trim(),
               description: value.description.trim() || null,
            });
         }
      },
   });

   return (
      <form
         className="h-full flex flex-col"
         onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
         }}
      >
         <CredenzaHeader>
            <CredenzaTitle>
               {isCreate ? "Novo Centro de Custo" : "Editar Centro de Custo"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Adicione um novo centro de custo para categorizar suas transações."
                  : "Atualize as informações do centro de custo."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody>
            <FieldGroup>
               <div className="flex items-end gap-2">
                  <form.Field
                     name="name"
                     children={(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           field.state.meta.errors.length > 0;
                        return (
                           <Field className="flex-1" data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Nome</FieldLabel>
                              <Input
                                 aria-invalid={isInvalid}
                                 id={field.name}
                                 name={field.name}
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Ex: Marketing, Recursos Humanos"
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
                     name="color"
                     children={(field) => {
                        return (
                           <Field>
                              <FieldLabel>Cor</FieldLabel>
                              <Popover>
                                 <PopoverTrigger asChild>
                                    <Button
                                       className="w-10 h-10 p-0 shrink-0"
                                       type="button"
                                       variant="outline"
                                    >
                                       <div
                                          className="w-5 h-5 rounded-full border border-border"
                                          style={{
                                             backgroundColor: field.state.value,
                                          }}
                                       />
                                    </Button>
                                 </PopoverTrigger>
                                 <PopoverContent
                                    align="end"
                                    className="rounded-md border bg-background"
                                 >
                                    <ColorPicker
                                       className="flex flex-col gap-4"
                                       onChange={(rgba) => {
                                          if (Array.isArray(rgba)) {
                                             field.handleChange(
                                                Color.rgb(
                                                   rgba[0],
                                                   rgba[1],
                                                   rgba[2],
                                                ).hex(),
                                             );
                                          }
                                       }}
                                       value={field.state.value || "#000000"}
                                    >
                                       <div className="h-24">
                                          <ColorPickerSelection />
                                       </div>
                                       <div className="flex items-center gap-4">
                                          <ColorPickerEyeDropper />
                                          <div className="grid w-full gap-2">
                                             <ColorPickerHue />
                                             <ColorPickerAlpha />
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-2">
                                          <ColorPickerOutput />
                                          <ColorPickerFormat />
                                       </div>
                                    </ColorPicker>
                                 </PopoverContent>
                              </Popover>
                           </Field>
                        );
                     }}
                  />
               </div>

               <form.Field
                  name="description"
                  children={(field) => {
                     const isInvalid =
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel htmlFor={field.name}>
                              Descrição{" "}
                              <span className="text-muted-foreground font-normal">
                                 (opcional)
                              </span>
                           </FieldLabel>
                           <Textarea
                              aria-invalid={isInvalid}
                              id={field.name}
                              maxLength={255}
                              name={field.name}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Ex: Projeto X, Cliente Y, viagem de negócios"
                              rows={2}
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
            <form.Subscribe
               selector={(state) =>
                  [state.canSubmit, state.isSubmitting] as const
               }
            >
               {([canSubmit, isSubmitting]) => (
                  <Button
                     className="w-full"
                     disabled={
                        !canSubmit ||
                        isSubmitting ||
                        createMutation.isPending ||
                        updateMutation.isPending
                     }
                     type="submit"
                  >
                     {(isSubmitting ||
                        createMutation.isPending ||
                        updateMutation.isPending) && (
                        <Spinner className="size-4" />
                     )}
                     {isCreate ? "Criar centro de custo" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
