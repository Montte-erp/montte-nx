"use client";

import type { RouterOutput } from "@packages/api/client";
import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import { Field, FieldError, FieldLabel } from "@packages/ui/components/field";
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
import { defineStepper } from "@packages/ui/components/stepper";
import { Textarea } from "@packages/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { CategoryMultiSelect } from "@/features/category/ui/category-multi-select";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type Goal = RouterOutput["goals"]["getAll"][0];

type ManageGoalFormProps = {
   goal?: Goal;
};

type StepId = "basic" | "filters" | "amounts";

const allSteps: Array<{ id: StepId; title: string }> = [
   { id: "basic", title: "basic" },
   { id: "filters", title: "filters" },
   { id: "amounts", title: "amounts" },
];

const { Stepper } = defineStepper(...allSteps);

function getActiveSteps(isEditing: boolean): StepId[] {
   // Same steps for both create and edit modes
   return ["basic", "filters", "amounts"];
}

const PROGRESS_CALCULATION_TYPES = [
   {
      value: "income",
      label: "Receitas",
      description: "Soma das transacoes positivas marcadas com a tag",
   },
   {
      value: "expense",
      label: "Despesas",
      description: "Soma das transacoes negativas marcadas com a tag",
   },
   {
      value: "net",
      label: "Saldo Liquido",
      description: "Diferenca entre receitas e despesas marcadas com a tag",
   },
] as const;

const goalSchema = z.object({
   name: z.string().min(1, "Nome é obrigatório"),
   description: z.string(),
   progressCalculationType: z.enum(["income", "expense", "net"]),
   targetAmount: z.number().min(0.01, "Valor alvo é obrigatório"),
   startingAmount: z.number(),
   targetDate: z.string(),
   linkedCategoryIds: z.array(z.string()),
});

export function ManageGoalForm({ goal }: ManageGoalFormProps) {
   const { closeSheet } = useSheet();
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const isEditing = !!goal;

   const activeSteps = useMemo(() => getActiveSteps(isEditing), [isEditing]);

   const modeTexts = useMemo(() => {
      const createTexts = {
         title: "Nova Meta",
         description: "Crie uma nova meta para acompanhar seu progresso financeiro",
      };
      const editTexts = {
         title: "Editar Meta",
         description: "Atualize as informacoes da meta financeira",
      };
      return isEditing ? editTexts : createTexts;
   }, [isEditing]);

   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   const createMutation = useMutation(
      trpc.goals.create.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [["goals"]] });
            queryClient.invalidateQueries({ queryKey: [["tags"]] });
            toast.success("Meta criada com sucesso");
            closeSheet();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao criar meta");
         },
      }),
   );

   const updateMutation = useMutation(
      trpc.goals.update.mutationOptions({
         onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [["goals"]] });
            toast.success("Meta atualizada com sucesso");
            closeSheet();
         },
         onError: (error) => {
            toast.error(error.message || "Erro ao atualizar meta");
         },
      }),
   );

   const form = useForm({
      defaultValues: {
         name: goal?.name ?? "",
         description: goal?.description ?? "",
         progressCalculationType: goal?.progressCalculationType ?? ("income" as const),
         targetAmount: goal ? Number(goal.targetAmount) : 0,
         startingAmount: goal ? Number(goal.startingAmount) : 0,
         targetDate: goal?.targetDate
            ? new Date(goal.targetDate).toISOString().split("T")[0]
            : "",
         linkedCategoryIds: (goal?.metadata?.linkedCategoryIds as string[]) ?? [],
      },
      validators: {
         onBlur: goalSchema,
      },
      onSubmit: async ({ value }) => {
         const metadata = {
            linkedCategoryIds:
               value.linkedCategoryIds.length > 0
                  ? value.linkedCategoryIds
                  : undefined,
         };

         if (isEditing && goal) {
            updateMutation.mutate({
               id: goal.id,
               name: value.name,
               description: value.description || null,
               progressCalculationType: value.progressCalculationType,
               targetAmount: value.targetAmount,
               targetDate: value.targetDate || null,
               metadata,
            });
         } else {
            createMutation.mutate({
               name: value.name,
               description: value.description || undefined,
               newTag: {
                  name: `[Meta] ${value.name}`,
                  color: "#3b82f6", // Default blue
               },
               progressCalculationType: value.progressCalculationType,
               targetAmount: value.targetAmount,
               startingAmount: value.startingAmount,
               targetDate: value.targetDate || undefined,
               metadata,
            });
         }
      },
   });

   const isPending = createMutation.isPending || updateMutation.isPending;

   function BasicInfoStep() {
      return (
         <div className="space-y-4">
            <form.Field name="name">
               {(field) => (
                  <Field>
                     <FieldLabel>Nome da meta</FieldLabel>
                     <Input
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Ex: Reserva de emergencia"
                        value={field.state.value}
                     />
                     <FieldError errors={field.state.meta.errors} />
                  </Field>
               )}
            </form.Field>

            <form.Field name="description">
               {(field) => (
                  <Field>
                     <FieldLabel>Descricao (opcional)</FieldLabel>
                     <Textarea
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        placeholder="Descreva o objetivo desta meta..."
                        value={field.state.value}
                     />
                  </Field>
               )}
            </form.Field>

         </div>
      );
   }

   function FiltersStep() {
      return (
         <div className="space-y-4">
            {/* Show tag badge when editing */}
            {isEditing && goal?.tag && (
               <div className="rounded-lg border p-4 mb-4">
                  <div className="flex items-center gap-3">
                     <div className="flex-1">
                        <div className="font-medium text-sm">Tag Vinculada</div>
                        <div className="flex items-center gap-2 mt-1">
                           <Badge
                              style={{ backgroundColor: goal.tag.color, color: "#fff" }}
                           >
                              {goal.tag.name}
                           </Badge>
                           <span className="text-xs text-muted-foreground">
                              (nao pode ser alterada)
                           </span>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            <form.Field name="linkedCategoryIds">
               {(field) => (
                  <Field>
                     <FieldLabel>Filtrar por categorias (opcional)</FieldLabel>
                     <p className="text-sm text-muted-foreground mb-2">
                        Selecione categorias para filtrar quais transacoes com a
                        tag serao contabilizadas. Deixe vazio para considerar
                        todas.
                     </p>
                     <CategoryMultiSelect
                        categories={categories}
                        onChange={(selected) => field.handleChange(selected)}
                        placeholder="Selecione categorias..."
                        selected={field.state.value}
                     />
                     {field.state.value.length === 0 && (
                        <p className="text-xs text-muted-foreground p-2 bg-muted/50 rounded mt-2">
                           Todas as transacoes marcadas com a tag serao
                           contabilizadas
                        </p>
                     )}
                  </Field>
               )}
            </form.Field>
         </div>
      );
   }

   function AmountsStep() {
      return (
         <div className="space-y-4">
            <form.Field name="progressCalculationType">
               {(field) => (
                  <Field>
                     <FieldLabel>Tipo de calculo do progresso</FieldLabel>
                     <Select
                        onValueChange={(value) =>
                           field.handleChange(
                              value as "income" | "expense" | "net",
                           )
                        }
                        value={field.state.value}
                     >
                        <SelectTrigger>
                           <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                           {PROGRESS_CALCULATION_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                 <div className="flex flex-col">
                                    <span>{type.label}</span>
                                 </div>
                              </SelectItem>
                           ))}
                        </SelectContent>
                     </Select>
                     <p className="text-xs text-muted-foreground mt-1">
                        {
                           PROGRESS_CALCULATION_TYPES.find(
                              (t) => t.value === field.state.value,
                           )?.description
                        }
                     </p>
                     <FieldError errors={field.state.meta.errors} />
                  </Field>
               )}
            </form.Field>

            <div className="grid grid-cols-2 gap-4">
               <form.Field name="targetAmount">
                  {(field) => (
                     <Field>
                        <FieldLabel>Valor alvo</FieldLabel>
                        <MoneyInput
                           onBlur={field.handleBlur}
                           onChange={(value) => field.handleChange(value ?? 0)}
                           placeholder="0,00"
                           value={field.state.value}
                           valueInCents={false}
                        />
                        <FieldError errors={field.state.meta.errors} />
                     </Field>
                  )}
               </form.Field>

               {!isEditing && (
                  <form.Field name="startingAmount">
                     {(field) => (
                        <Field>
                           <FieldLabel>Valor inicial</FieldLabel>
                           <MoneyInput
                              onBlur={field.handleBlur}
                              onChange={(value) => field.handleChange(value ?? 0)}
                              placeholder="0,00"
                              value={field.state.value}
                              valueInCents={false}
                           />
                        </Field>
                     )}
                  </form.Field>
               )}
            </div>

            <form.Field name="targetDate">
               {(field) => (
                  <Field>
                     <FieldLabel>Data limite (opcional)</FieldLabel>
                     <Input
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="date"
                        value={field.state.value}
                     />
                  </Field>
               )}
            </form.Field>
         </div>
      );
   }

   return (
      <Stepper.Provider className="h-full" initialStep={activeSteps[0]}>
         {({ methods }) => {
            const currentId = methods.current.id;

            const goToNextStep = () => {
               if (currentId === undefined) return;
               const currentIndex = activeSteps.indexOf(currentId as StepId);
               const nextIndex = currentIndex + 1;
               const nextStep = activeSteps[nextIndex];
               if (nextStep !== undefined) {
                  methods.goTo(nextStep);
               }
            };

            const goToPrevStep = () => {
               if (currentId === undefined) return;
               const currentIndex = activeSteps.indexOf(currentId as StepId);
               const prevIndex = currentIndex - 1;
               const prevStep = activeSteps[prevIndex];
               if (prevStep !== undefined) {
                  methods.goTo(prevStep);
               }
            };

            const isFirstStep = currentId === activeSteps[0];
            const isLastStep = currentId === activeSteps[activeSteps.length - 1];

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

                  <div className="px-4 py-2">
                     <Stepper.Navigation>
                        {allSteps
                           .filter((step) => activeSteps.includes(step.id))
                           .map((step) => (
                              <Stepper.Step key={step.id} of={step.id} />
                           ))}
                     </Stepper.Navigation>
                  </div>

                  <div className="px-4 flex-1 overflow-y-auto">
                     {methods.switch({
                        basic: () => <BasicInfoStep />,
                        filters: () => <FiltersStep />,
                        amounts: () => <AmountsStep />,
                     })}
                  </div>

                  <SheetFooter className="px-4">
                     <Stepper.Controls className="flex flex-col w-full gap-2">
                        {methods.current.id === "basic" ? (
                           <form.Subscribe
                              selector={(state) => ({
                                 nameValid: state.values.name.trim().length > 0,
                              })}
                           >
                              {({ nameValid }) => (
                                 <Button
                                    className="w-full"
                                    disabled={!nameValid}
                                    onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       goToNextStep();
                                    }}
                                    type="button"
                                 >
                                    Proximo
                                 </Button>
                              )}
                           </form.Subscribe>
                        ) : methods.current.id === "filters" ? (
                           <>
                              <Button
                                 className="w-full"
                                 onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    goToPrevStep();
                                 }}
                                 type="button"
                                 variant="ghost"
                              >
                                 Anterior
                              </Button>
                              <Button
                                 className="w-full"
                                 onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    goToNextStep();
                                 }}
                                 type="button"
                              >
                                 Proximo
                              </Button>
                           </>
                        ) : isLastStep ? (
                           <form.Subscribe
                              selector={(state) => ({
                                 canSubmit: state.canSubmit,
                                 isSubmitting: state.isSubmitting,
                                 targetAmount: state.values.targetAmount,
                              })}
                           >
                              {({ canSubmit, isSubmitting, targetAmount }) => (
                                 <>
                                    <Button
                                       className="w-full"
                                       onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          goToPrevStep();
                                       }}
                                       type="button"
                                       variant="ghost"
                                    >
                                       Anterior
                                    </Button>
                                    <Button
                                       className="w-full"
                                       disabled={
                                          !canSubmit ||
                                          isSubmitting ||
                                          isPending ||
                                          targetAmount <= 0
                                       }
                                       type="submit"
                                    >
                                       {isPending
                                          ? "Salvando..."
                                          : isEditing
                                            ? "Salvar alteracoes"
                                            : "Criar meta"}
                                    </Button>
                                 </>
                              )}
                           </form.Subscribe>
                        ) : (
                           <>
                              {!isFirstStep && (
                                 <Button
                                    className="w-full"
                                    onClick={(e) => {
                                       e.preventDefault();
                                       e.stopPropagation();
                                       goToPrevStep();
                                    }}
                                    type="button"
                                    variant="ghost"
                                 >
                                    Anterior
                                 </Button>
                              )}
                              <Button
                                 className="w-full"
                                 onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    goToNextStep();
                                 }}
                                 type="button"
                              >
                                 Proximo
                              </Button>
                           </>
                        )}
                     </Stepper.Controls>
                  </SheetFooter>
               </form>
            );
         }}
      </Stepper.Provider>
   );
}
