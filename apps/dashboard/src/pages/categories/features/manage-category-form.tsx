import type { Category } from "@packages/database/repositories/category-repository";
import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { IconPicker } from "@packages/ui/components/icon-picker";
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
import { useMemo } from "react";
import { ColorPicker } from "@/components/color-picker";
import { TransactionTypesSelector } from "@/components/transaction-types-selector";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type TransactionType = "income" | "expense" | "transfer";

type ManageCategoryFormProps = {
   category?: Category;
};

export function ManageCategoryForm({ category }: ManageCategoryFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const isEditMode = !!category;

   const modeTexts = useMemo(() => {
      const createTexts = {
         description: "Adicione uma nova categoria para organizar suas transações.",
         title: "Criar Nova Categoria",
      };

      const editTexts = {
         description: "Atualize os detalhes da sua categoria.",
         title: "Editar Categoria",
      };

      return isEditMode ? editTexts : createTexts;
   }, [isEditMode]);

   const createCategoryMutation = useMutation(
      trpc.categories.create.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const updateCategoryMutation = useMutation(
      trpc.categories.update.mutationOptions({
         onError: (error) => {
            console.error("Failed to update category:", error);
         },
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         color: category?.color || "#000000",
         icon: category?.icon as IconName | undefined,
         name: category?.name || "",
         transactionTypes:
            (category?.transactionTypes as TransactionType[]) || [
               "income",
               "expense",
               "transfer",
            ],
      },
      onSubmit: async ({ value }) => {
         if (!value.name || !value.color) {
            return;
         }

         try {
            if (isEditMode && category) {
               await updateCategoryMutation.mutateAsync({
                  data: {
                     color: value.color,
                     icon: value.icon,
                     name: value.name,
                     transactionTypes: value.transactionTypes,
                  },
                  id: category.id,
               });
            } else {
               await createCategoryMutation.mutateAsync({
                  color: value.color,
                  icon: value.icon,
                  name: value.name,
                  transactionTypes: value.transactionTypes,
               });
            }
         } catch (error) {
            console.error(
               `Failed to ${isEditMode ? "update" : "create"} category:`,
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

            <FieldGroup>
               <form.Field name="icon">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Ícone</FieldLabel>
                           <IconPicker
                              onChange={field.handleChange}
                              value={field.state.value ?? undefined}
                           />
                           <FieldDescription>Opcional</FieldDescription>
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="transactionTypes">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Tipos de Transação</FieldLabel>
                           <TransactionTypesSelector
                              onChange={field.handleChange}
                              value={field.state.value || []}
                           />
                           <FieldDescription>
                              Selecione os tipos de transação permitidos para esta categoria.
                           </FieldDescription>
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
                        createCategoryMutation.isPending ||
                        updateCategoryMutation.isPending
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
