import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CategoryMultiSelect } from "@/features/category/ui/category-multi-select";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import type { Budget } from "../ui/budgets-page";

type ManageBudgetFormProps = {
   budget?: Budget;
};

export function ManageBudgetForm({ budget }: ManageBudgetFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const isEditMode = !!budget;

   const modeTexts = useMemo(() => {
      const createTexts = {
         description: "Crie um novo orçamento para controlar seus gastos",
         title: "Novo orçamento",
      };

      const editTexts = {
         description: `Editando o orçamento ${budget?.name || ""}`,
         title: "Editar orçamento",
      };

      return isEditMode ? editTexts : createTexts;
   }, [isEditMode, budget?.name]);

   const { data: tags = [] } = useQuery(trpc.tags.getAll.queryOptions());
   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const createBudgetMutation = useMutation(
      trpc.budgets.create.mutationOptions({
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const updateBudgetMutation = useMutation(
      trpc.budgets.update.mutationOptions({
         onError: (error) => {
            console.error("Failed to update budget:", error);
         },
         onSuccess: () => {
            closeSheet();
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         amount: budget?.amount ? Number(budget.amount) : 0,
         linkedCategoryIds:
            (budget?.metadata as { linkedCategoryIds?: string[] })
               ?.linkedCategoryIds ?? [],
         name: budget?.name || "",
         periodType: (budget?.periodType || "monthly") as
            | "daily"
            | "weekly"
            | "monthly"
            | "quarterly"
            | "yearly"
            | "custom",
         tagId: budget?.tagId || "",
      },
      onSubmit: async ({ value }) => {
         const budgetData = {
            amount: String(value.amount),
            metadata: {
               linkedCategoryIds:
                  value.linkedCategoryIds.length > 0
                     ? value.linkedCategoryIds
                     : undefined,
            },
            name: value.name,
            periodType: value.periodType,
            ...(isEditMode && value.tagId ? { tagId: value.tagId } : {}),
         };

         try {
            if (isEditMode && budget) {
               await updateBudgetMutation.mutateAsync({
                  data: budgetData,
                  id: budget.id,
               });
            } else {
               await createBudgetMutation.mutateAsync(budgetData);
            }
         } catch (error) {
            console.error(
               `Failed to ${isEditMode ? "update" : "create"} budget:`,
               error,
            );
         }
      },
   });

   const periodOptions = [
      {
         label: "Diário",
         value: "daily",
      },
      {
         label: "Semanal",
         value: "weekly",
      },
      {
         label: "Mensal",
         value: "monthly",
      },
      {
         label: "Trimestral",
         value: "quarterly",
      },
      {
         label: "Anual",
         value: "yearly",
      },
   ];

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
         <div className="grid gap-4 px-4 pb-4">
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
                              placeholder="Ex: Alimentação, Lazer, Marketing..."
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
               <form.Field name="amount">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Valor limite</FieldLabel>
                           <MoneyInput
                              onBlur={field.handleBlur}
                              onChange={(value) =>
                                 field.handleChange(value ?? 0)
                              }
                              placeholder="0,00"
                              value={field.state.value}
                              valueInCents={false}
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
               <form.Field name="periodType">
                  {(field) => (
                     <Field>
                        <FieldLabel>Período</FieldLabel>
                        <Select
                           onValueChange={(value) =>
                              field.handleChange(
                                 value as
                                    | "daily"
                                    | "weekly"
                                    | "monthly"
                                    | "quarterly"
                                    | "yearly"
                                    | "custom",
                              )
                           }
                           value={field.state.value}
                        >
                           <SelectTrigger className="w-full">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              {periodOptions.map((option) => (
                                 <SelectItem
                                    key={option.value}
                                    value={option.value}
                                 >
                                    {option.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            <FieldGroup>
               <form.Field name="linkedCategoryIds">
                  {(field) => (
                     <Field>
                        <FieldLabel>
                           Filtrar por categorias (opcional)
                        </FieldLabel>
                        <CategoryMultiSelect
                           categories={categories}
                           onChange={(selected) => field.handleChange(selected)}
                           placeholder="Selecione categorias..."
                           selected={field.state.value}
                        />
                        <FieldDescription>
                           Quando selecionadas, apenas transações com essas
                           categorias serão contabilizadas
                        </FieldDescription>
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>

            {isEditMode ? (
               <FieldGroup>
                  <form.Field name="tagId">
                     {(field) => (
                        <Field>
                           <FieldLabel>Tag de agrupamento</FieldLabel>
                           <Select
                              onValueChange={(value) =>
                                 field.handleChange(value)
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger className="w-full">
                                 <SelectValue placeholder="Selecione uma tag" />
                              </SelectTrigger>
                              <SelectContent>
                                 {tags.map((tag) => (
                                    <SelectItem key={tag.id} value={tag.id}>
                                       <div className="flex items-center gap-2">
                                          <div
                                             className="size-3 rounded-full"
                                             style={{
                                                backgroundColor: tag.color,
                                             }}
                                          />
                                          {tag.name}
                                       </div>
                                    </SelectItem>
                                 ))}
                              </SelectContent>
                           </Select>
                           <FieldDescription>
                              Selecione a tag que agrupa as transações deste
                              orçamento
                           </FieldDescription>
                        </Field>
                     )}
                  </form.Field>
               </FieldGroup>
            ) : null}
         </div>

         <SheetFooter>
            <form.Subscribe>
               {(state) => (
                  <Button
                     className="w-full"
                     disabled={
                        !state.canSubmit ||
                        state.isSubmitting ||
                        createBudgetMutation.isPending ||
                        updateBudgetMutation.isPending
                     }
                     type="submit"
                  >
                     {isEditMode ? "Editar orçamento" : "Novo orçamento"}
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </form>
   );
}
