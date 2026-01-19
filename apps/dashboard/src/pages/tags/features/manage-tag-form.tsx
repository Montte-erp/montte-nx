import type { Tag } from "@packages/database/repositories/tag-repository";
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
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import Color from "color";
import { useMemo } from "react";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type ManageTagFormProps = {
   tag?: Tag;
};

export function ManageTagForm({ tag }: ManageTagFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const isEditMode = !!tag;

   const modeTexts = useMemo(() => {
      const createTexts = {
         description: "Adicione uma nova tag para organizar suas transações.",
         title: "Criar Nova Tag",
      };

      const editTexts = {
         description: "Atualize os detalhes da sua tag.",
         title: "Editar Tag",
      };

      return isEditMode ? editTexts : createTexts;
   }, [isEditMode]);

   const createTagMutation = useMutation(
      trpc.tags.create.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const updateTagMutation = useMutation(
      trpc.tags.update.mutationOptions({
         onError: (error) => {
            console.error("Failed to update tag:", error);
         },
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         color: tag?.color || "#000000",
         name: tag?.name || "",
      },
      onSubmit: async ({ value }) => {
         if (!value.name || !value.color) {
            return;
         }

         try {
            if (isEditMode && tag) {
               await updateTagMutation.mutateAsync({
                  data: {
                     color: value.color,
                     name: value.name,
                  },
                  id: tag.id,
               });
            } else {
               await createTagMutation.mutateAsync({
                  color: value.color,
                  name: value.name,
               });
            }
         } catch (error) {
            console.error(
               `Failed to ${isEditMode ? "update" : "create"} tag:`,
               error,
            );
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
         <SheetHeader>
            <SheetTitle>{modeTexts.title}</SheetTitle>
            <SheetDescription>{modeTexts.description}</SheetDescription>
         </SheetHeader>
         <div className="grid gap-4 px-4">
            <FieldGroup>
               <form.Field name="name">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Nome</FieldLabel>
                           <Input
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="Digite seu nome completo"
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

            <FieldGroup>
               <form.Field name="color">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Cor</FieldLabel>

                           <Popover>
                              <PopoverTrigger asChild>
                                 <Button
                                    aria-invalid={isInvalid || undefined}
                                    className="w-full flex gap-2 justify-start"
                                    variant="outline"
                                 >
                                    <div
                                       className="w-4 h-4 rounded border border-gray-300"
                                       style={{
                                          backgroundColor: field.state.value,
                                       }}
                                    />
                                    {field.state.value}
                                 </Button>
                              </PopoverTrigger>

                              <PopoverContent
                                 align="start"
                                 className="h-full rounded-md border bg-background "
                              >
                                 <ColorPicker
                                    className="size-full flex flex-col gap-4"
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

         <SheetFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        createTagMutation.isPending ||
                        updateTagMutation.isPending
                     }
                     type="submit"
                  >
                     {modeTexts.title}
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </form>
   );
}
