import type { BillWithRelations } from "@packages/database/repositories/bill-repository";
import { translate } from "@packages/localization";
import { formatDecimalCurrency } from "@packages/money";
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
import { keepPreviousData, useSuspenseQueries } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import { Receipt, Search, Trash2, Wallet } from "lucide-react";
import { Fragment, Suspense, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useBillList } from "@/features/bill/lib/bill-list-context";
import { useBillBulkActions } from "@/features/bill/lib/use-bill-bulk-actions";
import {
   BillExpandedContent,
   BillMobileCard,
   createBillColumns,
} from "@/features/bill/ui/bill-table-columns";
import { BulkPaySheet } from "@/features/bill/ui/bulk-pay-sheet";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useSheet } from "@/hooks/use-sheet";
import { useTRPC } from "@/integrations/clients";

type BillsListSectionProps = {
   type?: "payable" | "receivable";
};

function BillsListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription:
                  "Failed to load bills. Please try again later.",
               errorTitle: "Error loading bills",
               retryText: "Retry",
            })(props)}
         </CardContent>
      </Card>
   );
}

function BillsListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-9 w-full sm:max-w-md" />
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`bill-skeleton-${index + 1}`}>
                     <div className="flex items-center p-4 gap-4">
                        <Skeleton className="size-10 rounded" />
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

function BillsListContent({ type }: BillsListSectionProps) {
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();
   const { openSheet } = useSheet();
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   const {
      setCurrentFilterType,
      currentPage,
      setCurrentPage,
      pageSize,
      setPageSize,
      searchTerm,
      setSearchTerm,
      categoryFilter,
      statusFilter,
      typeFilter,
      startDate,
      endDate,
      bankAccountFilter,
   } = useBillList();

   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm, setCurrentPage]);

   useEffect(() => {
      setCurrentFilterType(type);
   }, [type, setCurrentFilterType]);

   // biome-ignore lint/correctness/useExhaustiveDependencies: Reset page when filters change
   useEffect(() => {
      setCurrentPage(1);
   }, [
      statusFilter,
      typeFilter,
      pageSize,
      startDate,
      endDate,
      bankAccountFilter,
      categoryFilter,
   ]);

   const billType =
      type === "payable"
         ? "expense"
         : type === "receivable"
           ? "income"
           : undefined;

   const [billsQuery, categoriesQuery] = useSuspenseQueries({
      queries: [
         trpc.bills.getAllPaginated.queryOptions(
            {
               endDate: endDate?.toISOString(),
               limit: pageSize,
               month: undefined,
               orderBy: "dueDate",
               orderDirection: "asc",
               page: currentPage,
               search: debouncedSearchTerm || undefined,
               startDate: startDate?.toISOString(),
               type:
                  billType ??
                  (typeFilter !== "all"
                     ? (typeFilter as "income" | "expense")
                     : undefined),
            },
            {
               placeholderData: keepPreviousData,
            },
         ),
         trpc.categories.getAll.queryOptions(),
      ],
   });

   const { bills, pagination } = billsQuery.data;
   const { totalPages, totalCount } = pagination;
   const categories = categoriesQuery.data ?? [];

   const filteredBills = bills.filter((bill) => {
      const matchesCategory =
         categoryFilter === "all" || bill.categoryId === categoryFilter;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isOverdue =
         bill.dueDate && !bill.completionDate && new Date(bill.dueDate) < today;
      const isPending = !bill.completionDate && !isOverdue;

      let matchesStatus = true;
      if (statusFilter === "pending") {
         matchesStatus = isPending;
      } else if (statusFilter === "overdue") {
         matchesStatus = isOverdue;
      } else if (statusFilter === "completed") {
         matchesStatus = !!bill.completionDate;
      }

      return matchesCategory && matchesStatus;
   });

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );
   const selectedBills = filteredBills.filter((bill) =>
      selectedIds.includes(bill.id),
   );
   const selectedTotal = selectedBills.reduce(
      (sum, bill) => sum + Number(bill.amount),
      0,
   );

   const { deleteSelected, isLoading } = useBillBulkActions({
      onSuccess: () => setRowSelection({}),
   });

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const pendingSelectedBills = selectedBills.filter(
      (bill) => !bill.completionDate,
   );

   return (
      <>
         <Card>
            <CardContent className="pt-6 grid gap-4">
               <InputGroup className="sm:max-w-md">
                  <InputGroupInput
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder={translate("common.form.search.placeholder")}
                     value={searchTerm}
                  />
                  <InputGroupAddon>
                     <Search />
                  </InputGroupAddon>
               </InputGroup>

               {filteredBills.length === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Receipt className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyTitle>
                           {translate(
                              "dashboard.routes.bills.list-section.state.empty.title",
                           )}
                        </EmptyTitle>
                        <EmptyDescription>
                           {debouncedSearchTerm ||
                           categoryFilter !== "all" ||
                           statusFilter !== "all"
                              ? "Nenhuma conta encontrada com os filtros aplicados"
                              : translate(
                                   "dashboard.routes.bills.list-section.state.empty.description",
                                )}
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createBillColumns(categories)}
                     data={filteredBills as BillWithRelations[]}
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
                        <BillMobileCard {...props} categories={categories} />
                     )}
                     renderSubComponent={(props) => (
                        <BillExpandedContent
                           {...props}
                           categories={categories}
                        />
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
            {pendingSelectedBills.length > 0 && (
               <SelectionActionButton
                  disabled={isLoading}
                  icon={<Wallet className="size-3.5" />}
                  onClick={() =>
                     openSheet({
                        children: (
                           <BulkPaySheet
                              bills={pendingSelectedBills}
                              onSuccess={handleClearSelection}
                           />
                        ),
                     })
                  }
               >
                  {translate("dashboard.routes.bills.bulk-actions.complete")}
               </SelectionActionButton>
            )}
            <SelectionActionButton
               disabled={isLoading}
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: translate(
                        "dashboard.routes.bills.bulk-actions.delete",
                     ),
                     description: translate(
                        "dashboard.routes.bills.bulk-actions.delete-confirm-description",
                        { count: selectedIds.length },
                     ),
                     onAction: async () => {
                        await deleteSelected(selectedIds);
                     },
                     title: translate(
                        "dashboard.routes.bills.bulk-actions.delete-confirm-title",
                        { count: selectedIds.length },
                     ),
                     variant: "destructive",
                  })
               }
               variant="destructive"
            >
               {translate("dashboard.routes.bills.bulk-actions.delete")}
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

export function BillsListSection({ type }: BillsListSectionProps) {
   return (
      <ErrorBoundary FallbackComponent={BillsListErrorFallback}>
         <Suspense fallback={<BillsListSkeleton />}>
            <BillsListContent type={type} />
         </Suspense>
      </ErrorBoundary>
   );
}
