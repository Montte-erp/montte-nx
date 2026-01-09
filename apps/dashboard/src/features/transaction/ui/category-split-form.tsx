import { formatCurrency, formatDecimalCurrency } from "@packages/money";
import { Button } from "@packages/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@packages/ui/components/field";
import { MoneyInput } from "@packages/ui/components/money-input";
import { MultiSelect } from "@packages/ui/components/multi-select";
import {
   SheetDescription,
   SheetFooter,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import {
   type CategorySplit,
   getRemainingAmount,
   isSplitSumValid,
} from "@packages/utils/split";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type TransactionType = "income" | "expense" | "transfer";

import type { IconName } from "@/features/icon-selector/lib/available-icons";
import { IconDisplay } from "@/features/icon-selector/ui/icon-display";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";
import type { Transaction } from "./transaction-list";

type CategorySplitFormProps = {
   transaction: Transaction | null;
   onSuccess?: () => void;
};

export function CategorySplitForm({
   transaction,
   onSuccess,
}: CategorySplitFormProps) {
   const trpc = useTRPC();
   const { closeSheet } = useSheet();
   const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
   const [splits, setSplits] = useState<CategorySplit[]>([]);

   const transactionType = (transaction?.type || "expense") as TransactionType;

   const { data: allCategories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );

   // Filter categories to show only those matching the transaction type
   const categories = useMemo(() => {
      return allCategories.filter((cat) => {
         // If category has no transactionTypes set, show it for all types (backward compatibility)
         if (!cat.transactionTypes || cat.transactionTypes.length === 0) {
            return true;
         }
         return cat.transactionTypes.includes(transactionType);
      });
   }, [allCategories, transactionType]);

   const updateTransactionMutation = useMutation(
      trpc.transactions.update.mutationOptions({
         onError: (error) => {
            toast.error(error.message || "Falha ao dividir categorias");
         },
         onSuccess: () => {
            toast.success("Divisao de categorias salva com sucesso");
            onSuccess?.();
            closeSheet();
         },
      }),
   );

   const totalAmount = transaction
      ? Math.round(Math.abs(Number(transaction.amount)) * 100)
      : 0;

   useEffect(() => {
      if (transaction) {
         const existingCategoryIds =
            transaction.transactionCategories?.map((tc) => tc.category.id) ||
            [];
         const existingSplits =
            (transaction.categorySplits as CategorySplit[]) || [];

         setSelectedCategoryIds(existingCategoryIds);
         setSplits(existingSplits);
      }
   }, [transaction]);

   const handleCategoryChange = (newCategoryIds: string[]) => {
      setSelectedCategoryIds(newCategoryIds);

      const newSplits = newCategoryIds.map((categoryId) => {
         const existing = splits.find((s) => s.categoryId === categoryId);
         if (existing) return existing;
         return { categoryId, splitType: "amount" as const, value: 0 };
      });
      setSplits(newSplits);
   };

   const handleValueChange = (categoryId: string, newValue: number) => {
      const value = Math.max(0, newValue);
      const updatedSplits = splits.map((s) => {
         if (s.categoryId !== categoryId) return s;
         return { ...s, value };
      });
      setSplits(updatedSplits);
   };

   const handleConfirm = () => {
      if (!transaction || selectedCategoryIds.length === 0) return;

      const hasSplits = splits.some((s) => s.value > 0);

      updateTransactionMutation.mutate({
         data: {
            categoryIds: selectedCategoryIds,
            categorySplits: hasSplits ? splits : null,
         },
         id: transaction.id,
      });
   };

   const selectedCategories = categories.filter((c) =>
      selectedCategoryIds.includes(c.id),
   );

   const isValid =
      splits.length === 0 ||
      splits.every((s) => s.value === 0) ||
      isSplitSumValid(splits, totalAmount);

   const remainingAmount =
      splits.length > 0 ? getRemainingAmount(splits, totalAmount) : totalAmount;

   const categoryOptions = categories.map((category) => ({
      icon: (
         <div
            className="flex size-4 items-center justify-center rounded"
            style={{ backgroundColor: category.color }}
         >
            <IconDisplay iconName={category.icon as IconName} size={10} />
         </div>
      ),
      label: category.name,
      value: category.id,
   }));

   return (
      <>
         <SheetHeader>
            <SheetTitle>Dividir por Categorias</SheetTitle>
            <SheetDescription>
               Divida o valor de{" "}
               {transaction
                  ? formatDecimalCurrency(Math.abs(Number(transaction.amount)))
                  : "R$ 0,00"}{" "}
               entre multiplas categorias.
            </SheetDescription>
         </SheetHeader>
         <div className="grid gap-4 px-4 py-4">
            <FieldGroup>
               <Field>
                  <FieldLabel>
                     Categoria
                  </FieldLabel>
                  <MultiSelect
                     emptyMessage="Nenhum resultado encontrado"
                     onChange={handleCategoryChange}
                     options={categoryOptions}
                     placeholder="Selecione uma categoria"
                     selected={selectedCategoryIds}
                  />
               </Field>
            </FieldGroup>

            {selectedCategories.length > 1 && (
               <div className="space-y-3 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium">
                        Valores por categoria
                     </span>
                     <span
                        className={`text-sm ${
                           !isValid
                              ? "text-destructive font-medium"
                              : splits.some((s) => s.value > 0)
                                ? "text-green-600 font-medium"
                                : "text-muted-foreground"
                        }`}
                     >
                        {splits.every((s) => s.value === 0)
                           ? "Defina os valores"
                           : isValid
                             ? "Valores conferem"
                             : remainingAmount > 0
                               ? `Falta: ${formatCurrency(remainingAmount)}`
                               : `Excede: ${formatCurrency(Math.abs(remainingAmount))}`}
                     </span>
                  </div>

                  {selectedCategories.map((category) => {
                     const split = splits.find(
                        (s) => s.categoryId === category.id,
                     );
                     const value = split?.value || 0;

                     return (
                        <div
                           className="flex items-center gap-2"
                           key={category.id}
                        >
                           <div className="flex min-w-[140px] items-center gap-2">
                              <div
                                 className="flex size-6 items-center justify-center rounded"
                                 style={{ backgroundColor: category.color }}
                              >
                                 <IconDisplay
                                    iconName={category.icon as IconName | null}
                                    size={14}
                                 />
                              </div>
                              <span className="truncate text-sm">
                                 {category.name}
                              </span>
                           </div>

                           <MoneyInput
                              className="flex-1"
                              onChange={(v) =>
                                 handleValueChange(category.id, v || 0)
                              }
                              placeholder="0,00"
                              value={value}
                              valueInCents
                           />
                        </div>
                     );
                  })}
               </div>
            )}
         </div>
         <SheetFooter className="px-4">
            <Button
               className="w-full"
               disabled={
                  selectedCategoryIds.length === 0 ||
                  (selectedCategoryIds.length > 1 &&
                     splits.some((s) => s.value > 0) &&
                     !isValid) ||
                  updateTransactionMutation.isPending
               }
               onClick={handleConfirm}
            >
               {updateTransactionMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
         </SheetFooter>
      </>
   );
}
