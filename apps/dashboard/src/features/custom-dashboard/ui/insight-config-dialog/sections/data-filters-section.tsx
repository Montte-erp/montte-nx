import type { InsightConfig } from "@packages/database/schemas/dashboards";
import { FieldLabel } from "@packages/ui/components/field";
import { MultiSelect } from "@packages/ui/components/multi-select";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, CreditCard, Layers, Tag } from "lucide-react";
import { useMemo } from "react";
import { trpc } from "@/integrations/clients";

type TransactionType = "income" | "expense" | "transfer" | "all";

type DataFiltersSectionProps = {
   dataSource: InsightConfig["dataSource"];
   typeFilter: TransactionType;
   selectedCategories: string[];
   selectedTags: string[];
   selectedBankAccount: string;
   onTypeFilterChange: (type: TransactionType) => void;
   onCategoriesChange: (categories: string[]) => void;
   onTagsChange: (tags: string[]) => void;
   onBankAccountChange: (bankAccountId: string) => void;
};

export function DataFiltersSection({
   dataSource,
   typeFilter,
   selectedCategories,
   selectedTags,
   selectedBankAccount,
   onTypeFilterChange,
   onCategoriesChange,
   onTagsChange,
   onBankAccountChange,
}: DataFiltersSectionProps) {
   // Fetch data for filters
   const { data: categories = [] } = useQuery(
      trpc.categories.getAll.queryOptions(),
   );
   const { data: tags = [] } = useQuery(trpc.tags.getAll.queryOptions());
   const { data: bankAccounts = [] } = useQuery(
      trpc.bankAccounts.getAll.queryOptions(),
   );

   // Convert to MultiSelect options
   const categoryOptions = useMemo(
      () => categories.map((c) => ({ label: c.name, value: c.id })),
      [categories],
   );
   const tagOptions = useMemo(
      () => tags.map((t) => ({ label: t.name, value: t.id })),
      [tags],
   );

   // Check which data filters are relevant for the data source
   const showTypeFilter = dataSource === "transactions";
   const showCategoryFilter =
      dataSource === "transactions" || dataSource === "budgets";
   const showTagFilter =
      dataSource === "transactions" || dataSource === "bills";
   const showBankAccountFilter = dataSource === "transactions";

   const hasAnyFilter =
      showTypeFilter ||
      showCategoryFilter ||
      showTagFilter ||
      showBankAccountFilter;

   if (!hasAnyFilter) {
      return (
         <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
               <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
               Nenhum filtro de dados disponivel para esta fonte de dados.
            </p>
         </div>
      );
   }

   return (
      <div className="space-y-6">
         {/* Transaction Type Filter */}
         {showTypeFilter && (
            <section className="space-y-3">
               <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <FieldLabel className="text-sm font-medium m-0">
                     Tipo de Transacao
                  </FieldLabel>
               </div>
               <Select
                  onValueChange={(value) =>
                     onTypeFilterChange(value as TransactionType)
                  }
                  value={typeFilter}
               >
                  <SelectTrigger className="w-full h-11">
                     <SelectValue placeholder="Selecione um tipo" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem className="py-2.5" value="all">
                        Todos
                     </SelectItem>
                     <SelectItem className="py-2.5" value="income">
                        Receita
                     </SelectItem>
                     <SelectItem className="py-2.5" value="expense">
                        Despesa
                     </SelectItem>
                  </SelectContent>
               </Select>
            </section>
         )}

         {/* Category Filter */}
         {showCategoryFilter && (
            <section className="space-y-3">
               <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <FieldLabel className="text-sm font-medium m-0">
                     Categorias
                  </FieldLabel>
               </div>
               <MultiSelect
                  onChange={onCategoriesChange}
                  options={categoryOptions}
                  placeholder="Selecione categorias..."
                  selected={selectedCategories}
               />
            </section>
         )}

         {/* Tag Filter */}
         {showTagFilter && (
            <section className="space-y-3">
               <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <FieldLabel className="text-sm font-medium m-0">
                     Tags
                  </FieldLabel>
               </div>
               <MultiSelect
                  onChange={onTagsChange}
                  options={tagOptions}
                  placeholder="Selecione tags..."
                  selected={selectedTags}
               />
            </section>
         )}

         {/* Bank Account Filter */}
         {showBankAccountFilter && bankAccounts.length > 0 && (
            <section className="space-y-3">
               <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <FieldLabel className="text-sm font-medium m-0">
                     Conta Bancaria
                  </FieldLabel>
               </div>
               <Select
                  onValueChange={onBankAccountChange}
                  value={selectedBankAccount}
               >
                  <SelectTrigger className="w-full h-11">
                     <SelectValue placeholder="Selecione uma conta" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem className="py-2.5" value="all">
                        Todas as contas
                     </SelectItem>
                     {bankAccounts.map((account) => (
                        <SelectItem
                           className="py-2.5"
                           key={account.id}
                           value={account.id}
                        >
                           {account.name || account.bank}
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
            </section>
         )}
      </div>
   );
}
