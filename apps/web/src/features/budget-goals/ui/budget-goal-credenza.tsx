import type { BudgetGoalWithProgress } from "@packages/database/repositories/budget-goals-repository";
import { Button } from "@packages/ui/components/button";
import {
   Combobox,
   type ComboboxOption,
} from "@packages/ui/components/combobox";
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
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { Switch } from "@packages/ui/components/switch";
import { useForm } from "@tanstack/react-form";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
   Baby,
   BookOpen,
   Briefcase,
   Car,
   Coffee,
   CreditCard,
   Dumbbell,
   Fuel,
   Gift,
   Heart,
   Home,
   type LucideIcon,
   Music,
   Package,
   Plane,
   ShoppingCart,
   Smartphone,
   Utensils,
   Wallet,
   Zap,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { orpc } from "@/integrations/orpc/client";

const CATEGORY_ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
   { name: "wallet", label: "Carteira", Icon: Wallet },
   { name: "credit-card", label: "Cartão de crédito", Icon: CreditCard },
   { name: "home", label: "Casa", Icon: Home },
   { name: "car", label: "Carro", Icon: Car },
   { name: "shopping-cart", label: "Compras", Icon: ShoppingCart },
   { name: "utensils", label: "Alimentação", Icon: Utensils },
   { name: "plane", label: "Viagem", Icon: Plane },
   { name: "heart", label: "Saúde", Icon: Heart },
   { name: "book-open", label: "Educação", Icon: BookOpen },
   { name: "briefcase", label: "Trabalho", Icon: Briefcase },
   { name: "package", label: "Pacote", Icon: Package },
   { name: "music", label: "Música", Icon: Music },
   { name: "coffee", label: "Café", Icon: Coffee },
   { name: "smartphone", label: "Celular", Icon: Smartphone },
   { name: "dumbbell", label: "Academia", Icon: Dumbbell },
   { name: "baby", label: "Bebê", Icon: Baby },
   { name: "gift", label: "Presente", Icon: Gift },
   { name: "zap", label: "Energia", Icon: Zap },
   { name: "fuel", label: "Combustível", Icon: Fuel },
];

const ICON_MAP = new Map(CATEGORY_ICONS.map(({ name, Icon }) => [name, Icon]));

const schema = z
   .object({
      targetType: z.enum(["category", "subcategory"]),
      categoryId: z.string(),
      subcategoryId: z.string(),
      limitAmount: z.string(),
      alertEnabled: z.boolean(),
      alertThreshold: z.number(),
   })
   .superRefine((data, ctx) => {
      if (!data.categoryId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione uma categoria",
            path: ["categoryId"],
         });
      }
      if (data.targetType === "subcategory" && !data.subcategoryId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Selecione uma subcategoria",
            path: ["subcategoryId"],
         });
      }
      if (!data.limitAmount || Number(data.limitAmount) <= 0) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Limite deve ser maior que zero",
            path: ["limitAmount"],
         });
      }
      if (
         data.alertEnabled &&
         (data.alertThreshold < 1 || data.alertThreshold > 100)
      ) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Percentual deve ser entre 1 e 100",
            path: ["alertThreshold"],
         });
      }
   });

interface BudgetGoalCredenzaProps {
   mode: "create" | "edit";
   goal?: BudgetGoalWithProgress;
   month: number;
   year: number;
   onSuccess: () => void;
}

export function BudgetGoalCredenza({
   mode,
   goal,
   month,
   year,
   onSuccess,
}: BudgetGoalCredenzaProps) {
   const isCreate = mode === "create";

   const { data: categories } = useSuspenseQuery(
      orpc.categories.getAll.queryOptions({}),
   );

   const expenseCategories = categories.filter(
      (c) => c.type === "expense" || c.type === null,
   );

   const createMutation = useMutation(
      orpc.budgetGoals.create.mutationOptions({
         onSuccess: () => {
            toast.success("Meta criada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar meta.");
         },
      }),
   );

   const updateMutation = useMutation(
      orpc.budgetGoals.update.mutationOptions({
         onSuccess: () => {
            toast.success("Meta atualizada com sucesso.");
            onSuccess();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar meta.");
         },
      }),
   );

   const inferredTargetType = goal?.subcategoryId ? "subcategory" : "category";

   const form = useForm({
      defaultValues: {
         targetType: isCreate
            ? ("category" as "category" | "subcategory")
            : inferredTargetType,
         categoryId: goal?.categoryId ?? "",
         subcategoryId: goal?.subcategoryId ?? "",
         limitAmount: goal?.limitAmount ? String(goal.limitAmount) : "",
         alertEnabled: goal?.alertThreshold != null,
         alertThreshold: goal?.alertThreshold ?? 80,
      },
      validators: {
         onBlur: schema,
      },
      onSubmit: async ({ value }) => {
         if (isCreate) {
            createMutation.mutate({
               categoryId:
                  value.targetType === "category"
                     ? value.categoryId || undefined
                     : undefined,
               subcategoryId:
                  value.targetType === "subcategory"
                     ? value.subcategoryId || undefined
                     : undefined,
               month,
               year,
               limitAmount: value.limitAmount,
               alertThreshold: value.alertEnabled
                  ? value.alertThreshold
                  : undefined,
            });
         } else if (goal) {
            updateMutation.mutate({
               id: goal.id,
               limitAmount: value.limitAmount,
               alertThreshold: value.alertEnabled ? value.alertThreshold : null,
            });
         }
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
            <CredenzaTitle>
               {isCreate ? "Nova Meta" : "Editar Meta"}
            </CredenzaTitle>
            <CredenzaDescription>
               {isCreate
                  ? "Defina um limite de gastos para uma categoria ou subcategoria."
                  : "Atualize o limite e as configurações de alerta desta meta."}
            </CredenzaDescription>
         </CredenzaHeader>

         <CredenzaBody className="space-y-4">
            <FieldGroup>
               {isCreate && (
                  <form.Field name="targetType">
                     {(field) => (
                        <Field>
                           <FieldLabel>Tipo</FieldLabel>
                           <Select
                              onValueChange={(v) =>
                                 field.handleChange(
                                    v as "category" | "subcategory",
                                 )
                              }
                              value={field.state.value}
                           >
                              <SelectTrigger>
                                 <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="category">
                                    Categoria
                                 </SelectItem>
                                 <SelectItem value="subcategory">
                                    Subcategoria
                                 </SelectItem>
                              </SelectContent>
                           </Select>
                        </Field>
                     )}
                  </form.Field>
               )}

               <form.Subscribe selector={(s) => s.values.targetType}>
                  {(targetType) => (
                     <>
                        <form.Field name="categoryId">
                           {(field) => {
                              const isInvalid =
                                 field.state.meta.isTouched &&
                                 !field.state.meta.isValid;

                              const categoryOptions: ComboboxOption[] =
                                 expenseCategories.map((c) => ({
                                    value: c.id,
                                    label: c.name,
                                 }));

                              return (
                                 <Field data-invalid={isInvalid}>
                                    <FieldLabel>Categoria</FieldLabel>
                                    <Combobox
                                       className="w-full justify-between"
                                       disabled={!isCreate}
                                       emptyMessage="Nenhuma categoria encontrada."
                                       onBlur={field.handleBlur}
                                       onValueChange={(v) => {
                                          field.handleChange(v);
                                          form.setFieldValue(
                                             "subcategoryId",
                                             "",
                                          );
                                       }}
                                       options={categoryOptions}
                                       placeholder="Selecione uma categoria"
                                       renderOption={(option) => {
                                          const cat = expenseCategories.find(
                                             (c) => c.id === option.value,
                                          );
                                          const Icon = cat?.icon
                                             ? ICON_MAP.get(cat.icon)
                                             : undefined;
                                          return (
                                             <span className="flex items-center gap-2">
                                                {Icon && (
                                                   <Icon className="size-4" />
                                                )}
                                                {option.label}
                                             </span>
                                          );
                                       }}
                                       searchPlaceholder="Buscar categoria..."
                                       value={field.state.value}
                                    />
                                    {isInvalid && (
                                       <FieldError
                                          errors={field.state.meta.errors}
                                       />
                                    )}
                                 </Field>
                              );
                           }}
                        </form.Field>

                        {targetType === "subcategory" && (
                           <form.Subscribe
                              selector={(s) => s.values.categoryId}
                           >
                              {(categoryId) => {
                                 const selectedCategory =
                                    expenseCategories.find(
                                       (c) => c.id === categoryId,
                                    );
                                 const subcategoryOptions: ComboboxOption[] =
                                    selectedCategory?.subcategories.map(
                                       (s) => ({
                                          value: s.id,
                                          label: s.name,
                                       }),
                                    ) ?? [];

                                 return (
                                    <form.Field name="subcategoryId">
                                       {(field) => {
                                          const isInvalid =
                                             field.state.meta.isTouched &&
                                             !field.state.meta.isValid;
                                          return (
                                             <Field data-invalid={isInvalid}>
                                                <FieldLabel>
                                                   Subcategoria
                                                </FieldLabel>
                                                <Combobox
                                                   className="w-full justify-between"
                                                   disabled={
                                                      !categoryId || !isCreate
                                                   }
                                                   emptyMessage="Nenhuma subcategoria encontrada."
                                                   onBlur={field.handleBlur}
                                                   onValueChange={
                                                      field.handleChange
                                                   }
                                                   options={subcategoryOptions}
                                                   placeholder="Selecione uma subcategoria"
                                                   searchPlaceholder="Buscar subcategoria..."
                                                   value={field.state.value}
                                                />
                                                {isInvalid && (
                                                   <FieldError
                                                      errors={
                                                         field.state.meta.errors
                                                      }
                                                   />
                                                )}
                                             </Field>
                                          );
                                       }}
                                    </form.Field>
                                 );
                              }}
                           </form.Subscribe>
                        )}
                     </>
                  )}
               </form.Subscribe>

               <form.Field name="limitAmount">
                  {(field) => {
                     const isInvalid =
                        field.state.meta.isTouched && !field.state.meta.isValid;
                     return (
                        <Field data-invalid={isInvalid}>
                           <FieldLabel>Limite (R$)</FieldLabel>
                           <Input
                              min="0.01"
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                 field.handleChange(e.target.value)
                              }
                              placeholder="0,00"
                              step="0.01"
                              type="number"
                              value={field.state.value}
                           />
                           {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                           )}
                        </Field>
                     );
                  }}
               </form.Field>

               <form.Field name="alertEnabled">
                  {(alertEnabledField) => (
                     <Field>
                        <div className="flex items-center justify-between gap-2">
                           <FieldLabel className="mb-0">
                              Ativar alerta
                           </FieldLabel>
                           <Switch
                              checked={alertEnabledField.state.value}
                              onCheckedChange={alertEnabledField.handleChange}
                           />
                        </div>

                        {alertEnabledField.state.value && (
                           <form.Field name="alertThreshold">
                              {(field) => {
                                 const isInvalid =
                                    field.state.meta.isTouched &&
                                    !field.state.meta.isValid;
                                 return (
                                    <div className="mt-3">
                                       <FieldLabel>
                                          Alertar quando atingir{" "}
                                          {field.state.value}% do limite
                                       </FieldLabel>
                                       <Input
                                          className="mt-1.5"
                                          max="100"
                                          min="1"
                                          onBlur={field.handleBlur}
                                          onChange={(e) =>
                                             field.handleChange(
                                                Number(e.target.value),
                                             )
                                          }
                                          type="number"
                                          value={field.state.value}
                                       />
                                       {isInvalid && (
                                          <FieldError
                                             errors={field.state.meta.errors}
                                          />
                                       )}
                                    </div>
                                 );
                              }}
                           </form.Field>
                        )}
                     </Field>
                  )}
               </form.Field>
            </FieldGroup>
         </CredenzaBody>

         <CredenzaFooter>
            <form.Subscribe>
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
                     {isCreate ? "Criar meta" : "Salvar alterações"}
                  </Button>
               )}
            </form.Subscribe>
         </CredenzaFooter>
      </form>
   );
}
