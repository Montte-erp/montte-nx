import { Card, CardContent } from "@packages/ui/components/card";
import { DataTable } from "@packages/ui/components/data-table";
import {
   Empty,
   EmptyContent,
   EmptyDescription,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
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
import { Search, Sparkles, Trash2 } from "lucide-react";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import { useDeleteInsight } from "../features/use-delete-insight";
import type { SavedInsight } from "./insights-list-page";
import {
   InsightExpandedContent,
   InsightMobileCard,
   createInsightColumns,
} from "./insights-table-columns";

function InsightsListErrorFallback() {
   return (
      <div className="p-4 text-center text-sm text-destructive">
         Erro ao carregar insights
      </div>
   );
}

function InsightsListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-9 w-full sm:max-w-md" />
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`insight-skeleton-${index + 1}`}>
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

function InsightsListContent() {
   const trpc = useTRPC();
   const { activeOrganization } = useActiveOrganization();
   const { openAlertDialog } = useAlertDialog();
   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);

   const { data: insights } = useSuspenseQuery(
      trpc.dashboards.getAllSavedInsights.queryOptions(
         { search: debouncedSearchTerm || undefined },
         { placeholderData: keepPreviousData },
      ),
   );

   const filteredInsights = useMemo(() => {
      if (!debouncedSearchTerm) return insights;
      return insights.filter((insight) =>
         insight.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()),
      );
   }, [insights, debouncedSearchTerm]);

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const deleteInsightMutation = useDeleteInsight({
      onSuccess: () => {
         setRowSelection({});
      },
   });

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const handleBulkDelete = async (ids: string[]) => {
      for (const id of ids) {
         await deleteInsightMutation.mutateAsync({ id });
      }
   };

   return (
      <>
         <Card>
            <CardContent className="pt-6 grid gap-4">
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

               {filteredInsights.length === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Sparkles className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhum insight salvo ainda</EmptyTitle>
                        <EmptyDescription>
                           Crie insights a partir dos dashboards para salvá-los e
                           reutilizá-los posteriormente.
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createInsightColumns(activeOrganization.slug)}
                     data={filteredInsights as SavedInsight[]}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     renderMobileCard={(props) => <InsightMobileCard {...props} />}
                     renderSubComponent={(props) => (
                        <InsightExpandedContent {...props} />
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
               disabled={deleteInsightMutation.isPending}
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     description: `Esta ação não pode ser desfeita. Isso excluirá permanentemente ${selectedIds.length} ${selectedIds.length === 1 ? "insight" : "insights"}.`,
                     onAction: () => handleBulkDelete(selectedIds),
                     title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "insight" : "insights"}?`,
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

export function InsightsListSection() {
   return (
      <ErrorBoundary FallbackComponent={InsightsListErrorFallback}>
         <Suspense fallback={<InsightsListSkeleton />}>
            <InsightsListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
