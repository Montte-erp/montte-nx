import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import { Input } from "@packages/ui/components/input";
import { MoneyInput } from "@packages/ui/components/money-input";
import { MultiSelect } from "@packages/ui/components/multi-select";
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
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import type { Budget } from "../ui/budgets-page";

type ManageBudgetFormProps = {
   budget?: Budget;
};

type BudgetTarget =
   | { type: "category"; categoryId: string }
   | { type: "categories"; categoryIds: string[] }
   | { type: "tag"; tagId: string }
   | { type: "cost_center"; costCenterId: string };

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

   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const { data: tags = [] } = useQuery(trpc.tags.getAll.queryOptions());

   const { data: costCenters = [] } = useQuery(
      trpc.costCenters.getAll.queryOptions(),
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

   const getInitialTargetType = (): string => {
      if (budget?.target) {
         return (budget.target as BudgetTarget).type;
      }
      return "category";
   };

   const form = useForm({
      defaultValues: {
         amount: budget?.amount ? Number(budget.amount) : 0,
         categoryId:
            budget?.target &&
            (budget.target as BudgetTarget).type === "category"
               ? (budget.target as { categoryId: string }).categoryId
               : "",
         categoryIds:
            budget?.target &&
            (budget.target as BudgetTarget).type === "categories"
               ? (budget.target as { categoryIds: string[] }).categoryIds
               : [],
         costCenterId:
            budget?.target &&
            (budget.target as BudgetTarget).type === "cost_center"
               ? (budget.target as { costCenterId: string }).costCenterId
               : "",
         name: budget?.name || "",
         periodType: (budget?.periodType || "monthly") as
            | "daily"
            | "weekly"
            | "monthly"
            | "quarterly"
            | "yearly"
            | "custom",
         tagId:
            budget?.target && (budget.target as BudgetTarget).type === "tag"
               ? (budget.target as { tagId: string }).tagId
               : "",
         targetType: getInitialTargetType(),
      },
      onSubmit: async ({ value }) => {
         if (value.targetType === "category" && !value.categoryId) {
            return;
         }
         if (
            value.targetType === "categories" &&
            value.categoryIds.length === 0
         ) {
            return;
         }
         if (value.targetType === "tag" && !value.tagId) {
            return;
         }
         if (value.targetType === "cost_center" && !value.costCenterId) {
            return;
         }

         let target: BudgetTarget;

         switch (value.targetType) {
            case "category":
               target = { categoryId: value.categoryId, type: "category" };
               break;
            case "categories":
               target = { categoryIds: value.categoryIds, type: "categories" };
               break;
            case "tag":
               target = { tagId: value.tagId, type: "tag" };
               break;
            case "cost_center":
               target = {
                  costCenterId: value.costCenterId,
                  type: "cost_center",
               };
               break;
            default:
               target = { categoryId: value.categoryId, type: "category" };
         }

         const budgetData = {
            amount: String(value.amount),
            name: value.name,
            periodType: value.periodType,
            target,
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

   const targetTypeOptions = [
      {
         label: "Categoria única",
         value: "category",
      },
      {
         label: "Múltiplas categorias",
         value: "categories",
      },
      {
         label: "Tag",
         value: "tag",
      },
      {
         label: "Centro de custo",
         value: "cost_center",
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
                           <FieldLabel>
                              Nome
                           </FieldLabel>
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
                           <FieldLabel>
                              Valor limite
                           </FieldLabel>
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
                        <FieldLabel>
                           Período
                        </FieldLabel>
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
               <form.Field name="targetType">
                  {(field) => (
                     <Field>
                        <FieldLabel>
                           Alvo do orçamento
                        </FieldLabel>
                        <Select
                           onValueChange={(value) => field.handleChange(value)}
                           value={field.state.value}
                        >
                           <SelectTrigger className="w-full">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                              {targetTypeOptions.map((option) => (
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

            <form.Subscribe selector={(state) => state.values.targetType}>
               {(targetType) => (
                  <>
                     {targetType === "category" && (
                        <FieldGroup>
                           <form.Field name="categoryId">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>
                                       Categoria
                                    </FieldLabel>
                                    <Select
                                       onValueChange={(value) =>
                                          field.handleChange(value)
                                       }
                                       value={field.state.value}
                                    >
                                       <SelectTrigger className="w-full">
                                          <SelectValue
                                             placeholder="Selecione uma categoria"
                                          />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {categories.map((cat) => (
                                             <SelectItem
                                                key={cat.id}
                                                value={cat.id}
                                             >
                                                {cat.name}
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 </Field>
                              )}
                           </form.Field>
                        </FieldGroup>
                     )}

                     {targetType === "categories" && (
                        <FieldGroup>
                           <form.Field name="categoryIds">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>
                                       Categoria
                                    </FieldLabel>
                                    <MultiSelect
                                       onChange={(selected) =>
                                          field.handleChange(selected)
                                       }
                                       options={categories.map((cat) => ({
                                          label: cat.name,
                                          value: cat.id,
                                       }))}
                                       placeholder="Selecione uma categoria"
                                       selected={field.state.value}
                                    />
                                 </Field>
                              )}
                           </form.Field>
                        </FieldGroup>
                     )}

                     {targetType === "tag" && (
                        <FieldGroup>
                           <form.Field name="tagId">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>
                                       Tags
                                    </FieldLabel>
                                    <Select
                                       onValueChange={(value) =>
                                          field.handleChange(value)
                                       }
                                       value={field.state.value}
                                    >
                                       <SelectTrigger className="w-full">
                                          <SelectValue
                                             placeholder="Selecione as tags"
                                          />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {tags.map((tag) => (
                                             <SelectItem
                                                key={tag.id}
                                                value={tag.id}
                                             >
                                                {tag.name}
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 </Field>
                              )}
                           </form.Field>
                        </FieldGroup>
                     )}

                     {targetType === "cost_center" && (
                        <FieldGroup>
                           <form.Field name="costCenterId">
                              {(field) => (
                                 <Field>
                                    <FieldLabel>
                                       Centro de Custo
                                    </FieldLabel>
                                    <Select
                                       onValueChange={(value) =>
                                          field.handleChange(value)
                                       }
                                       value={field.state.value}
                                    >
                                       <SelectTrigger className="w-full">
                                          <SelectValue
                                             placeholder="Selecione um centro de custo"
                                          />
                                       </SelectTrigger>
                                       <SelectContent>
                                          {costCenters.map((cc) => (
                                             <SelectItem
                                                key={cc.id}
                                                value={cc.id}
                                             >
                                                {cc.name}
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 </Field>
                              )}
                           </form.Field>
                        </FieldGroup>
                     )}
                  </>
               )}
            </form.Subscribe>
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
                     {isEditMode
                        ? "Editar orçamento"
                        : "Novo orçamento"}
                  </Button>
               )}
            </form.Subscribe>
         </SheetFooter>
      </form>
   );
}
