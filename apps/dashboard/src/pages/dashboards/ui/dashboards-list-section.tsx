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
import { Gauge, Search, Trash2 } from "lucide-react";
import { Fragment, Suspense, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useActiveOrganization } from "@/hooks/use-active-organization";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import { useDeleteDashboard } from "../features/use-delete-dashboard";
import type { Dashboard } from "./dashboards-list-page";
import {
   createDashboardColumns,
   DashboardExpandedContent,
   DashboardMobileCard,
} from "./dashboards-table-columns";

function DashboardsListErrorFallback() {
   return (
      <div className="p-4 text-center text-sm text-destructive">
         Erro ao carregar dashboards
      </div>
   );
}

function DashboardsListSkeleton() {
   return (
      <Card>
         <CardContent className="pt-6 grid gap-4">
            <Skeleton className="h-9 w-full sm:max-w-md" />
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`dashboard-skeleton-${index + 1}`}>
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

function DashboardsListContent() {
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

   const { data: dashboards } = useSuspenseQuery(
      trpc.dashboards.getAll.queryOptions(
         { search: debouncedSearchTerm || undefined },
         { placeholderData: keepPreviousData },
      ),
   );

   const filteredDashboards = useMemo(() => {
      if (!debouncedSearchTerm) return dashboards;
      return dashboards.filter((dashboard) =>
         dashboard.name
            .toLowerCase()
            .includes(debouncedSearchTerm.toLowerCase()),
      );
   }, [dashboards, debouncedSearchTerm]);

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const deleteDashboardMutation = useDeleteDashboard({
      onSuccess: () => {
         setRowSelection({});
      },
   });

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const handleBulkDelete = async (ids: string[]) => {
      for (const id of ids) {
         await deleteDashboardMutation.mutateAsync({ id });
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

               {filteredDashboards.length === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Gauge className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhum dashboard ainda</EmptyTitle>
                        <EmptyDescription>
                           Crie seu primeiro dashboard usando o botão acima para
                           começar a visualizar seus dados.
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createDashboardColumns(activeOrganization.slug)}
                     data={filteredDashboards as Dashboard[]}
                     enableRowSelection
                     getRowId={(row) => row.id}
                     onRowSelectionChange={setRowSelection}
                     renderMobileCard={(props) => (
                        <DashboardMobileCard {...props} />
                     )}
                     renderSubComponent={(props) => (
                        <DashboardExpandedContent {...props} />
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
               disabled={deleteDashboardMutation.isPending}
               icon={<Trash2 className="size-3.5" />}
               onClick={() =>
                  openAlertDialog({
                     actionLabel: "Excluir",
                     cancelLabel: "Cancelar",
                     description: `Esta ação não pode ser desfeita. Isso excluirá permanentemente ${selectedIds.length} ${selectedIds.length === 1 ? "dashboard" : "dashboards"}.`,
                     onAction: () => handleBulkDelete(selectedIds),
                     title: `Excluir ${selectedIds.length} ${selectedIds.length === 1 ? "dashboard" : "dashboards"}?`,
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

export function DashboardsListSection() {
   return (
      <ErrorBoundary FallbackComponent={DashboardsListErrorFallback}>
         <Suspense fallback={<DashboardsListSkeleton />}>
            <DashboardsListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
