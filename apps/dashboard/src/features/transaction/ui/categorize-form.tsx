import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Field,
   FieldDescription,
   FieldError,
   FieldGroup,
   FieldLabel,
} from "@packages/ui/components/field";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import { getRandomColor } from "@packages/utils/colors";
import {
   type CategorySplit,
   recalculateSplitsForNewCategories,
} from "@packages/utils/split";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

type TransactionType = "income" | "expense" | "transfer";

import { CategoryMultiSelect } from "@/features/category/ui/category-multi-select";
import { CostCenterCombobox } from "@/features/cost-center/ui/cost-center-combobox";
import { TagMultiSelect } from "@/features/tag/ui/tag-multi-select";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import type { Transaction } from "./transaction-list";

type CategorizeFormProps = {
   transactions: Transaction[];
   onSuccess?: () => void;
};

export function CategorizeForm({
   transactions,
   onSuccess,
}: CategorizeFormProps) {
   const trpc = useTRPC();
   const queryClient = useQueryClient();
   const { closeSheet } = useSheet();

   // For single transaction, pre-populate with existing values
   const singleTransaction = transactions.length === 1 ? transactions[0] : null;
   const existingCategoryIds = singleTransaction
      ? singleTransaction.transactionCategories?.map((tc) => tc.category.id) ||
        []
      : [];
   const existingCostCenterId = singleTransaction
      ? singleTransaction.costCenterId || ""
      : "";
   const existingTagIds = singleTransaction
      ? singleTransaction.transactionTags?.map((tt) => tt.tag.id) || []
      : [];

   // Get existing splits for single transaction
   const existingSplits = singleTransaction?.categorySplits as
      | CategorySplit[]
      | null;
   const totalAmountInCents = singleTransaction
      ? Math.abs(Number.parseFloat(singleTransaction.amount)) * 100
      : 0;

   // Get unique transaction types from selected transactions
   const selectedTransactionTypes = useMemo(() => {
      const types = new Set<TransactionType>();
      for (const t of transactions) {
         types.add(t.type as TransactionType);
      }
      return Array.from(types);
   }, [transactions]);

   const categorizeSchema = z.object({
      categoryIds: z.array(z.string()),
      costCenterId: z.string(),
      tagIds: z.array(z.string()),
   });

   const { data: allCategories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   // Filter categories to show only those matching ANY of the selected transaction types
   const categories = useMemo(() => {
      return allCategories.filter((cat) => {
         // If category has no transactionTypes set, show it for all types (backward compatibility)
         if (!cat.transactionTypes || cat.transactionTypes.length === 0) {
            return true;
         }
         // Show category if it matches ANY of the selected transaction types
         return selectedTransactionTypes.some((type) =>
            cat.transactionTypes?.includes(type),
         );
      });
   }, [allCategories, selectedTransactionTypes]);

   const { data: costCenters = [] } = useQuery(
      trpc.costCenters.getAll.queryOptions(),
   );

   const { data: tags = [] } = useQuery(trpc.tags.getAll.queryOptions());

   const updateCategoryMutation = useMutation(
      trpc.transactions.updateCategory.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao atualizar categoria");
         },
      }),
   );

   const updateCostCenterMutation = useMutation(
      trpc.transactions.updateCostCenter.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao atualizar centro de custo");
         },
      }),
   );

   const updateTagsMutation = useMutation(
      trpc.transactions.updateTags.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao atualizar tags");
         },
      }),
   );

   // Use transactions.update for single transactions to preserve splits
   const updateTransactionMutation = useMutation(
      trpc.transactions.update.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao atualizar transação");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: trpc.transactions.getById.queryKey({
                  id: singleTransaction?.id ?? "",
               }),
            });
            queryClient.invalidateQueries({
               queryKey: trpc.transactions.getAllPaginated.queryKey(),
            });
         },
      }),
   );

   const handleCategorize = useCallback(
      async (value: z.infer<typeof categorizeSchema>) => {
         const transactionIds = transactions.map((t) => t.id);

         try {
            // For single transaction, use transactions.update to preserve splits
            if (singleTransaction && value.categoryIds.length > 0) {
               // Calculate new splits based on selected categories
               const newSplits = recalculateSplitsForNewCategories(
                  existingSplits,
                  value.categoryIds,
                  totalAmountInCents,
               );

               // Build the update data
               const updateData: Record<string, unknown> = {
                  categoryIds: value.categoryIds,
                  categorySplits: newSplits,
               };

               // Include cost center if changed
               if (value.costCenterId !== existingCostCenterId) {
                  updateData.costCenterId = value.costCenterId || null;
               }

               // Include tags if changed
               if (
                  JSON.stringify(value.tagIds.sort()) !==
                  JSON.stringify(existingTagIds.sort())
               ) {
                  updateData.tagIds = value.tagIds;
               }

               await updateTransactionMutation.mutateAsync({
                  data: updateData,
                  id: singleTransaction.id,
               });

               const updatedFields = ["categoria"];
               if (value.costCenterId !== existingCostCenterId)
                  updatedFields.push("centro de custo");
               if (
                  JSON.stringify(value.tagIds.sort()) !==
                  JSON.stringify(existingTagIds.sort())
               )
                  updatedFields.push("tags");

               toast.success(
                  `${updatedFields.join(", ")} atualizado${updatedFields.length > 1 ? "s" : ""} com sucesso`,
               );
               onSuccess?.();
               closeSheet();
               return;
            }

            // For bulk transactions, use individual mutations (can't preserve splits in bulk)
            const promises = [];

            if (value.categoryIds && value.categoryIds.length > 0) {
               promises.push(
                  updateCategoryMutation.mutateAsync({
                     categoryId: value.categoryIds[0] as string,
                     ids: transactionIds,
                  }),
               );
            }

            if (value.costCenterId || value.costCenterId === "") {
               promises.push(
                  updateCostCenterMutation.mutateAsync({
                     costCenterId: value.costCenterId || null,
                     ids: transactionIds,
                  }),
               );
            }

            if (value.tagIds.length > 0) {
               promises.push(
                  updateTagsMutation.mutateAsync({
                     ids: transactionIds,
                     tagIds: value.tagIds,
                  }),
               );
            }

            await Promise.all(promises);
            const updatedFields = [];
            if (value.categoryIds.length > 0) updatedFields.push("categoria");
            if (value.costCenterId || value.costCenterId === "")
               updatedFields.push("centro de custo");
            if (value.tagIds.length > 0) updatedFields.push("tags");

            toast.success(
               `${updatedFields.join(", ")} atualizado${updatedFields.length > 1 ? "s" : ""} para ${transactions.length} transações`,
            );
            onSuccess?.();
            closeSheet();
         } catch (error) {
            console.error(error);
            // Errors are handled by individual mutations
         }
      },
      [
         transactions,
         singleTransaction,
         existingSplits,
         totalAmountInCents,
         existingCostCenterId,
         existingTagIds,
         updateTransactionMutation,
         updateCategoryMutation,
         updateCostCenterMutation,
         updateTagsMutation,
         onSuccess,
         closeSheet,
      ],
   );

   const form = useForm({
      defaultValues: {
         categoryIds: existingCategoryIds,
         costCenterId: existingCostCenterId,
         tagIds: existingTagIds,
      },
      onSubmit: async ({ value }) => {
         await handleCategorize(value);
      },
      validators: {
         onBlur: categorizeSchema,
      },
   });

   const createCategoryMutation = useMutation(
      trpc.categories.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao criar categoria");
         },
         onSuccess: (data) => {
            if (!data) return;
            form.setFieldValue("categoryIds", [
               ...form.getFieldValue("categoryIds"),
               data.id,
            ]);
            toast.success(`Categoria "${data.name}" criada`);
         },
      }),
   );

   const createCostCenterMutation = useMutation(
      trpc.costCenters.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao criar centro de custo");
         },
         onSuccess: (data) => {
            if (!data) return;
            form.setFieldValue("costCenterId", data.id);
            toast.success(`Centro de custo "${data.name}" criado`);
         },
      }),
   );

   const createTagMutation = useMutation(
      trpc.tags.create.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao criar tag");
         },
         onSuccess: (data) => {
            if (!data) return;
            form.setFieldValue("tagIds", [
               ...form.getFieldValue("tagIds"),
               data.id,
            ]);
            toast.success(`Tag "${data.name}" criada`);
         },
      }),
   );

   const isLoading =
      updateCategoryMutation.isPending ||
      updateCostCenterMutation.isPending ||
      updateTagsMutation.isPending ||
      updateTransactionMutation.isPending;

   const isCreating =
      createCategoryMutation.isPending ||
      createCostCenterMutation.isPending ||
      createTagMutation.isPending;

   const handleCreateCategory = useCallback(
      (name: string) => {
         createCategoryMutation.mutate({
            color: getRandomColor(),
            name,
            transactionTypes: selectedTransactionTypes,
         });
      },
      [createCategoryMutation.mutate, selectedTransactionTypes],
   );

   const handleCreateCostCenter = useCallback(
      (name: string) => {
         createCostCenterMutation.mutate({
            name,
         });
      },
      [createCostCenterMutation.mutate],
   );

   const handleCreateTag = useCallback(
      (name: string) => {
         createTagMutation.mutate({
            color: getRandomColor(),
            name,
         });
      },
      [createTagMutation.mutate],
   );

   const transactionCount = transactions.length;
   const transactionLabel =
      transactionCount === 1 ? "1 transação" : `${transactionCount} transações`;

   const handleSubmit = useCallback(
      (e: FormEvent) => {
         e.preventDefault();
         e.stopPropagation();
         form.handleSubmit();
      },
      [form],
   );

   return (
      <form className="h-full flex flex-col" onSubmit={handleSubmit}>
         <SheetHeader>
            <SheetTitle>Categorizar Transações</SheetTitle>
            <SheetDescription>
               Associe categoria, centro de custo ou tags para{" "}
               {transactionLabel}.
            </SheetDescription>
         </SheetHeader>
         <div className="px-4 flex-1 overflow-y-auto">
            <div className="space-y-4 py-4">
               <FieldGroup>
                  <form.Field name="categoryIds">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 Categoria
                              </FieldLabel>
                              <CategoryMultiSelect
                                 categories={categories}
                                 className="flex-1"
                                 onChange={(val) => field.handleChange(val)}
                                 onCreate={handleCreateCategory}
                                 placeholder="Selecione uma categoria"
                                 selected={field.state.value || []}
                              />
                              <FieldDescription>
                                 Agrupe suas transações por tipo de gasto ou
                                 receita para análises detalhadas
                              </FieldDescription>
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="costCenterId">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>
                                 Centro de Custo
                              </FieldLabel>
                              <CostCenterCombobox
                                 className="w-full justify-between"
                                 costCenters={costCenters}
                                 disabled={isCreating}
                                 onCreate={handleCreateCostCenter}
                                 onValueChange={(value) =>
                                    field.handleChange(value || "")
                                 }
                                 value={field.state.value}
                              />
                              <FieldDescription>
                                 Associe a departamentos, projetos ou áreas para
                                 controle orçamentário
                              </FieldDescription>
                              {isInvalid && (
                                 <FieldError errors={field.state.meta.errors} />
                              )}
                           </Field>
                        );
                     }}
                  </form.Field>
               </FieldGroup>

               <FieldGroup>
                  <form.Field name="tagIds">
                     {(field) => {
                        const isInvalid =
                           field.state.meta.isTouched &&
                           !field.state.meta.isValid;
                        return (
                           <Field data-invalid={isInvalid}>
                              <FieldLabel htmlFor={field.name}>Tags</FieldLabel>
                              {(field.state.value || []).length > 0 && (
                                 <div className="flex flex-wrap gap-1.5 mb-2">
                                    {(field.state.value || []).map((tagId) => {
                                       const tag = tags.find(
                                          (t) => t.id === tagId,
                                       );
                                       if (!tag) return null;
                                       return (
                                          <Badge
                                             key={tag.id}
                                             style={{
                                                backgroundColor: tag.color,
                                             }}
                                             variant="secondary"
                                          >
                                             {tag.name}
                                             <button
                                                className="ml-1 rounded-full hover:bg-black/20"
                                                onClick={() =>
                                                   field.handleChange(
                                                      (
                                                         field.state.value || []
                                                      ).filter(
                                                         (id) => id !== tag.id,
                                                      ),
                                                   )
                                                }
                                                type="button"
                                             >
                                                <X className="size-3" />
                                             </button>
                                          </Badge>
                                       );
                                    })}
                                 </div>
                              )}
                              <TagMultiSelect
                                 className="flex-1"
                                 onChange={(val) => field.handleChange(val)}
                                 onCreate={handleCreateTag}
                                 placeholder="Selecione as tags"
                                 selected={field.state.value || []}
                                 tags={tags}
                              />
                              <FieldDescription>
                                 Adicione marcadores personalizados para filtrar
                                 e organizar suas transações
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
         </div>
         <form.Subscribe
            selector={(state) => ({
               isSubmitting: state.isSubmitting,
            })}
         >
            {({ isSubmitting }) => (
               <SheetFooter className="px-4">
                  <Button
                     className="w-full"
                     disabled={isSubmitting || isLoading || isCreating}
                     type="submit"
                  >
                     {isLoading ? "Salvando..." : "Aplicar Alterações"}
                  </Button>
               </SheetFooter>
            )}
         </form.Subscribe>
      </form>
   );
}
