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
import { Fragment, Suspense, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useCredenza } from "@/hooks/use-credenza";
import { useTRPC } from "@/integrations/clients";
import { CostCenterFilterCredenza } from "../features/cost-center-filter-credenza";
import { useCostCenterList } from "../features/cost-center-list-context";
import { useCostCenterBulkActions } from "../features/use-cost-center-bulk-actions";
import {
   CostCenterExpandedContent,
   CostCenterMobileCard,
   createCostCenterColumns,
} from "./cost-centers-table-columns";

function CostCentersListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription:
                  "Falha ao carregar centros de custo. Tente novamente mais tarde.",
               errorTitle: "Erro ao carregar centros de custo",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function CostCentersListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
               <Skeleton className="h-9 w-full sm:max-w-md" />
               <Skeleton className="h-9 w-9" />
            </div>
            <div className="flex gap-2">
               <Skeleton className="h-8 w-24" />
               <Skeleton className="h-8 w-24" />
            </div>
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`cost-center-skeleton-${index + 1}`}>
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

function CostCentersListContent() {
   const trpc = useTRPC();
   const {
      orderBy,
      setOrderBy,
      orderDirection,
      setOrderDirection,
      currentPage,
      setCurrentPage,
      pageSize,
      setPageSize,
   } = useCostCenterList();

   const { activeOrganization } = useActiveOrganization();
   const isMobile = useIsMobile();
   const { openCredenza } = useCredenza();
   const { openAlertDialog } = useAlertDialog();
   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm, setCurrentPage]);

   const { data: paginatedData } = useSuspenseQuery(
      trpc.costCenters.getAllPaginated.queryOptions(
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

   const { costCenters, pagination } = paginatedData;
   const { totalPages, totalCount } = pagination;

   const handleFilterChange = () => {
      setCurrentPage(1);
   };

   const hasActiveFilters =
      debouncedSearchTerm || orderBy !== "name" || orderDirection !== "asc";

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const { deleteSelected, isLoading } = useCostCenterBulkActions({
      onSuccess: () => setRowSelection({}),
   });

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const handleClearFilters = () => {
      setSearchTerm("");
      setOrderBy("name");
      setOrderDirection("asc");
   };

   return (
      <>
         <Card>
            <CardContent className="pt-6 grid gap-4">
               <div className="flex gap-6">
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

                  {isMobile && (
                     <Button
                        onClick={() =>
                           openCredenza({
                              children: (
                                 <CostCenterFilterCredenza
                                    onOrderByChange={(value) => {
                                       setOrderBy(value);
                                       handleFilterChange();
                                    }}
                                    onOrderDirectionChange={(value) => {
                                       setOrderDirection(value);
                                       handleFilterChange();
                                    }}
                                    onPageSizeChange={(value) => {
                                       setPageSize(value);
                                       handleFilterChange();
                                    }}
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
                           Ordenar por:
                        </span>
                        <ToggleGroup
                           onValueChange={(value) => {
                              if (value) {
                                 setOrderDirection(value as "asc" | "desc");
                                 handleFilterChange();
                              }
                           }}
                           size="sm"
                           spacing={2}
                           type="single"
                           value={orderDirection}
                           variant="outline"
                        >
                           <ToggleGroupItem
                              className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-primary data-[state=on]:text-primary"
                              value="asc"
                           >
                              <ArrowUpAZ className="size-3.5" />
                              A-Z
                           </ToggleGroupItem>
                           <ToggleGroupItem
                              className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-primary data-[state=on]:text-primary"
                              value="desc"
                           >
                              <ArrowDownAZ className="size-3.5" />
                              Z-A
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
                              Limpar Filtros
                           </Button>
                        </>
                     )}
                  </div>
               )}

               {costCenters.length === 0 && pagination.totalCount === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Inbox className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhum centro de custo ainda</EmptyTitle>
                        <EmptyDescription>
                           Crie seu primeiro centro de custo usando a barra de
                           ações rápidas acima para começar a organizar suas
                           transações.
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createCostCenterColumns(activeOrganization.slug)}
                     data={costCenters}
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
                        <CostCenterMobileCard
                           {...props}
                           expenses={0}
                           income={0}
                        />
                     )}
                     renderSubComponent={(props) => (
                        <CostCenterExpandedContent
                           {...props}
                           expenses={0}
                           income={0}
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
         >
            <SelectionActionButton
               disabled={isLoading}
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     description:
                        selectedIds.length === 1
                           ? "Esta ação não pode ser desfeita. Isso excluirá permanentemente 1 centro de custo e removerá a associação de todas as transações vinculadas."
                           : `Esta ação não pode ser desfeita. Isso excluirá permanentemente ${selectedIds.length} centros de custo e removerá a associação de todas as transações vinculadas.`,
                     onAction: () => deleteSelected(selectedIds),
                     title:
                        selectedIds.length === 1
                           ? "Excluir 1 centro de custo?"
                           : `Excluir ${selectedIds.length} centros de custo?`,
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

export function CostCentersListSection() {
   return (
      <ErrorBoundary FallbackComponent={CostCentersListErrorFallback}>
         <Suspense fallback={<CostCentersListSkeleton />}>
            <CostCentersListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
