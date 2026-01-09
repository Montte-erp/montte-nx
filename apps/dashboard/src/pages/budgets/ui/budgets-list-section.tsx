import { formatDecimalCurrency } from "@packages/money";
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
   Check,
   CheckCircle,
   CircleDashed,
   Filter,
   Inbox,
   Search,
   Trash2,
   X,
} from "lucide-react";
import { Fragment, Suspense, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useTRPC } from "@/integrations/clients";
import { BudgetFilterCredenza } from "../features/budget-filter-credenza";
import { useBudgetList } from "../features/budget-list-context";
import { useBudgetBulkActions } from "../features/use-budget-bulk-actions";
import {
   BudgetExpandedContent,
   BudgetMobileCard,
   createBudgetColumns,
} from "./budgets-table-columns";

function BudgetsListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription: "Não foi possível carregar os orçamentos. Tente novamente.",
               errorTitle: "Erro ao carregar orçamentos",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function BudgetsListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
               <Skeleton className="h-9 w-full sm:max-w-md" />
               <Skeleton className="h-9 w-9" />
            </div>
            <div className="flex gap-2">
               <Skeleton className="h-8 w-20" />
               <Skeleton className="h-8 w-20" />
               <Skeleton className="h-8 w-24" />
               <Skeleton className="h-8 w-24" />
            </div>
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`budget-skeleton-${index + 1}`}>
                     <div className="flex items-center p-4 gap-4">
                        <Skeleton className="size-10 rounded-lg" />
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

function BudgetsListContent() {
   const isMobile = useIsMobile();
   const { periodType } = useBudgetList();
   const trpc = useTRPC();
   const { openCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const [currentPage, setCurrentPage] = useState(1);
   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
   const [statusFilter, setStatusFilter] = useState<string>("");
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
   const [pageSize, setPageSize] = useState(10);
   const [orderBy, setOrderBy] = useState<
      "name" | "amount" | "createdAt" | "updatedAt"
   >("name");
   const [orderDirection, setOrderDirection] = useState<"asc" | "desc">("asc");

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);

   // biome-ignore lint/correctness/useExhaustiveDependencies: Reset page when filters change
   useEffect(() => {
      setCurrentPage(1);
   }, [statusFilter, periodType, pageSize]);

   const { data: paginatedData } = useSuspenseQuery(
      trpc.budgets.getAllPaginated.queryOptions(
         {
            isActive:
               statusFilter === "active"
                  ? true
                  : statusFilter === "inactive"
                    ? false
                    : undefined,
            limit: pageSize,
            orderBy,
            orderDirection,
            page: currentPage,
            periodType: periodType || undefined,
            search: debouncedSearchTerm || undefined,
         },
         {
            placeholderData: keepPreviousData,
         },
      ),
   );

   const { budgets, pagination } = paginatedData;
   const { totalPages, totalCount } = pagination;

   const hasActiveFilters = debouncedSearchTerm || statusFilter;

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );
   const selectedBudgets = budgets.filter((budget) =>
      selectedIds.includes(budget.id),
   );
   const selectedTotal = selectedBudgets.reduce(
      (sum, budget) => sum + parseFloat(budget.amount),
      0,
   );

   const { markAsActive, markAsInactive, deleteSelected, isLoading } =
      useBudgetBulkActions({
         onSuccess: () => setRowSelection({}),
      });

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const handleClearFilters = () => {
      setStatusFilter("");
      setSearchTerm("");
   };

   return (
      <>
         <Card>
            <CardContent className="pt-6 grid gap-4">
               <div className="flex gap-6">
                  <InputGroup className="flex-1 sm:max-w-md">
                     <InputGroupInput
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Digite para pesquisar"
                        value={searchTerm}
                     />
                     <InputGroupAddon>
                        <Search />
                     </InputGroupAddon>
                  </InputGroup>

                  {isMobile && (
                     <Button
                        onClick={() =>
                           openCredenza({
                              children: (
                                 <BudgetFilterCredenza
                                    activeFilter={
                                       statusFilter === "active"
                                          ? true
                                          : statusFilter === "inactive"
                                            ? false
                                            : undefined
                                    }
                                    onActiveFilterChange={(value) => {
                                       if (value === true)
                                          setStatusFilter("active");
                                       else if (value === false)
                                          setStatusFilter("inactive");
                                       else setStatusFilter("");
                                    }}
                                    onOrderByChange={setOrderBy}
                                    onOrderDirectionChange={setOrderDirection}
                                    onPageSizeChange={setPageSize}
                                    orderBy={orderBy}
                                    orderDirection={orderDirection}
                                    pageSize={pageSize}
                                 />
                              ),
                           })
                        }
                        size="icon"
                        variant="outline"
                     >
                        <Filter className="size-4" />
                     </Button>
                  )}
               </div>

               {!isMobile && (
                  <div className="flex flex-wrap items-center gap-3">
                     <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                           Status:
                        </span>
                        <ToggleGroup
                           onValueChange={setStatusFilter}
                           size="sm"
                           spacing={2}
                           type="single"
                           value={statusFilter}
                           variant="outline"
                        >
                           <ToggleGroupItem
                              className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-emerald-500 data-[state=on]:text-emerald-600"
                              value="active"
                           >
                              <CheckCircle className="size-3.5" />
                              Ativo
                           </ToggleGroupItem>
                           <ToggleGroupItem
                              className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-muted-foreground data-[state=on]:text-muted-foreground"
                              value="inactive"
                           >
                              <CircleDashed className="size-3.5" />
                              Inativo
                           </ToggleGroupItem>
                        </ToggleGroup>
                     </div>

                     {hasActiveFilters && (
                        <>
                           <div className="h-4 w-px bg-border" />
                           <Button
                              className="h-8 text-xs"
                              onClick={handleClearFilters}
                              size="sm"
                              variant="outline"
                           >
                              <X className="size-3" />
                              Limpar filtros
                           </Button>
                        </>
                     )}
                  </div>
               )}

               {budgets.length === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Inbox className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyTitle>
                           Nenhum orçamento encontrado
                        </EmptyTitle>
                        <EmptyDescription>
                           Crie seu primeiro orçamento para começar a controlar
                           seus gastos
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createBudgetColumns()}
                     data={budgets}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     pagination={{
                        currentPage,
                        onPageChange: setCurrentPage,
                        onPageSizeChange: setPageSize,
                        pageSize,
                        totalCount,
                        totalPages,
                     }}
                     renderMobileCard={(props) => (
                        <BudgetMobileCard {...props} />
                     )}
                     renderSubComponent={(props) => (
                        <BudgetExpandedContent {...props} />
                     )}
                     rowSelection={rowSelection}
                  />
               )}
            </CardContent>
         </Card>

         <SelectionActionBar
            onClear={handleClearSelection}
            selectedCount={selectedIds.length}
            summary={formatDecimalCurrency(selectedTotal)}
         >
            <SelectionActionButton
               disabled={isLoading}
               icon={<Check className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Confirmar",
                     description:
                        "Os orçamentos selecionados serão ativados e passarão a ser considerados no controle de gastos.",
                     onAction: async () => {
                        await markAsActive(selectedIds);
                     },
                     title: `Ativar ${selectedIds.length} orçamentos`,
                  })
               }
            >
               Ativar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={isLoading}
               icon={<X className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Confirmar",
                     description:
                        "Os orçamentos selecionados serão desativados e não serão mais considerados no controle de gastos.",
                     onAction: async () => {
                        await markAsInactive(selectedIds);
                     },
                     title: `Desativar ${selectedIds.length} orçamentos`,
                  })
               }
            >
               Desativar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={isLoading}
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir",
                     description:
                        "Os orçamentos selecionados serão excluídos permanentemente. Esta ação não pode ser desfeita.",
                     onAction: async () => {
                        await deleteSelected(selectedIds);
                     },
                     title: `Excluir ${selectedIds.length} orçamentos`,
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

export function BudgetsListSection() {
   return (
      <ErrorBoundary FallbackComponent={BudgetsListErrorFallback}>
         <Suspense fallback={<BudgetsListSkeleton />}>
            <BudgetsListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
