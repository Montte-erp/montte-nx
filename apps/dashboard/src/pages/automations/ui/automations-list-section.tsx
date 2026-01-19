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
import {
   keepPreviousData,
   useMutation,
   useQueryClient,
   useSuspenseQuery,
} from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";
import {
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
import { toast } from "sonner";
import { useAutomationsList } from "@/features/automations/hooks/use-automations-list-context";
import { useAlertDialog } from "@/hooks/use-alert-dialog";
import { useTRPC } from "@/integrations/clients";
import {
   AutomationExpandedContent,
   AutomationMobileCard,
   createAutomationColumns,
} from "./automations-table-columns";

function AutomationsListErrorFallback(props: FallbackProps) {
   return (
      <Card>
         <CardContent className="pt-6">
            {createErrorFallback({
               errorDescription:
                  "Não foi possível carregar a lista de automações. Por favor, tente novamente.",
               errorTitle: "Erro ao carregar automações",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function AutomationsListSkeleton() {
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
            </div>
            <ItemGroup>
               {Array.from({ length: 5 }).map((_, index) => (
                  <Fragment key={`automation-skeleton-${index + 1}`}>
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

function AutomationsListContent() {
   const isMobile = useIsMobile();
   const { triggerType } = useAutomationsList();
   const trpc = useTRPC();
   const { openAlertDialog } = useAlertDialog();
   const queryClient = useQueryClient();
   const [currentPage, setCurrentPage] = useState(1);
   const [searchTerm, setSearchTerm] = useState("");
   const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
   const [statusFilter, setStatusFilter] = useState<string>("");
   const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
   const [pageSize, setPageSize] = useState(10);
   const [orderBy] = useState<"name" | "createdAt" | "updatedAt" | "priority">(
      "priority",
   );
   const [orderDirection] = useState<"asc" | "desc">("desc");

   useEffect(() => {
      const timer = setTimeout(() => {
         setDebouncedSearchTerm(searchTerm);
         setCurrentPage(1);
      }, 300);
      return () => clearTimeout(timer);
   }, [searchTerm]);

   // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset page when filters change
   useEffect(() => {
      setCurrentPage(1);
   }, [statusFilter, triggerType, pageSize]);

   const { data: paginatedData } = useSuspenseQuery(
      trpc.automations.getAllPaginated.queryOptions(
         {
            enabled:
               statusFilter === "active"
                  ? true
                  : statusFilter === "inactive"
                    ? false
                    : undefined,
            limit: pageSize,
            orderBy,
            orderDirection,
            page: currentPage,
            search: debouncedSearchTerm || undefined,
            triggerType: triggerType || undefined,
         },
         {
            placeholderData: keepPreviousData,
         },
      ),
   );

   const { rules, pagination } = paginatedData;
   const { totalPages, totalCount } = pagination;

   const hasActiveFilters = debouncedSearchTerm || statusFilter;

   const selectedIds = Object.keys(rowSelection).filter(
      (id) => rowSelection[id],
   );

   const deleteManyMutation = useMutation(
      trpc.automations.deleteMany.mutationOptions({
         onError: () => {
            toast.error("Erro ao excluir automações");
         },
         onSuccess: () => {
            queryClient.invalidateQueries({
               queryKey: [["automations"]],
            });
            setRowSelection({});
            toast.success("Automações excluídas com sucesso");
         },
      }),
   );

   const handleClearSelection = () => {
      setRowSelection({});
   };

   const handleClearFilters = () => {
      setStatusFilter("");
      setSearchTerm("");
   };

   const handleDeleteSelected = () => {
      openAlertDialog({
         actionLabel: "Excluir",
         description: `Tem certeza que deseja excluir ${selectedIds.length} automação(ões)? Esta ação não pode ser desfeita.`,
         onAction: async () => {
            await deleteManyMutation.mutateAsync({ ids: selectedIds });
         },
         title: `Excluir ${selectedIds.length} automação(ões)`,
         variant: "destructive",
      });
   };

   return (
      <>
         <Card>
            <CardContent className="pt-6 grid gap-4">
               <div className="flex gap-6">
                  <InputGroup className="flex-1 sm:max-w-md">
                     <InputGroupInput
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar automações..."
                        value={searchTerm}
                     />
                     <InputGroupAddon>
                        <Search />
                     </InputGroupAddon>
                  </InputGroup>

                  {isMobile && (
                     <Button size="icon" variant="outline">
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
                              Ativas
                           </ToggleGroupItem>
                           <ToggleGroupItem
                              className="gap-1.5 data-[state=on]:bg-transparent data-[state=on]:border-muted-foreground data-[state=on]:text-muted-foreground"
                              value="inactive"
                           >
                              <CircleDashed className="size-3.5" />
                              Inativas
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

               {rules.length === 0 ? (
                  <Empty>
                     <EmptyContent>
                        <EmptyMedia variant="icon">
                           <Inbox className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyTitle>Nenhuma automação encontrada</EmptyTitle>
                        <EmptyDescription>
                           Crie sua primeira automação para automatizar tarefas
                           repetitivas.
                        </EmptyDescription>
                     </EmptyContent>
                  </Empty>
               ) : (
                  <DataTable
                     columns={createAutomationColumns()}
                     data={rules}
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
                        <AutomationMobileCard {...props} />
                     )}
                     renderSubComponent={(props) => (
                        <AutomationExpandedContent {...props} />
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
               disabled={deleteManyMutation.isPending}
               icon={<Trash2 className="size-3.5" />}
               onClick={handleDeleteSelected}
               variant="destructive"
            >
               Excluir
            </SelectionActionButton>
         </SelectionActionBar>
      </>
   );
}

export function AutomationsListSection() {
   return (
      <ErrorBoundary FallbackComponent={AutomationsListErrorFallback}>
         <Suspense fallback={<AutomationsListSkeleton />}>
            <AutomationsListContent />
         </Suspense>
      </ErrorBoundary>
   );
}
