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
import { useTagList } from "../features/tag-list-context";
import { useTagBulkActions } from "../features/use-tag-bulk-actions";
import {
   createTagColumns,
   TagExpandedContent,
   TagMobileCard,
} from "./tags-table-columns";

function TagsListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription: "Falha ao carregar tags. Tente novamente mais tarde.",
               errorTitle: "Erro ao carregar tags",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function TagsListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-9 w-full sm:max-w-md" />
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`tag-skeleton-${index + 1}`}>
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

function TagsListContent() {
   const trpc = useTRPC();
   const {
      orderBy,
      orderDirection,
      currentPage,
      setCurrentPage,
      pageSize,
      setPageSize,
   } = useTagList();

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
      trpc.tags.getAllPaginated.queryOptions(
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

   const { tags, pagination } = paginatedData;
   const { totalPages, totalCount } = pagination;

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const { deleteSelected, isLoading } = useTagBulkActions({
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

               {tags.length === 0 && pagination.totalCount === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Inbox className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>
                           Nenhuma tag ainda
                        </EmptyTitle>
                        <EmptyDescription>
                           Crie sua primeira tag usando a barra de ações rápidas acima para começar a organizar suas transações.
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createTagColumns(activeOrganization.slug)}
                     data={tags}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     pagination={{
                        currentPage,
                        onPageChange: setCurrentPage,
                        onPageSizeChange: handlePageSizeChange,
                        pageSize,
                        totalCount,
                        totalPages,
                     }}
                     renderMobileCard={(props) => (
                        <TagMobileCard {...props} expenses={0} income={0} />
                     )}
                     renderSubComponent={(props) => (
                        <TagExpandedContent
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
                     description: selectedIds.length === 1
                        ? "Esta ação não pode ser desfeita. Isso excluirá permanentemente 1 tag e removerá a associação de todas as transações vinculadas."
                        : `Esta ação não pode ser desfeita. Isso excluirá permanentemente ${selectedIds.length} tags e removerá a associação de todas as transações vinculadas.`,
                     onAction: () => deleteSelected(selectedIds),
                     title: selectedIds.length === 1
                        ? "Excluir 1 tag?"
                        : `Excluir ${selectedIds.length} tags?`,
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

export function TagsListSection() {
   return (
      <ErrorBoundary FallbackComponent={TagsListErrorFallback}>
         <Suspense fallback={<TagsListSkeleton />}>
            <TagsListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
