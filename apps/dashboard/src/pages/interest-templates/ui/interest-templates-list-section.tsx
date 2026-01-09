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
import { Inbox, Search, Trash2 } from "lucide-react";
import { Fragment, Suspense, useEffect, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import { useInterestTemplateList } from "../features/interest-template-list-context";
import { useInterestTemplateBulkActions } from "../features/use-interest-template-bulk-actions";
import {
   createInterestTemplateColumns,
   InterestTemplateExpandedContent,
   InterestTemplateMobileCard,
} from "./interest-templates-table-columns";

function InterestTemplatesListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription: "Falha ao carregar modelos de juros. Tente novamente mais tarde.",
               errorTitle: "Erro ao carregar modelos",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function InterestTemplatesListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
               <Skeleton className="h-9 w-full sm:max-w-md" />
            </div>
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`interest-template-skeleton-${index + 1}`}>
                     <div className="flex items-center p-4 gap-4">
                        <Skeleton className="size-10 rounded-sm" />
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

function InterestTemplatesListContent() {
   const trpc = useTRPC();
   const {
      orderBy,
      orderDirection,
      currentPage,
      setCurrentPage,
      pageSize,
      setPageSize,
      statusFilter,
      monetaryCorrectionFilter,
      interestTypeFilter,
      penaltyTypeFilter,
      isDefaultFilter,
      startDate,
      endDate,
      searchTerm,
      setSearchTerm,
   } = useInterestTemplateList();

   const { activeOrganization } = useActiveOrganization();
   const { openAlertDialog } = useAlertDialog();
   const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   useEffect(() => {
      const timer = setTimeout(() => {
         setSearchTerm(localSearchTerm);
      }, 300);
      return () => clearTimeout(timer);
   }, [localSearchTerm, setSearchTerm]);

   useEffect(() => {
      setLocalSearchTerm(searchTerm);
   }, [searchTerm]);

   const { data: paginatedData } = useSuspenseQuery(
      trpc.interestTemplates.getAllPaginated.queryOptions(
         {
            endDate: endDate || undefined,
            interestType:
               interestTypeFilter === "all" ? undefined : interestTypeFilter,
            isActive:
               statusFilter === "all" ? undefined : statusFilter === "active",
            isDefault: isDefaultFilter === null ? undefined : isDefaultFilter,
            limit: pageSize,
            monetaryCorrectionIndex:
               monetaryCorrectionFilter === "all"
                  ? undefined
                  : monetaryCorrectionFilter,
            orderBy,
            orderDirection,
            page: currentPage,
            penaltyType:
               penaltyTypeFilter === "all" ? undefined : penaltyTypeFilter,
            search: searchTerm || undefined,
            startDate: startDate || undefined,
         },
         {
            placeholderData: keepPreviousData,
         },
      ),
   );

   const { templates, pagination } = paginatedData;
   const { totalPages, totalCount } = pagination;

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const { deleteSelected, isLoading } = useInterestTemplateBulkActions({
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
               <div className="flex gap-6">
                  <InputGroup className="flex-1 sm:max-w-md">
                     <InputGroupInput
                        onChange={(e) => {
                           setLocalSearchTerm(e.target.value);
                        }}
                        placeholder="Buscar modelos..."
                        value={localSearchTerm}
                     />
                     <InputGroupAddon>
                        <Search />
                     </InputGroupAddon>
                  </InputGroup>
               </div>

               {templates.length === 0 && pagination.totalCount === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Inbox className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhum modelo encontrado</EmptyTitle>
                        <EmptyDescription>
                           Crie um novo modelo de juros para comecar
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createInterestTemplateColumns(
                        activeOrganization.slug,
                     )}
                     data={templates}
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
                        <InterestTemplateMobileCard {...props} />
                     )}
                     renderSubComponent={(props) => (
                        <InterestTemplateExpandedContent {...props} />
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
                     description: `Tem certeza que deseja excluir ${selectedIds.length} modelo(s)? Esta acao nao pode ser desfeita.`,
                     onAction: () => deleteSelected(selectedIds),
                     title: `Excluir ${selectedIds.length} modelo(s)`,
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

export function InterestTemplatesListSection() {
   return (
      <ErrorBoundary FallbackComponent={InterestTemplatesListErrorFallback}>
         <Suspense fallback={<InterestTemplatesListSkeleton />}>
            <InterestTemplatesListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
