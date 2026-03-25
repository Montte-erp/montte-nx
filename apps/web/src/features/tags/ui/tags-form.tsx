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
   Popover,
   PopoverContent,
   PopoverTrigger,
} from "@packages/ui/components/popover";
import { Spinner } from "@packages/ui/components/spinner";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import Color from "color";
import { toast } from "sonner";
import { useAccountType } from "@/hooks/use-account-type";
import { orpc } from "@/integrations/orpc/client";

interface TagFormProps {
   mode: "create" | "edit";
   tag?: {
      id: string;
      name: string;
      color: string;
   };
   onSuccess: () => void;
}

export function TagForm({ mode, tag, onSuccess }: TagFormProps) {
   const isCreate = mode === "create";
   const { isBusiness } = useAccountType();
   const entityName = isBusiness ? "centro de custo" : "tag";
   const entityNameCapitalized = isBusiness ? "Centro de custo" : "Tag";

   const createMutation = useMutation(
      orpc.tags.create.mutationOptions({
         onSuccess: () => {
            toast.success(
               `${entityNameCapitalized} ${isBusiness ? "criado" : "criada"} com sucesso.`,
            );
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || `Erro ao criar ${entityName}.`);
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.tags.update.mutationOptions({
         onSuccess: () => {
            toast.success(
               `${entityNameCapitalized} ${isBusiness ? "atualizado" : "atualizada"} com sucesso.`,
            );
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || `Erro ao atualizar ${entityName}.`);
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         color: tag?.color ?? "#6366f1",
         name: tag?.name ?? "",
      },
      onSubmit: async ({ value }) => {
         if (isCreate) {
            createMutation.mutate({
               color: value.color,
               name: value.name.trim(),
            });
         } else if (tag) {
            updateMutation.mutate({
               color: value.color,
               id: tag.id,
               name: value.name.trim(),
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
         <DialogStackContent index={0}>
            <DialogStackHeader>
               <DialogStackTitle>
                  {isCreate
                     ? isBusiness
                        ? "Novo Centro de Custo"
                        : "Nova Tag"
                     : isBusiness
                       ? "Editar Centro de Custo"
                       : "Editar Tag"}
               </DialogStackTitle>
               <DialogStackDescription>
                  {isCreate
                     ? isBusiness
                        ? "Adicione um novo centro de custo para categorizar suas transações."
                        : "Adicione uma nova tag para categorizar suas transações."
                     : isBusiness
                       ? "Atualize as informações do centro de custo."
                       : "Atualize as informações da tag."}
               </DialogStackDescription>
            </DialogStackHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4">
               <FieldGroup>
                  <form.Field name="name">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel>Nome</FieldLabel>
                              <Input
                                 onBlur={field.handleBlur}
                                 onChange={(e) =>
                                    field.handleChange(e.target.value)
                                 }
                                 placeholder="Ex: Alimentação, Transporte"
                                 value={field.state.value}
                              />
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>

                  <form.Field name="color">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel>Cor</FieldLabel>
                              <Popover>
                                 <PopoverTrigger asChild>
                                    <Button
                                       aria-invalid={isInvalid || undefined}
                                       className="w-full flex gap-2 justify-start"
                                       type="button"
                                       variant="outline"
                                    >
                                       <div
                                          className="w-4 h-4 rounded border border-border shrink-0"
                                          style={{
                                             backgroundColor: field.state.value,
                                          }}
                                       />
                                       {field.state.value}
                                    </Button>
                                 </PopoverTrigger>
                                 <PopoverContent
                                    align="start"
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
                                          <div className="grid w-full gap-1">
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
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>
            </div>

            <div className="border-t px-4 py-4">
               <form.Subscribe selector={(state) => state}>
                  {(state) => (
                     <Button
                        className="w-full"
                        disabled={
                           !state.canSubmit ||
                           state.isSubmitting ||
                           createMutation.isPending ||
                           updateMutation.isPending
                        }
                        type="submit"
                     >
                        {(state.isSubmitting ||
                           createMutation.isPending ||
                           updateMutation.isPending) && (
                           <Spinner className="size-4 mr-2" />
                        )}
                        {isCreate
                           ? isBusiness
                              ? "Criar centro de custo"
                              : "Criar tag"
                           : "Salvar alterações"}
                     </Button>
                  )}
               </form.Subscribe>
            </div>
         </DialogStackContent>
      </form>
   );
}
