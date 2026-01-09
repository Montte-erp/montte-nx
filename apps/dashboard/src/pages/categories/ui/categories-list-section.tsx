import { Button } from "@packages/ui/components/button";
import { Card, CardContent } from "@packages/ui/components/card";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import { ItemGroup, ItemSeparator } from "@packages/ui/components/item";
import {
   SelectionActionBar,
   SelectionActionButton,
} from "@packages/ui/components/selection-action-bar";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   ToggleGroup,
   ToggleGroupItem,
} from "@packages/ui/components/toggle-group";
import { useIsMobile } from "@packages/ui/hooks/use-mobile";
import { keepPreviousData, useSuspenseQuery } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import {
   ArrowDownAZ,
   ArrowUpAZ,
   Filter,
   Inbox,
   Search,
   Trash2,
   X,
} from "lucide-react";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useTRPC } from "@/integrations/clients";
import { CategoryFilterCredenza } from "../features/category-filter-credenza";
import { useCategoryList } from "../features/category-list-context";
import { useCategoryBulkActions } from "../features/use-category-bulk-actions";
import {
   CategoryExpandedContent,
   CategoryMobileCard,
   createCategoryColumns,
} from "./categories-table-columns";

function CategoriesListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription:
                  "Falha ao carregar categorias. Tente novamente mais tarde.",
               errorTitle: "Erro ao carregar categorias",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function CategoriesListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-9 w-full sm:max-w-md" />
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`category-skeleton-${index + 1}`}>
                     <div className="flex items-center p-4 gap-4">
                        <Skeleton className="size-10 rounded-full" />
                        <div className="space-y-2 flex-1">
                           <Skeleton className="h-4 w-32" />
                           <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-4 w-20" />
                     </div>
                     {index !== 4 && <ItemSeparator />}
                  </Fragment>
               ))}
            </ItemGroup>
            <div className="flex items-center justify-end gap-2 pt-4">
               <Skeleton className="h-10 w-24" />
               <Skeleton className="h-10 w-10" />
               <Skeleton className="h-10 w-24" />
            </div>
         </CardContent>
      </Card>
   );
}

function CategoriesListContent() {
   const trpc = useTRPC();
   const {
      orderBy,
      orderDirection,
      currentPage,
      setCurrentPage,
      pageSize,
      setPageSize,
      typeFilter,
   } = useCategoryList();

   const { activeOrganization } = useActiveOrganization();
   const { openAlertDialog } = useAlertDialog();
   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const handlePageSizeChange = (newSize: number) => {
      setPageSize(newSize);
      setCurrentPage(1);
   };

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm, setCurrentPage]);

   const { data: paginatedData } = useSuspenseQuery(
      trpc.categories.getAllPaginated.queryOptions(
         {
            limit: pageSize,
            orderBy,
            orderDirection,
            page: currentPage,
            search: debouncedSearchTerm || undefined,
         },
         {
            placeholderData: keepPreviousData,
         },
      ),
   );

   const { data: breakdownData } = useSuspenseQuery(
      trpc.categories.getBreakdown.queryOptions(),
   );

   const categoryStatsMap = useMemo(() => {
      const map: Record<string, { income: number; expenses: number }> = {};
      for (const item of breakdownData) {
         map[item.categoryId] = {
            expenses: item.expenses,
            income: item.income,
         };
      }
      return map;
   }, [breakdownData]);

   const { categories, pagination } = paginatedData;
   const { totalPages, totalCount } = pagination;

   // Filter categories by transaction type if a type filter is selected
   const filteredCategories = useMemo(() => {
      if (!typeFilter) return categories;
      return categories.filter((category) => {
         const types = category.transactionTypes || [
            "income",
            "expense",
            "transfer",
         ];
         return types.includes(typeFilter as "income" | "expense" | "transfer");
      });
   }, [categories, typeFilter]);

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const { deleteSelected, isLoading } = useCategoryBulkActions({
      onSuccess: () => {
         setRowSelection({});
      },
   });

   const handleClearSelection = () => {
      setRowSelection({});
   };

   return (
      <>
         <Card>
            <CardContent className="pt-6 grid gap-4">
               <InputGroup className="flex-1 sm:max-w-md">
                  <InputGroupInput
                     onChange={(e) => {
                        setSearchTerm(e.target.value);
                     }}
                     placeholder="Digite para pesquisar"
                     value={searchTerm}
                  />
                  <InputGroupAddon>
                     <Search />
                  </InputGroupAddon>
               </InputGroup>

               {filteredCategories.length === 0 &&
               pagination.totalCount === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Inbox className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhuma categoria ainda</EmptyTitle>
                        <EmptyDescription>
                           Crie sua primeira categoria usando a barra de ações rápidas acima para começar a organizar suas transações.
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createCategoryColumns(activeOrganization.slug)}
                     data={filteredCategories}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     pagination={{
                        currentPage,
                        onPageChange: setCurrentPage,
                        onPageSizeChange: handlePageSizeChange,
                        pageSize,
                        totalCount: typeFilter
                           ? filteredCategories.length
                           : totalCount,
                        totalPages: typeFilter
                           ? Math.ceil(filteredCategories.length / pageSize)
                           : totalPages,
                     }}
                     renderMobileCard={(props) => {
                        const stats = categoryStatsMap[
                           props.row.original.id
                        ] ?? {
                           expenses: 0,
                           income: 0,
                        };
                        return (
                           <CategoryMobileCard
                              {...props}
                              expenses={stats.expenses}
                              income={stats.income}
                           />
                        );
                     }}
                     renderSubComponent={(props) => {
                        const stats = categoryStatsMap[
                           props.row.original.id
                        ] ?? {
                           expenses: 0,
                           income: 0,
                        };
                        return (
                           <CategoryExpandedContent
                              {...props}
                              expenses={stats.expenses}
                              income={stats.income}
                           />
                        );
                     }}
                     rowSelection={rowSelection}
                  />
               )}
            </CardContent>
         </Card>

         <SelectionActionBar
            onClear={handleClearSelection}
            selectedCount={selectedIds.length}
         >
            <SelectionActionButton
               disabled={isLoading}
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     description: `Esta ação não pode ser desfeita. Isso excluirá permanentemente ${selectedIds.length} ${selectedIds.length === 1 ? "categoria" : "categorias"} e removerá a associação de todas as transações vinculadas.`,
                     onAction: () => deleteSelected(selectedIds),
                     title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "categoria" : "categorias"}?`,
                     variant: "destructive",
                  })
               }
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

export function CategoriesListSection() {
   return (
      <ErrorBoundary FallbackComponent={CategoriesListErrorFallback}>
         <Suspense fallback={<CategoriesListSkeleton />}>
            <CategoriesListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
