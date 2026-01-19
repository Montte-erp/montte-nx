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
import { keepPreviousData, useSuspenseQuery } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import { CheckCircle2, Inbox, Search, Trash2, XCircle } from "lucide-react";
import { Fragment, Suspense, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import { useCounterpartyList } from "../features/counterparty-list-context";
import { useCounterpartyBulkActions } from "../features/use-counterparty-bulk-actions";
import {
   CounterpartyExpandedContent,
   CounterpartyMobileCard,
   createCounterpartyColumns,
} from "./counterparties-table-columns";

function CounterpartiesListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription:
                  "Falha ao carregar parceiros. Tente novamente mais tarde.",
               errorTitle: "Erro ao carregar parceiros",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function CounterpartiesListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-9 w-full sm:max-w-md" />
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`counterparty-skeleton-${index + 1}`}>
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

function CounterpartiesListContent() {
   const trpc = useTRPC();
   const {
      // Ordering
      orderBy,
      orderDirection,
      // Pagination
      currentPage,
      setCurrentPage,
      pageSize,
      setPageSize,
      // Filters
      typeFilter,
      statusFilter,
      searchTerm,
      setSearchTerm,
      industryFilter,
      startDate,
      endDate,
   } = useCounterpartyList();

   const { activeOrganization } = useActiveOrganization();
   const { openAlertDialog } = useAlertDialog();
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   // Debounce search term
   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);

   // Convert statusFilter to isActive boolean
   const isActiveFilter =
      statusFilter === "all" ? undefined : statusFilter === "active";

   const { data: paginatedData } = useSuspenseQuery(
      trpc.counterparties.getAllPaginated.queryOptions(
         {
            endDate: endDate || undefined,
            industry: industryFilter === "all" ? undefined : industryFilter,
            isActive: isActiveFilter,
            limit: pageSize,
            orderBy,
            orderDirection,
            page: currentPage,
            search: debouncedSearchTerm || undefined,
            startDate: startDate || undefined,
            type: typeFilter === "all" ? undefined : typeFilter,
         },
         {
            placeholderData: keepPreviousData,
         },
      ),
   );

   const { counterparties, pagination } = paginatedData;
   const { totalPages, totalCount } = pagination;

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const { deleteSelected, toggleActiveSelected, isLoading } =
      useCounterpartyBulkActions({
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
               {/* Search */}
               <InputGroup className="sm:max-w-md">
                  <InputGroupInput
                     onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder="Buscar parceiros..."
                     value={searchTerm}
                  />
                  <InputGroupAddon>
                     <Search />
                  </InputGroupAddon>
               </InputGroup>

               {counterparties.length === 0 && pagination.totalCount === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Inbox className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhum parceiro encontrado</EmptyTitle>
                        <EmptyDescription>
                           Adicione um novo parceiro comercial para comecar
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createCounterpartyColumns(
                        activeOrganization.slug,
                     )}
                     data={counterparties}
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
                        <CounterpartyMobileCard {...props} />
                     )}
                     renderSubComponent={(props) => (
                        <CounterpartyExpandedContent {...props} />
                     )}
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
               icon={<CheckCircle2 className="size-3.5" />}
               onClick={() => toggleActiveSelected(selectedIds, true)}
            >
               Ativar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={isLoading}
               icon={<XCircle className="size-3.5" />}
               onClick={() => toggleActiveSelected(selectedIds, false)}
            >
               Desativar
            </SelectionActionButton>
            <SelectionActionButton
               disabled={isLoading}
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     description: `Tem certeza que deseja excluir ${selectedIds.length} parceiro(s)? Esta acao nao pode ser desfeita.`,
                     onAction: () => deleteSelected(selectedIds),
                     title: `Excluir ${selectedIds.length} parceiro(s)`,
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

export function CounterpartiesListSection() {
   return (
      <ErrorBoundary FallbackComponent={CounterpartiesListErrorFallback}>
         <Suspense fallback={<CounterpartiesListSkeleton />}>
            <CounterpartiesListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
